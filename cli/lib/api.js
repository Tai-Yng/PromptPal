// API 服务 - 与 PromptPal 共享数据
import Conf from 'conf';
import fs from 'fs';
import path from 'path';
import os from 'os';

// 模拟的提示词数据
const MOCK_PROMPTS = [
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
];

// 获取本地存储的 prompts
function getLocalPrompts() {
  try {
    // 尝试从 PromptPal 的 localStorage 读取
    const configPath = path.join(os.homedir(), '.promptpal', 'prompts.json');
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    // 忽略错误，使用模拟数据
  }
  return [];
}

// 保存 prompts 到本地
function saveLocalPrompts(prompts) {
  try {
    const configDir = path.join(os.homedir(), '.promptpal');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    const configPath = path.join(configDir, 'prompts.json');
    fs.writeFileSync(configPath, JSON.stringify(prompts, null, 2));
  } catch (e) {
    console.error('Failed to save prompts:', e.message);
  }
}

// 搜索提示词
export async function searchPrompts(query, category) {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  let results = [...MOCK_PROMPTS, ...getLocalPrompts()];
  
  if (query && query.trim()) {
    const lowerQuery = query.toLowerCase();
    results = results.filter(p => 
      p.title?.toLowerCase().includes(lowerQuery) ||
      p.content?.toLowerCase().includes(lowerQuery) ||
      p.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }
  
  if (category && category !== 'all') {
    results = results.filter(p => p.category === category);
  }
  
  return results;
}

// 获取热门提示词
export async function getTrendingPrompts(limit = 10) {
  await new Promise(resolve => setTimeout(resolve, 200));
  const all = [...MOCK_PROMPTS, ...getLocalPrompts()];
  return all.slice(0, limit);
}

// 获取最新提示词
export async function getLatestPrompts(limit = 10) {
  await new Promise(resolve => setTimeout(resolve, 200));
  const all = [...MOCK_PROMPTS, ...getLocalPrompts()].reverse();
  return all.slice(0, limit);
}

// 添加提示词
export function addPrompt(prompt) {
  const prompts = getLocalPrompts();
  const newPrompt = {
    ...prompt,
    id: `local-${Date.now()}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    source: 'local',
    useCount: 0
  };
  prompts.push(newPrompt);
  saveLocalPrompts(prompts);
  return newPrompt;
}
