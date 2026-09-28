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

export type AgentBadge = 'working' | 'done' | 'error'
export interface AgentStateInfo { state: AgentBadge; agent: string; detail: string }

// 纯函数：从原始文件文本解析代理状态（nowMs 供超时计算；损坏/过期/idle → null）
export function parseAgentState(text: string, nowMs: number, timeoutMs: number): AgentStateInfo | null {
  if (!text.trim()) return null
  let raw: AgentStateRaw & { detail?: unknown }
  try {
    // 剥 UTF-8 BOM（PowerShell 5 Set-Content 遗留）
    raw = JSON.parse(text.replace(/^﻿/, ''))
  } catch {
    return null
  }
  if (!raw || typeof raw !== 'object') return null
  if (raw.state !== 'working' && raw.state !== 'done' && raw.state !== 'idle' && raw.state !== 'error') return null
  if (typeof raw.ts !== 'number' || !Number.isFinite(raw.ts)) return null
  if (typeof raw.agent !== 'string' || !raw.agent) return null
  if (nowMs - raw.ts > timeoutMs) return null
  if (raw.state === 'idle') return null
  const detail = typeof raw.detail === 'string' ? raw.detail.slice(0, 80) : ''
  return { state: raw.state, agent: raw.agent, detail }
}

// 前端轮询（Tauri；总开关关闭时调用方不启动）
export async function fetchAgentState(timeoutMs: number): Promise<AgentStateInfo | null> {
  try {
    const text = await invoke<string>('read_agent_state')
    return parseAgentState(text, Date.now(), timeoutMs)
  } catch {
    return null
  }
}

// ===== hook 脚本方案 =====
// 内联 PowerShell 转义层次太深（TOML 字面量字符串容不下单引号），
// 安装器先把 agent-hook.ps1 写入 ~/.promptpal/，三端 hook 统一短参数调用。
export const HOOK_SCRIPT_PATH = '~/.promptpal/agent-hook.ps1'

export const HOOK_SCRIPT = `param(
  [string]$Agent = 'unknown',
  [string]$State = 'working',
  [string]$Event = ''
)
# 从事件 stdin 提取一句工作摘要（PostToolUse=工具+文件，UserPromptSubmit=prompt 首行）
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding $false
$detail = ''
try {
  $raw = [Console]::In.ReadToEnd()
  if ($raw -and $raw.Trim()) {
    $i = $raw | ConvertFrom-Json
    if ($Event -eq 'PostToolUse' -or $Event -eq 'PostToolUseFailure') {
      $leaf = ''
      if ($i.tool_input -and $i.tool_input.file_path) { $leaf = Split-Path -Leaf $i.tool_input.file_path }
      if ($i.tool_name -or $leaf) { $detail = ('' + $i.tool_name + ' ' + $leaf).Trim() }
    } elseif ($Event -eq 'UserPromptSubmit' -and $i.prompt) {
      $detail = ([string]$i.prompt -split "\\r?\\n")[0]
    }
  }
} catch {}
if ($detail.Length -gt 60) { $detail = $detail.Substring(0, 57) + '...' }
$json = @{ agent = $Agent; state = $State; ts = [DateTimeOffset]::Now.ToUnixTimeMilliseconds(); detail = $detail } |
  ConvertTo-Json -Compress
$path = Join-Path (Join-Path $env:USERPROFILE '.promptpal') 'agent_state.json'
[System.IO.File]::WriteAllText($path, $json, (New-Object System.Text.UTF8Encoding $false))
`

// hookCommand 生成：三端统一形态
// - JSON 端（ZCode/Claude）：command + args 分离，零转义
// - Codex TOML：commandLine 单字符串（TOML 字面量字符串承载，内层双引号合法）
export function hookArgs(agent: string, event: string, state: string, scriptPath: string): { command: string; args: string[] } {
  return {
    command: 'powershell',
    args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-Agent', agent, '-Event', event, '-State', state]
  }
}

export function hookCommandLine(agent: string, event: string, state: string, scriptPath: string): string {
  return `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -Agent ${agent} -Event ${event} -State ${state}`
}
