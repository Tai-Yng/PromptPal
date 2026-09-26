// AI 代理状态联动：状态文件协议解析 + 超时回落（hook 端写 ~/.promptpal/agent_state.json）
// 协议：{agent: string, state: "working"|"done"|"idle", ts: number(毫秒)}
// - 损坏/缺字段视为无状态
// - 距 ts 超过 timeoutMs 回落无状态；state=idle 视为无状态
import { invoke } from '@tauri-apps/api/core'

export interface AgentStateRaw {
  agent?: unknown
  state?: unknown
  ts?: unknown
}

export type AgentBadge = 'working' | 'done'

// 纯函数：从原始文件文本解析徽章状态（nowMs 供超时计算；损坏/过期/idle → null）
export function parseAgentBadge(text: string, nowMs: number, timeoutMs: number): AgentBadge | null {
  if (!text.trim()) return null
  let raw: AgentStateRaw
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  if (!raw || typeof raw !== 'object') return null
  if (raw.state !== 'working' && raw.state !== 'done' && raw.state !== 'idle') return null
  if (typeof raw.ts !== 'number' || !Number.isFinite(raw.ts)) return null
  if (typeof raw.agent !== 'string' || !raw.agent) return null
  if (nowMs - raw.ts > timeoutMs) return null
  if (raw.state === 'idle') return null
  return raw.state
}

// 前端轮询（Tauri；总开关关闭时调用方不启动）
export async function fetchAgentBadge(timeoutMs: number): Promise<AgentBadge | null> {
  try {
    const text = await invoke<string>('read_agent_state')
    return parseAgentBadge(text, Date.now(), timeoutMs)
  } catch {
    return null
  }
}

// ===== hook 脚本方案 =====
// 内联 PowerShell 转义层次太深（TOML 字面量字符串容不下单引号），
// 安装器先把 agent-hook.ps1 写入 ~/.promptpal/，三端 hook 统一短参数调用。
export const HOOK_SCRIPT_PATH = '~/.promptpal/agent-hook.ps1'

export const HOOK_SCRIPT = `param([string]$Agent = 'unknown', [string]$State = 'working')
$null = [Console]::In.ReadToEnd()
@{ agent = $Agent; state = $State; ts = [DateTimeOffset]::Now.ToUnixTimeMilliseconds() } |
  ConvertTo-Json -Compress |
  Set-Content -Path "$env:USERPROFILE\\.promptpal\\agent_state.json" -Encoding UTF8
`

// hookCommand 生成：三端统一形态
// - JSON 端（ZCode/Claude）：command + args 分离，零转义
// - Codex TOML：commandLine 单字符串（TOML 字面量字符串承载，内层双引号合法）
export function hookArgs(agent: string, state: string, scriptPath: string): { command: string; args: string[] } {
  return {
    command: 'powershell',
    args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-Agent', agent, '-State', state]
  }
}

export function hookCommandLine(agent: string, state: string, scriptPath: string): string {
  return `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -Agent ${agent} -State ${state}`
}
