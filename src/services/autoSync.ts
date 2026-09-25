// Gitee 自动同步服务：防抖推送、启动拉取、退出兜底、失败告警
// - 数据变更入口：promptStore.autoExport 落盘成功后调用 notifyDataChanged()
// - 仅在 Tauri 环境且 Gitee 已配置并启用时发起网络请求
// - 冲突策略 last-write-wins；推送前先做本地备份（滚动保留 5 份）
import { ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { loadJson, saveJson } from './storage'

export interface GiteeConfig {
  token: string
  owner: string
  repo: string
  path: string
  enabled: boolean
}

const PUSH_DEBOUNCE_MS = 60_000
const EXIT_FLUSH_TIMEOUT_MS = 3_000
const FAILURE_ALERT_THRESHOLD = 3

// 同步健康状态（设置面板同步区据此显示持续警告）
export const autoSyncHealth = ref<{ failing: boolean; lastError: string }>({
  failing: false,
  lastError: ''
})

let pushTimer: number | null = null
let failureCount = 0
let pendingPush = false
let startupCandidate: any = null

const isTauri = (): boolean =>
  typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__

function readGiteeConfig(): GiteeConfig | null {
  const cfg = loadJson<Partial<GiteeConfig> | null>('promptpal_gitee_config', null)
  if (!cfg?.enabled || !cfg.token || !cfg.owner || !cfg.repo) return null
  return {
    token: cfg.token,
    owner: cfg.owner,
    repo: cfg.repo,
    path: cfg.path || 'promptpal_data.json',
    enabled: true
  }
}

// 构建导出数据（与手动推送完全一致的结构，exportedAt 同时作为启动拉取的新旧判据）
export function buildExportData(): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  const prompts = loadJson('promptpal_prompts', null)
  if (prompts) data.prompts = prompts
  const categories = loadJson('promptpal_categories', null)
  if (categories) data.categories = categories
  const petStyle = loadJson('promptpal_pet_style', null)
  if (petStyle) data.petStyle = petStyle
  data.exportedAt = new Date().toISOString()
  return data
}

// 安全的 UTF-8 → Base64（支持中文）
export function toBase64Utf8(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

// 安全的 Base64 → UTF-8（Gitee 返回的 base64 可能带换行）
export function fromBase64Utf8(b64: string): string {
  const clean = b64.replace(/\s/g, '')
  const binary = atob(clean)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder('utf-8').decode(bytes)
}

// 推送（不含备份，调用方按需先调 backup_data_file）
export async function pushToGitee(cfg: GiteeConfig, data?: Record<string, unknown>): Promise<string> {
  const payload = data ?? buildExportData()
  const content = toBase64Utf8(JSON.stringify(payload, null, 2))
  return await invoke('gitee_push', {
    token: cfg.token,
    owner: cfg.owner,
    repo: cfg.repo,
    path: cfg.path,
    content
  }) as string
}

// 手动推送成功后调用：清除待推送标记与失败计数
export function markPushed(): void {
  pendingPush = false
  failureCount = 0
  autoSyncHealth.value = { failing: false, lastError: '' }
}

// 数据变更通知：60s 防抖后自动推送
export function notifyDataChanged(): void {
  if (!isTauri()) return
  if (!readGiteeConfig()) return
  pendingPush = true
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = window.setTimeout(() => {
    pushTimer = null
    void autoPush()
  }, PUSH_DEBOUNCE_MS)
}

async function autoPush(): Promise<void> {
  const cfg = readGiteeConfig()
  if (!cfg) return
  try {
    await invoke('backup_data_file').catch(() => {})
    await pushToGitee(cfg)
    markPushed()
  } catch (e: any) {
    failureCount++
    if (failureCount >= FAILURE_ALERT_THRESHOLD) {
      autoSyncHealth.value = { failing: true, lastError: String(e).slice(0, 120) }
    }
  }
}

// 把拉取到的数据写入 localStorage（store 重载由调用方负责）
export function applyPulledData(decoded: any): void {
  if (decoded.prompts) saveJson('promptpal_prompts', decoded.prompts)
  if (decoded.categories) saveJson('promptpal_categories', decoded.categories)
  if (decoded.petStyle) saveJson('promptpal_pet_style', decoded.petStyle)
}

// 启动拉取检查：
// - 本地库为空且远端有数据 → 静默拉取，返回 'pulled'
// - 远端 exportedAt 较新 → 返回 'confirm'（候选数据经 takeStartupCandidate 取出）
// - 其余 → 'none'；远端不可达 → 'error'
export async function checkStartupSync(): Promise<'pulled' | 'confirm' | 'none' | 'error'> {
  if (!isTauri()) return 'none'
  const cfg = readGiteeConfig()
  if (!cfg) return 'none'
  try {
    const json = await invoke('gitee_pull', {
      token: cfg.token,
      owner: cfg.owner,
      repo: cfg.repo,
      path: cfg.path
    }) as string
    const fileData = JSON.parse(json)
    if (!fileData?.content) return 'none'
    const decoded = JSON.parse(fromBase64Utf8(fileData.content))
    if (!decoded || !Array.isArray(decoded.prompts)) return 'none'

    const localPrompts = loadJson<any[]>('promptpal_prompts', [])
    if (localPrompts.length === 0) {
      applyPulledData(decoded)
      return 'pulled'
    }

    const localFile = (await invoke('sync_load').catch(() => '')) as string
    let localAt = ''
    if (localFile) {
      try { localAt = JSON.parse(localFile)?.exportedAt || '' } catch { /* ignore */ }
    }
    const remoteAt = decoded.exportedAt || ''
    if (remoteAt && (!localAt || new Date(remoteAt) > new Date(localAt))) {
      startupCandidate = decoded
      return 'confirm'
    }
    return 'none'
  } catch {
    return 'error'
  }
}

// 取出待确认的启动拉取候选数据（一次性）
export function takeStartupCandidate(): any {
  const c = startupCandidate
  startupCandidate = null
  return c
}

// 退出应用：先尽力推送未推送改动（≤3s，失败不阻塞），再退出
export async function exitApp(): Promise<void> {
  try {
    if (pushTimer) { clearTimeout(pushTimer); pushTimer = null }
    if (pendingPush) {
      const cfg = readGiteeConfig()
      if (cfg) {
        await Promise.race([
          (async () => {
            await invoke('backup_data_file').catch(() => {})
            await pushToGitee(cfg)
          })(),
          new Promise(r => setTimeout(r, EXIT_FLUSH_TIMEOUT_MS))
        ])
      }
    }
  } catch { /* 不阻塞退出 */ }
  await invoke('exit_app').catch(() => {})
}
