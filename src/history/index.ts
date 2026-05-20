// PromptPal 类型定义

// Prompt项
export interface Prompt {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
  source: 'local' | 'network' | 'prompthero' | 'openart' | 'flowgpt'
  favorite: boolean
  useCount: number
  createdAt: number
  updatedAt: number
}

// 分类
export interface Category {
  id: string
  name: string
  icon: string
  color: string
  order: number
}

// 桌宠状态
export interface PetState {
  position: { x: number; y: number }
  expression: 'idle' | 'happy' | 'thinking' | 'sleepy'
  isDragging: boolean
}

// 网络搜索结果
export interface NetworkPrompt {
  id: string
  title: string
  content: string
  source: 'prompthero' | 'openart' | 'flowgpt'
  likes: number
  author: string
  url: string
}

// 应用设置
export interface AppSettings {
  theme: 'pink' | 'blue' | 'purple' | 'green'
  petSize: number
  panelWidth: number
  sidebarMode: boolean
  hotkey: string
  alwaysOnTop: boolean
}
