// AI 代理 hook 安装器：ZCode / Claude Code / Codex 三端接入与卸载
// - 标记：所有条目带 statusMessage = "PromptPal: <Event>"，查重/卸载按此匹配
// - ZCode：~/.zcode/cli/config.json → hooks.events.<E> 数组，handler type 'process'（command+args 分离）
// - Claude：~/.claude/settings.json → hooks.<E> 数组，handler type 'command'（单字符串）
// - Codex：~/.codex/config.toml → [[hooks.<E>]] 追加块（append-only 文本层，不动用户既有内容）
// - 文件读写全部经 Rust 白名单命令
import { invoke } from '@tauri-apps/api/core'
import { hookArgs, hookCommandLine } from './agentState'

export type AgentId = 'zcode' | 'claude' | 'codex'

// 事件 → 桌宠状态映射（三端一致）
export const AGENT_EVENTS: Array<{ event: string; state: 'working' | 'done' | 'idle' }> = [
  { event: 'UserPromptSubmit', state: 'working' },
  { event: 'PostToolUse', state: 'working' },
  { event: 'Stop', state: 'done' },
  { event: 'SessionEnd', state: 'idle' },
]

const MARKER_PREFIX = 'PromptPal: '
const CONFIG_PATHS: Record<AgentId, string> = {
  zcode: '~/.zcode/cli/config.json',
  claude: '~/.claude/settings.json',
  codex: '~/.codex/config.toml',
}

// 路径统一传 ~ 前缀字符串，Rust check_whitelist 负责展开（前端无 home 绝对路径）
const expand = (p: string) => p

function readCfg(path: string): Promise<string> {
  return invoke<string>('read_settings_file', { path: expand(path) })
}
function writeCfg(path: string, content: string): Promise<void> {
  return invoke<void>('write_settings_file', { path: expand(path), content })
}

const psScriptPathTilde = '~/.promptpal/agent-hook.ps1'

// hook 脚本写入（幂等）
export async function ensureHookScript(): Promise<void> {
  const existing = await readCfg(psScriptPathTilde).catch(() => '')
  if (existing.trim() === HOOK_SCRIPT_FIXTURE.trim()) return
  await writeCfg(psScriptPathTilde, HOOK_SCRIPT_FIXTURE)
}

// 与 agentState.ts 的 HOOK_SCRIPT 保持一致（此处独立成常量避免依赖运行时路径）
const HOOK_SCRIPT_FIXTURE = `param([string]$Agent = 'unknown', [string]$State = 'working')
$null = [Console]::In.ReadToEnd()
$json = @{ agent = $Agent; state = $State; ts = [DateTimeOffset]::Now.ToUnixTimeMilliseconds() } |
  ConvertTo-Json -Compress
[System.IO.File]::WriteAllText((Join-Path $env:USERPROFILE '.promptpal\agent_state.json'), $json, (New-Object System.Text.UTF8Encoding $false))
`

// ===== ZCode / Claude（JSON） =====
function isZcode(a: AgentId) { return a === 'zcode' }

function jsonEventsContainer(cfg: any, agent: AgentId): Record<string, any[]> {
  if (isZcode(agent)) {
    cfg.hooks = cfg.hooks && typeof cfg.hooks === 'object' ? cfg.hooks : {}
    cfg.hooks.enabled = cfg.hooks.enabled !== false
    cfg.hooks.events = cfg.hooks.events && typeof cfg.hooks.events === 'object' ? cfg.hooks.events : {}
    return cfg.hooks.events
  }
  cfg.hooks = cfg.hooks && typeof cfg.hooks === 'object' ? cfg.hooks : {}
  return cfg.hooks
}

function isPromptPalEntry(e: any): boolean {
  return e && typeof e === 'object' && typeof e.statusMessage === 'string'
    && e.statusMessage.startsWith(MARKER_PREFIX)
}

// 纯函数：JSON 配置安装（幂等，不改用户自有条目）
// 结构：events.<E> = MatcherGroup[]，每组 { matcher?: string, hooks: Handler[] }；
// PromptPal 的处理器放在专属组的 hooks 里（组级标记 statusMessage 不合法——那是 v1.6.0 的 bug 形状）
export function applyJsonInstall(cfg: any, agent: AgentId, scriptPathTilde: string): any {
  const container = jsonEventsContainer(cfg, agent)
  for (const { event, state } of AGENT_EVENTS) {
    const groups: any[] = Array.isArray(container[event]) ? container[event] : []
    const ppGroup = groups.find(g => isPromptPalGroup(g))
    if (ppGroup) { container[event] = groups; continue } // 已安装：幂等
    let handler: any
    if (isZcode(agent)) {
      const { command, args } = hookArgs(agent, state, scriptPathTilde)
      handler = { type: 'process', command, args, timeoutMs: 10000, statusMessage: MARKER_PREFIX + event }
    } else {
      handler = { type: 'command', command: hookCommandLine(agent, state, scriptPathTilde), timeout: 10, statusMessage: MARKER_PREFIX + event }
    }
    groups.push({ hooks: [handler] })
    container[event] = groups
  }
  return cfg
}

// 组级识别：v1.6.0 误写的平铺条目（type 顶层 + statusMessage 顶层）也算 PromptPal 的，便于清理
function isPromptPalGroup(g: any): boolean {
  if (!g || typeof g !== 'object') return false
  if (Array.isArray(g.hooks) && g.hooks.some(isPromptPalEntry)) return true
  // 清理历史误写：平铺在组级的 PromptPal 条目
  return typeof g.statusMessage === 'string' && g.statusMessage.startsWith(MARKER_PREFIX)
    && typeof g.type === 'string'
}

// 纯函数：JSON 配置卸载（移除 PromptPal 处理器与空组，用户条目不动）
export function applyJsonUninstall(cfg: any, agent: AgentId): any {
  const container = jsonEventsContainer(cfg, agent)
  for (const { event } of AGENT_EVENTS) {
    const groups = container[event]
    if (!Array.isArray(groups)) continue
    const cleaned = groups
      .map(g => {
        if (Array.isArray(g?.hooks)) {
          return { ...g, hooks: g.hooks.filter((h: any) => !isPromptPalEntry(h)) }
        }
        return g
      })
      .filter(g => {
        // 丢弃：被清空的组（空组对 ZCode/Claude 无意义，顺带清掉 v1.6.0 遗留空组）
        if (Array.isArray(g?.hooks) && g.hooks.length === 0) return false
        // 历史误写的平铺条目（v1.6.0 bug 形状）
        if (typeof g?.statusMessage === 'string' && g.statusMessage.startsWith(MARKER_PREFIX) && !Array.isArray(g.hooks)) return false
        return true
      })
    container[event] = cleaned
  }
  return cfg
}

async function installJson(agent: AgentId): Promise<void> {
  await ensureHookScript()
  const raw = await readCfg(CONFIG_PATHS[agent]).catch(() => '')
  const cfg = raw.trim() ? JSON.parse(raw) : {}
  const updated = applyJsonInstall(cfg, agent, psScriptPathTilde)
  await writeCfg(CONFIG_PATHS[agent], JSON.stringify(updated, null, 2))
}

async function uninstallJson(agent: AgentId): Promise<void> {
  const raw = await readCfg(CONFIG_PATHS[agent]).catch(() => '')
  if (!raw.trim()) return
  const cfg = applyJsonUninstall(JSON.parse(raw), agent)
  await writeCfg(CONFIG_PATHS[agent], JSON.stringify(cfg, null, 2))
}

// ===== Codex（TOML append-only） =====
function tomlBlock(agent: AgentId, event: string, state: string): string {
  const line = hookCommandLine(agent, state, psScriptPathTilde)
  return [
    `# ${MARKER_PREFIX}${event}`,
    `[[hooks.${event}]]`,
    `hooks = [{ type = "command", commandWindows = '${line}', timeout = 10, statusMessage = "${MARKER_PREFIX}${event}" }]`,
    '',
  ].join('\n')
}

// 纯函数：TOML 安装（幂等 append-only）
export function applyTomlInstall(text: string, agent: AgentId): string {
  let out = text
  let added = false
  for (const { event, state } of AGENT_EVENTS) {
    if (out.includes('# ' + MARKER_PREFIX + event)) continue
    out += '\n' + tomlBlock(agent, event, state)
    added = true
  }
  return added ? out : text
}

// 纯函数：卸载——删除标记注释行起至下一个空行（或文件尾）的块
export function stripTomlBlocks(text: string): string {
  const lines = text.split('\n')
  const out: string[] = []
  let skipping = false
  for (const line of lines) {
    if (line.startsWith('# ' + MARKER_PREFIX)) { skipping = true; continue }
    if (skipping) {
      if (line.trim() === '') { skipping = false; continue }
      continue
    }
    out.push(line)
  }
  return out.join('\n').replace(/\n{3,}$/, '\n')
}

async function installToml(): Promise<void> {
  await ensureHookScript()
  const text = await readCfg(CONFIG_PATHS.codex).catch(() => '')
  const updated = applyTomlInstall(text || '', 'codex')
  if (updated !== (text || '')) await writeCfg(CONFIG_PATHS.codex, updated)
}

async function uninstallToml(): Promise<void> {
  const text = await readCfg(CONFIG_PATHS.codex).catch(() => '')
  if (!text.trim()) return
  await writeCfg(CONFIG_PATHS.codex, stripTomlBlocks(text))
}

// ===== 统一入口 =====
export async function installAgent(agent: AgentId): Promise<void> {
  if (agent === 'codex') await installToml()
  else await installJson(agent)
}

export async function uninstallAgent(agent: AgentId): Promise<void> {
  if (agent === 'codex') await uninstallToml()
  else await uninstallJson(agent)
}

export type LinkStatus = 'linked' | 'partial' | 'not-installed' | 'missing'

export async function agentStatus(agent: AgentId): Promise<LinkStatus> {
  const raw = await readCfg(CONFIG_PATHS[agent]).catch(() => null)
  if (raw === null) return 'missing'
  if (agent === 'codex') {
    const hits = AGENT_EVENTS.filter(({ event }) => raw.includes(`# ${MARKER_PREFIX}${event}`)).length
    return hits === 0 ? 'not-installed' : hits === AGENT_EVENTS.length ? 'linked' : 'partial'
  }
  try {
    const cfg = JSON.parse(raw)
    const container = jsonEventsContainer(cfg, agent)
    const hits = AGENT_EVENTS.filter(({ event }) =>
      Array.isArray(container[event]) && container[event].some(isPromptPalGroup)).length
    return hits === 0 ? 'not-installed' : hits === AGENT_EVENTS.length ? 'linked' : 'partial'
  } catch {
    return 'missing'
  }
}
