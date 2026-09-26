// Shimeji 形象包动作 XML 解析：从 conf 动作定义提取各状态的帧序列
// 双格式兼容：
//  - Shimeji-ee 英文:  <Action name="Walk" type="Move"><Animation><Pose Image="shime2.png" .../></Animation></Action>
//  - Group-Finity 日文: <動作 名前="歩く" 種類="移動"><アニメーション><ポーズ 画像="/shime2.png" .../></アニメーション></動作>
// 映射策略：动作名按关键词归入 walk/idle/sleep，首个命中动作的帧引用（按出现顺序去重）即该状态序列
// 文件名→帧号：shime<数字>.png 的数字（1-based）

// 英文块匹配（Action ... </Action>），日文块匹配（動作 ... </動作>）
const ACTION_BLOCK = /<Action\s[^>]*name="([^"]*)"[^>]*>([\s\S]*?)<\/Action>|<動作\s[^>]*名前="([^"]*)"[^>]*>([\s\S]*?)<\/動作>/g
// 帧引用：Image=".../shimeN.png" 或 画像="/shimeN.png"（前导路径可有可无）
const IMAGE_REF = /(?:Image|画像)\s*=\s*"\/?(?:[^"]*?shime)?(\d+)\.png"/g

// 关键词 → 状态（按优先级顺序，英文不区分大小写、日文子串匹配）
const KEYWORDS: Array<{ state: 'walk' | 'idle' | 'sleep'; patterns: RegExp[] }> = [
  { state: 'walk', patterns: [/^walk/i, /walk/i, /run/i, /move/i, /歩く/, /走る/, /^走/] },
  { state: 'idle', patterns: [/^stand/i, /stand/i, /idle/i, /look/i, /sit/i, /立つ/, /座る/, /座っ/, /座/],
  },
  { state: 'sleep', patterns: [/sleep/i, /rest/i, /nap/i, /寝そべる/, /寝る/, /眠る/, /寝転/, /寝/] },
]

export type SpriteState = 'walk' | 'idle' | 'sleep'
export interface ShimejiMapping { walk?: number[]; idle?: number[]; sleep?: number[] }

// 从动作 XML 文本提取 {动作名: 帧号序列（去重保序）}
export function extractActionFrames(xml: string): Array<{ name: string; frames: number[] }> {
  const actions: Array<{ name: string; frames: number[] }> = []
  // 先剥离自闭合动作（<Action .../> / <動作 .../>）：它们无帧，
  // 且不剥离会被惰性匹配吞掉下一个动作的闭合标签
  const cleaned = xml.replace(/<(?:Action|動作)\s[^>]*\/>/g, '')
  for (const m of cleaned.matchAll(ACTION_BLOCK)) {
    const name = (m[1] ?? m[3] ?? '').trim()
    const body = m[2] ?? m[4] ?? ''
    const seen = new Set<number>()
    const frames: number[] = []
    for (const im of body.matchAll(IMAGE_REF)) {
      const n = Number.parseInt(im[1], 10)
      if (Number.isFinite(n) && n >= 1 && !seen.has(n)) {
        seen.add(n)
        frames.push(n)
      }
    }
    if (name && frames.length > 0) actions.push({ name, frames })
  }
  return actions
}

// 动作名 → 状态归类；未命中返回 null
export function classifyAction(name: string): SpriteState | null {
  for (const { state, patterns } of KEYWORDS) {
    for (const p of patterns) {
      if (p.test(name)) return state
    }
  }
  return null
}

// 从完整 XML 文本解析三状态映射（每个状态取首个命中动作）
export function parseShimejiConf(xml: string): ShimejiMapping {
  const actions = extractActionFrames(xml)
  const mapping: ShimejiMapping = {}
  for (const { name, frames } of actions) {
    const state = classifyAction(name)
    if (state && !mapping[state]) {
      mapping[state] = frames
    }
  }
  return mapping
}

// 判断 XML 是否动作定义文件（排除 XSD/schema/行为频率表）
export function isActionConf(xmlText: string): boolean {
  return /<(Action|動作)\s/.test(xmlText) && /<(Pose|ポーズ)\s/.test(xmlText)
}
