// 模板变量：从提示词内容动态解析 [名称] 与 {{名称}} 占位符（不加数据字段）
// - 识别：名称 1–40 字符、不含换行、不含嵌套括号；-- 开头的命令参数段不算变量
// - 替换：留空/未提供的变量保留占位符原文
// - 记忆：按 promptId+变量名 存上次填值，LRU 上限 1000 条（经统一存储层持久化）
import { loadJson, saveJson } from './storage'

export interface PromptVariable {
  name: string
  syntax: 'bracket' | 'brace'
}

// 单遍扫描两种语法：m[1] = [名称]，m[2] = {{名称}}
// lookbehind/lookahead 排除嵌套括号（[[x]]、{{x}}} 不产生变量）
const VAR_TOKEN = /(?<!\[)\[([^\[\]\n]{1,40})\](?!\])|(?<!\{)\{\{([^{}\n]{1,40})\}\}(?!\})/g

// 按首次出现顺序去重解析变量
export function parseVariables(content: string): PromptVariable[] {
  if (!content) return []
  const seen = new Set<string>()
  const result: PromptVariable[] = []
  for (const m of content.matchAll(VAR_TOKEN)) {
    const raw = (m[1] ?? m[2] ?? '').trim()
    if (!raw || raw.startsWith('--')) continue
    if (seen.has(raw)) continue
    seen.add(raw)
    result.push({ name: raw, syntax: m[1] !== undefined ? 'bracket' : 'brace' })
  }
  return result
}

// 替换填空值；留空或未提供的变量保留占位符原文
export function substitute(content: string, values: Record<string, string>): string {
  return content.replace(VAR_TOKEN, (m, b, c) => {
    const name = (b ?? c ?? '').trim()
    const v = name ? values[name] : undefined
    return v && v.trim() ? v : m
  })
}

export function hasVariables(content: string): boolean {
  return parseVariables(content).length > 0
}

// ===== 变量记忆（LRU） =====
const MEMORY_KEY = 'promptpal_var_memory'
const MEMORY_LIMIT = 1000

interface MemoryEntry { v: string; t: number }
type MemoryShape = Record<string, MemoryEntry>

const memKey = (promptId: string, name: string) => `${promptId}::${name}`

// 读取记忆值并刷新 LRU 时间戳；无记忆返回空串
export function recallVar(promptId: string, name: string): string {
  const mem = loadJson<MemoryShape>(MEMORY_KEY, {})
  const e = mem[memKey(promptId, name)]
  if (!e) return ''
  e.t = Date.now()
  saveJson(MEMORY_KEY, mem)
  return e.v
}

// 写入记忆值，超限时按最久未使用淘汰
export function rememberVar(promptId: string, name: string, value: string): void {
  const mem = loadJson<MemoryShape>(MEMORY_KEY, {})
  mem[memKey(promptId, name)] = { v: value, t: Date.now() }
  const keys = Object.keys(mem)
  if (keys.length > MEMORY_LIMIT) {
    keys.sort((a, b) => mem[a].t - mem[b].t)
    for (const k of keys.slice(0, keys.length - MEMORY_LIMIT)) delete mem[k]
  }
  saveJson(MEMORY_KEY, mem)
}
