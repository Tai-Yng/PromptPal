// Prompt API 服务 - 从网络获取提示词
import type { Prompt } from '../types'

// 模拟的提示词数据源（实际项目中可以替换为真实 API）
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
    category: 'art',
    tags: ['midjourney', 'ai-art', 'portrait'],
    source: 'network',
    favorite: false,
    useCount: 0
  },
  {
    id: 'net-5',
    title: 'Business Email Template',
    content: 'Write a professional business email to [recipient] regarding [topic]. The tone should be [formal/casual], concise, and include a clear call to action. Subject line should be compelling and specific.',
    category: 'business',
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
    title: 'Game Design Document',
    content: 'Create a concise game design document outline for a [genre] game. Include core mechanics, target audience, unique selling points, and monetization strategy. Format as a professional pitch document.',
    category: 'game',
    tags: ['gamedev', 'design', 'documentation'],
    source: 'network',
    favorite: false,
    useCount: 0
  },
  {
    id: 'net-8',
    title: 'Learning Path Generator',
    content: 'Create a structured learning path for mastering [skill/topic]. Break it down into beginner, intermediate, and advanced stages. Include recommended resources, practice projects, and estimated time commitment.',
    category: 'learning',
    tags: ['education', 'learning', 'career'],
    source: 'network',
    favorite: false,
    useCount: 0
  },
  {
    id: 'net-9',
    title: 'Code Review Checklist',
    content: 'Provide a comprehensive code review checklist covering: code quality, security, performance, maintainability, and testing. Include specific items to check for [language/framework] projects.',
    category: 'code',
    tags: ['code-review', 'best-practices', 'quality'],
    source: 'network',
    favorite: false,
    useCount: 0
  },
  {
    id: 'net-10',
    title: 'Social Media Content',
    content: 'Generate 5 engaging social media posts for [platform] about [topic]. Include a mix of educational, entertaining, and promotional content. Each post should have appropriate hashtags and call-to-action.',
    category: 'business',
    tags: ['social-media', 'marketing', 'content'],
    source: 'network',
    favorite: false,
    useCount: 0
  },
  {
    id: 'net-11',
    title: 'API Documentation',
    content: 'Write clear API documentation for a RESTful endpoint including: endpoint URL, HTTP method, request parameters, request body schema, response format, error codes, and example requests/responses.',
    category: 'code',
    tags: ['api', 'documentation', 'rest'],
    source: 'network',
    favorite: false,
    useCount: 0
  },
  {
    id: 'net-12',
    title: 'Character Development',
    content: 'Develop a detailed character profile including: backstory, personality traits, motivations, flaws, relationships, and character arc. The character should feel authentic and have clear growth potential.',
    category: 'writing',
    tags: ['character', 'writing', 'creative'],
    source: 'network',
    favorite: false,
    useCount: 0
  }
]

// 搜索提示词
export async function searchPrompts(query: string, category?: string): Promise<Partial<Prompt>[]> {
  // 模拟网络延迟
  await new Promise(resolve => setTimeout(resolve, 800))

  let results = [...MOCK_PROMPTS]

  // 根据查询过滤
  if (query.trim()) {
    const lowerQuery = query.toLowerCase()
    results = results.filter(p =>
      p.title?.toLowerCase().includes(lowerQuery) ||
      p.content?.toLowerCase().includes(lowerQuery) ||
      p.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    )
  }

  // 根据分类过滤
  if (category && category !== 'all') {
    results = results.filter(p => p.category === category)
  }

  // 添加唯一 ID 和时间戳
  return results.map(p => ({
    ...p,
    id: `net-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }))
}

// 获取热门提示词
export async function getTrendingPrompts(limit: number = 10): Promise<Partial<Prompt>[]> {
  await new Promise(resolve => setTimeout(resolve, 600))

  return MOCK_PROMPTS.slice(0, limit).map(p => ({
    ...p,
    id: `net-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }))
}

// 获取最新提示词
export async function getLatestPrompts(limit: number = 10): Promise<Partial<Prompt>[]> {
  await new Promise(resolve => setTimeout(resolve, 600))

  return [...MOCK_PROMPTS].reverse().slice(0, limit).map(p => ({
    ...p,
    id: `net-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }))
}

// 从真实 API 获取（预留接口）
export async function fetchFromRealAPI(_endpoint: string, _params?: Record<string, string>): Promise<any> {
  // 这里可以接入真实的提示词网站 API
  // 例如: PromptHero, FlowGPT, etc.

  // 示例:
  // const response = await fetch(`https://api.prompthero.com/${endpoint}`, {
  //   headers: { 'Authorization': `Bearer ${API_KEY}` }
  // })
  // return response.json()

  throw new Error('Real API not configured. Use mock data for now.')
}
