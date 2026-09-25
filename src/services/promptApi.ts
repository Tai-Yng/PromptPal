// Prompt API 服务 — 从社区提示词库（f/awesome-chatgpt-prompts，171k★）获取真实数据
// 数据源回退链：jsDelivr CDN → GitHub raw → 上次缓存 → 内置离线数据
import type { Prompt } from '../types'

const DATASET_SOURCES = [
  'https://cdn.jsdelivr.net/gh/f/awesome-chatgpt-prompts@main/prompts.csv',
  'https://raw.githubusercontent.com/f/awesome-chatgpt-prompts/main/prompts.csv',
]
const CACHE_KEY = 'promptpal_community_cache'
const CACHE_TTL = 24 * 60 * 60 * 1000
const FETCH_TIMEOUT = 10_000

let lastSource = ''

// 数据来源标注：'jsdelivr' | 'github' | 'cache' | 'offline'
export function getDatasetSource(): string {
  return lastSource
}

// 内置离线数据（数据源全部不可达时的兜底）
const MOCK_PROMPTS: Partial<Prompt>[] = [
  {
    id: 'net-1',
    title: 'React Component Generator',
    content: 'Create a React functional component with TypeScript props interface, including proper typing, JSDoc comments, and following React best practices. Component should accept children and optional callback props.',
    category: 'code',
    tags: ['react', 'typescript', 'component'],
    source: 'network',
    favorite: false,
    useCount: 0
  },
  {
    id: 'net-2',
    title: 'SQL Query Optimizer',
    content: 'Analyze the following SQL query and suggest optimizations for better performance. Include index recommendations, query restructuring, and explain the reasoning behind each suggestion.',
    category: 'code',
    tags: ['sql', 'database', 'optimization'],
    source: 'network',
    favorite: false,
    useCount: 0
  },
  {
    id: 'net-3',
    title: 'Creative Story Starter',
    content: 'Write an engaging opening paragraph for a [genre] story set in [setting]. The opening should establish the tone, introduce a compelling character, and create immediate intrigue.',
    category: 'writing',
    tags: ['creative', 'story', 'writing'],
    source: 'network',
    favorite: false,
    useCount: 0
  },
  {
    id: 'net-4',
    title: 'Midjourney Portrait Prompt',
    content: 'A stunning portrait of a [subject], [style] style, [lighting] lighting, [color palette] color palette, highly detailed, 8k resolution, professional photography, cinematic composition --ar 3:4 --v 6',
    category: 'image',
    tags: ['midjourney', 'ai-art', 'portrait'],
    source: 'network',
    favorite: false,
    useCount: 0
  },
  {
    id: 'net-5',
    title: 'Business Email Template',
    content: 'Write a professional business email to [recipient] regarding [topic]. The tone should be [formal/casual], concise, and include a clear call to action. Subject line should be compelling and specific.',
    category: 'other',
    tags: ['email', 'business', 'communication'],
    source: 'network',
    favorite: false,
    useCount: 0
  },
  {
    id: 'net-6',
    title: 'Python Data Analysis',
    content: 'Write Python code using pandas and matplotlib to analyze a dataset. Include data cleaning, exploratory data analysis with visualizations, and statistical insights. Use type hints and follow PEP 8 conventions.',
    category: 'code',
    tags: ['python', 'pandas', 'data-analysis'],
    source: 'network',
    favorite: false,
    useCount: 0
  },
  {
    id: 'net-7',
    title: 'Learning Path Generator',
    content: 'Create a structured learning path for mastering [skill/topic]. Break it down into beginner, intermediate, and advanced stages. Include recommended resources, practice projects, and estimated time commitment.',
    category: 'other',
    tags: ['education', 'learning', 'career'],
    source: 'network',
    favorite: false,
    useCount: 0
  },
  {
    id: 'net-8',
    title: 'API Documentation',
    content: 'Write clear API documentation for a RESTful endpoint including: endpoint URL, HTTP method, request parameters, request body schema, response format, error codes, and example requests/responses.',
    category: 'code',
    tags: ['api', 'documentation', 'rest'],
    source: 'network',
    favorite: false,
    useCount: 0
  },
  {
    id: 'net-9',
    title: 'Character Development',
    content: 'Develop a detailed character profile including: backstory, personality traits, motivations, flaws, relationships, and character arc. The character should feel authentic and have clear growth potential.',
    category: 'writing',
    tags: ['character', 'writing', 'creative'],
    source: 'network',
    favorite: false,
    useCount: 0
  },
]

// RFC4180 CSV 解析：支持引号字段、双引号转义、字段内换行
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.length > 1 || (row[0] ?? '') !== '') rows.push(row)
      row = []
    } else {
      field += c
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    if (row.length > 1 || (row[0] ?? '') !== '') rows.push(row)
  }
  return rows
}

// 按 act 标题粗略归类到应用的五个分类
function inferCategory(text: string): string {
  const t = text.toLowerCase()
  if (/(code|program|develop|sql|regex|debug|software|javascript|python|linux|terminal|git|ethicist hacker|cyber)/.test(t)) return 'code'
  if (/(image|art|design|midjourney|photograph|draw|logo|illustr|paint)/.test(t)) return 'image'
  if (/(writ|essay|story|novel|blog|poet|journal|edit|screenplay)/.test(t)) return 'writing'
  return 'chat'
}

function toPrompt(act: string, prompt: string, index: number): Partial<Prompt> {
  return {
    id: `net-${index}`,
    title: act || `Prompt ${index + 1}`,
    content: prompt,
    category: inferCategory(`${act} ${prompt}`),
    tags: ['community'],
    source: 'network',
    favorite: false,
    useCount: 0
  }
}

function parseDataset(csv: string): Partial<Prompt>[] {
  const rows = parseCsv(csv)
  const items: Partial<Prompt>[] = []
  // 首行为表头 act,prompt
  for (let i = 1; i < rows.length; i++) {
    const [act = '', prompt = ''] = rows[i]
    if (!prompt.trim()) continue
    items.push(toPrompt(act.trim(), prompt, items.length))
  }
  return items
}

async function fetchText(url: string, timeoutMs = FETCH_TIMEOUT): Promise<string> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

interface CacheShape { at: number; items: Partial<Prompt>[] }

// 加载社区提示词数据集，带缓存与多级回退；永不 reject
async function loadCommunityPrompts(): Promise<Partial<Prompt>[]> {
  // 1. 新鲜缓存直接用
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      const { at, items }: CacheShape = JSON.parse(cached)
      if (Array.isArray(items) && items.length > 0 && Date.now() - at < CACHE_TTL) {
        lastSource = 'cache'
        return items
      }
    }
  } catch { /* 缓存损坏则忽略，走网络 */ }

  // 2. 依次尝试数据源
  for (let i = 0; i < DATASET_SOURCES.length; i++) {
    try {
      const text = await fetchText(DATASET_SOURCES[i])
      const items = parseDataset(text)
      if (items.length > 0) {
        lastSource = i === 0 ? 'jsdelivr' : 'github'
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), items } satisfies CacheShape))
        } catch { /* 存储满则放弃缓存 */ }
        return items
      }
    } catch { /* 下一个源 */ }
  }

  // 3. 过期缓存兜底（比内置数据丰富）
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      const { items }: CacheShape = JSON.parse(cached)
      if (Array.isArray(items) && items.length > 0) {
        lastSource = 'cache'
        return items
      }
    }
  } catch { /* ignore */ }

  // 4. 内置离线数据
  lastSource = 'offline'
  return [...MOCK_PROMPTS]
}

// 搜索提示词
export async function searchPrompts(query: string, category?: string): Promise<Partial<Prompt>[]> {
  const dataset = await loadCommunityPrompts()
  let results = dataset

  if (query.trim()) {
    const lowerQuery = query.toLowerCase()
    results = results.filter(p =>
      p.title?.toLowerCase().includes(lowerQuery) ||
      p.content?.toLowerCase().includes(lowerQuery) ||
      p.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    )
  }

  if (category && category !== 'all') {
    results = results.filter(p => p.category === category)
  }

  const now = Date.now()
  return results.slice(0, 40).map((p, i) => ({
    ...p,
    id: `net-${now}-${i}`,
    createdAt: now,
    updatedAt: now
  }))
}

// 获取热门提示词
export async function getTrendingPrompts(limit: number = 10): Promise<Partial<Prompt>[]> {
  const dataset = await loadCommunityPrompts()
  const now = Date.now()
  return dataset.slice(0, limit).map((p, i) => ({
    ...p,
    id: `net-${now}-${i}`,
    createdAt: now,
    updatedAt: now
  }))
}

// 获取最新提示词
export async function getLatestPrompts(limit: number = 10): Promise<Partial<Prompt>[]> {
  const dataset = await loadCommunityPrompts()
  const now = Date.now()
  return dataset.slice(-limit).reverse().map((p, i) => ({
    ...p,
    id: `net-${now}-${i}`,
    createdAt: now,
    updatedAt: now
  }))
}
