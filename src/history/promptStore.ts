import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Prompt, Category } from '../types'
import { copyToClipboard as platformCopy } from '../services/platform'

export const usePromptStore = defineStore('prompt', () => {
  // 状态
  const prompts = ref<Prompt[]>([])
  const categories = ref<Category[]>([
    { id: 'chat', name: '对话AI', icon: '💬', color: '#FF6B9D', order: 0 },
    { id: 'image', name: '图像生成', icon: '🎨', color: '#7DD3FC', order: 1 },
    { id: 'code', name: '编程助手', icon: '💻', color: '#6EE7B7', order: 2 },
    { id: 'writing', name: '写作助手', icon: '✍️', color: '#FCD34D', order: 3 },
    { id: 'other', name: '其他', icon: '📦', color: '#C4B5FD', order: 4 },
  ])
  const searchQuery = ref('')
  const selectedCategory = ref<string | null>(null)
  const showFavorites = ref(false)

  // 计算属性
  const filteredPrompts = computed(() => {
    let result = prompts.value

    // 按分类过滤
    if (selectedCategory.value) {
      result = result.filter(p => p.category === selectedCategory.value)
    }

    // 只显示收藏
    if (showFavorites.value) {
      result = result.filter(p => p.favorite)
    }

    // 搜索过滤
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase()
      result = result.filter(p => 
        p.title.toLowerCase().includes(query) ||
        p.content.toLowerCase().includes(query) ||
        p.tags.some(t => t.toLowerCase().includes(query))
      )
    }

    // 按使用次数排序
    return result.sort((a, b) => b.useCount - a.useCount)
  })

  // 方法
  const addPrompt = (prompt: Omit<Prompt, 'id' | 'useCount' | 'createdAt' | 'updatedAt'>) => {
    const newPrompt: Prompt = {
      ...prompt,
      id: crypto.randomUUID(),
      useCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    prompts.value.push(newPrompt)
    saveToLocalStorage()
    return newPrompt
  }

  const updatePrompt = (id: string, updates: Partial<Prompt>) => {
    const index = prompts.value.findIndex(p => p.id === id)
    if (index !== -1) {
      prompts.value[index] = {
        ...prompts.value[index],
        ...updates,
        updatedAt: Date.now()
      }
      saveToLocalStorage()
    }
  }

  const deletePrompt = (id: string) => {
    const index = prompts.value.findIndex(p => p.id === id)
    if (index !== -1) {
      prompts.value.splice(index, 1)
      saveToLocalStorage()
    }
  }

  const toggleFavorite = (id: string) => {
    const prompt = prompts.value.find(p => p.id === id)
    if (prompt) {
      prompt.favorite = !prompt.favorite
      prompt.updatedAt = Date.now()
      saveToLocalStorage()
    }
  }

  const incrementUseCount = (id: string) => {
    const prompt = prompts.value.find(p => p.id === id)
    if (prompt) {
      prompt.useCount++
      prompt.updatedAt = Date.now()
      saveToLocalStorage()
    }
  }

  const copyToClipboard = async (content: string) => {
    try {
      return await platformCopy(content)
    } catch {
      // 降级方案
      const textarea = document.createElement('textarea')
      textarea.value = content
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      const success = document.execCommand('copy')
      document.body.removeChild(textarea)
      return success
    }
  }

  // 本地存储
  const saveToLocalStorage = () => {
    localStorage.setItem('promptpal_prompts', JSON.stringify(prompts.value))
    localStorage.setItem('promptpal_categories', JSON.stringify(categories.value))
  }

  const loadFromLocalStorage = () => {
    const savedPrompts = localStorage.getItem('promptpal_prompts')
    const savedCategories = localStorage.getItem('promptpal_categories')
    
    if (savedPrompts) {
      prompts.value = JSON.parse(savedPrompts)
    }
    if (savedCategories) {
      categories.value = JSON.parse(savedCategories)
    }
  }

  // 导入导出
  const exportData = () => {
    return {
      prompts: prompts.value,
      categories: categories.value,
      exportedAt: new Date().toISOString()
    }
  }

  const importData = (data: { prompts: Prompt[], categories?: Category[] }) => {
    prompts.value = data.prompts
    if (data.categories) {
      categories.value = data.categories
    }
    saveToLocalStorage()
  }

  // 初始化
  loadFromLocalStorage()

  // 添加示例数据
  if (prompts.value.length === 0) {
    addPrompt({
      title: '专业翻译助手',
      content: '你是一位专业的翻译专家，精通中文、英文、日文等多种语言。请将用户输入的内容翻译成目标语言，保持原文的语气和风格，并提供必要的注释说明。',
      category: 'chat',
      tags: ['翻译', '多语言'],
      source: 'local',
      favorite: true
    })
    addPrompt({
      title: 'Midjourney 风景画',
      content: 'A breathtaking landscape, golden hour lighting, dramatic clouds over mountains, reflection in crystal clear lake, ultra detailed, 8k resolution, cinematic composition --ar 16:9 --v 5',
      category: 'image',
      tags: ['Midjourney', '风景', '8K'],
      source: 'local',
      favorite: false
    })
    addPrompt({
      title: '代码审查专家',
      content: '你是一位资深的代码审查专家。请审查用户提供的代码，关注以下方面：1. 代码质量和可读性 2. 潜在的bug和安全问题 3. 性能优化建议 4. 最佳实践建议。请用清晰的格式列出问题和改进建议。',
      category: 'code',
      tags: ['代码审查', '最佳实践'],
      source: 'local',
      favorite: true
    })
    addPrompt({
      title: '创意写作助手',
      content: '你是一位富有创意的写作助手，擅长各种文体创作。帮助用户：1. 构思故事情节和人物设定 2. 润色文字表达 3. 提供写作技巧建议 4. 克服写作障碍。请用生动有趣的语言与用户交流。',
      category: 'writing',
      tags: ['写作', '创意', '故事'],
      source: 'local',
      favorite: false
    })
  }

  return {
    prompts,
    categories,
    searchQuery,
    selectedCategory,
    showFavorites,
    filteredPrompts,
    addPrompt,
    updatePrompt,
    deletePrompt,
    toggleFavorite,
    incrementUseCount,
    copyToClipboard,
    exportData,
    importData
  }
})
