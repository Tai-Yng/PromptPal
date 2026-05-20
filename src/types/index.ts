export interface Prompt {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
  source: 'local' | 'network'
  favorite: boolean
  useCount: number
  createdAt: number
  updatedAt: number
}

export interface Category {
  id: string
  name: string
  icon: string
  color: string
  order: number
}
