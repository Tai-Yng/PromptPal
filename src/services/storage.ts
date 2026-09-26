// 统一本地存储层 — 全应用 localStorage 读写的唯一入口
// - loadJson/saveJson/loadString/saveString 统一兜底 JSON 异常、配额异常与 SSR 环境
// - promptpal_schema_version 记录数据版本，迁移函数链为后续演进留口
// 注意：sync_save 导出的 ~/.promptpal/promptpal_data.json 结构不在本层管辖，
//       其字段格式是 CLI（pal）与旧备份文件的兼容契约，不得改动。

export const SCHEMA_VERSION = 3
const VERSION_KEY = 'promptpal_schema_version'

// 校验器：把 unknown 规整为 T；不合法时返回 null（调用方得到 fallback）
export type Validator<T> = (raw: unknown) => T | null

// 迁移链：migrations[v-1] 把数据从版本 v 升级到 v+1。
// v1→v2：pet_style 新增 spritePath/frameMap/frameRate 可选字段——
//   读取端已兜底缺省，数据本身无需改写，此处仅走链升版本。
// v2→v3：frameMap 值增加可选 frames 帧列表（Shimeji 非连续引用）——
//   同为可选字段，读取端双格式兼容，仅走链升版本。
const migrations: Array<() => void> = [
  () => { /* v2 新字段可选，读取端兜底 */ },
  () => { /* v3 frames 可选，读取端兜底 */ },
]

export function ensureSchemaVersion(): void {
  if (typeof localStorage === 'undefined') return
  try {
    const raw = localStorage.getItem(VERSION_KEY)
    let v = raw === null ? 1 : Number.parseInt(raw, 10)
    if (!Number.isFinite(v) || v < 1) v = 1
    while (v < SCHEMA_VERSION) {
      const migrate = migrations[v - 1]
      if (!migrate) break
      try { migrate() } catch { /* 单级迁移失败不阻塞后续 */ }
      v++
      localStorage.setItem(VERSION_KEY, String(v))
    }
    if (raw !== String(SCHEMA_VERSION)) {
      localStorage.setItem(VERSION_KEY, String(SCHEMA_VERSION))
    }
  } catch { /* 存储不可用时静默 */ }
}

export function loadJson<T>(key: string, fallback: T, validate?: Validator<T>): T {
  if (typeof localStorage === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    const parsed: unknown = JSON.parse(raw)
    if (validate) {
      const checked = validate(parsed)
      return checked === null ? fallback : checked
    }
    return parsed as T
  } catch {
    return fallback
  }
}

export function saveJson(key: string, value: unknown): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch { /* 配额满等场景静默 */ }
}

export function loadString(key: string): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function saveString(key: string, value: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(key, value)
  } catch { /* ignore */ }
}
