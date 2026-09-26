import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Prompt, Category } from '../types'
import { copyToClipboard as platformCopy } from '../services/platform'
import { loadJson, saveJson, loadString, saveString, ensureSchemaVersion, type Validator } from '../services/storage'

// 防抖自动导出到文件
let autoExportTimer: number | null = null
const autoExport = () => {
  if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
    if (autoExportTimer) clearTimeout(autoExportTimer)
    autoExportTimer = window.setTimeout(async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const prompts = loadString('promptpal_prompts') || '[]'
        const categories = loadString('promptpal_categories') || '[]'
        const aiConfig = loadString('promptpal_ai_config') || '{}'
        const petConfig = loadString('promptpal_pet_config') || '{}'
        const petStyle = loadString('promptpal_pet_style') || '{}'
        await invoke('sync_save', {
          data: JSON.stringify({
            prompts, categories, aiConfig, petConfig, petStyle,
            exportedAt: new Date().toISOString()
          })
        })
        // 数据已变更：通知 Gitee 自动同步（60s 防抖，未启用则内部直接跳过）
        const { notifyDataChanged } = await import('../services/autoSync')
        notifyDataChanged()
      } catch { /* ignore */ }
    }, 2000)
  }
}

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
  const defaultPromptId = ref<string | null>(null)

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

  // 默认提示词
  const defaultPrompt = computed(() => {
    if (!defaultPromptId.value) return null
    return prompts.value.find(p => p.id === defaultPromptId.value) || null
  })

  // 方法
  const addPrompt = (prompt: Omit<Prompt, 'id' | 'useCount' | 'createdAt' | 'updatedAt'>) => {
    // 入口守卫：拒绝事件对象等非法输入（曾有 MouseEvent 被误传入库，污染数据文件）
    if (!prompt || typeof prompt !== 'object'
      || typeof (prompt as any).title !== 'string'
      || typeof (prompt as any).content !== 'string') {
      console.error('addPrompt rejected invalid input:', prompt)
      return null
    }
    const newPrompt: Prompt = {
      ...prompt,
      id: crypto.randomUUID(),
      useCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    prompts.value.push(newPrompt)
    // 如果是第一个提示词，自动设为默认
    if (prompts.value.length === 1) {
      defaultPromptId.value = newPrompt.id
    }
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
      // 如果删除的是默认提示词，清除默认设置
      if (defaultPromptId.value === id) {
        defaultPromptId.value = prompts.value.length > 0 ? prompts.value[0].id : null
      }
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
    // platform 层已含 navigator.clipboard → execCommand 完整降级链
    return platformCopy(content)
  }

  // 设置默认提示词
  const setDefaultPrompt = (id: string | null) => {
    if (id === null || prompts.value.find(p => p.id === id)) {
      defaultPromptId.value = id
      saveToLocalStorage()
    }
  }

  // 校验并规整单条提示词（损坏数据不应让应用启动失败）
  const sanitizePrompt = (raw: any, index: number): Prompt | null => {
    if (!raw || typeof raw !== 'object' || typeof raw.content !== 'string') return null
    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : `recovered-${Date.now()}-${index}`,
      title: typeof raw.title === 'string' && raw.title ? raw.title : 'Untitled',
      content: raw.content,
      category: typeof raw.category === 'string' ? raw.category : 'other',
      tags: Array.isArray(raw.tags) ? raw.tags.filter((t: unknown) => typeof t === 'string') : [],
      source: raw.source === 'network' ? 'network' : 'local',
      favorite: !!raw.favorite,
      useCount: typeof raw.useCount === 'number' && Number.isFinite(raw.useCount) ? raw.useCount : 0,
      createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
      updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now()
    }
  }

  // 本地存储（经统一存储层，数据损坏时回退默认值而不是崩溃）
  const promptsValidator: Validator<Prompt[]> = (raw) => {
    if (!Array.isArray(raw)) return null
    return raw
      .map((p: any, i: number) => sanitizePrompt(p, i))
      .filter((p: Prompt | null): p is Prompt => p !== null)
  }

  const categoriesValidator: Validator<Category[]> = (raw) => {
    if (!Array.isArray(raw) || raw.length === 0) return null
    return raw.filter((c: any) => c && typeof c.id === 'string' && typeof c.name === 'string')
  }

  const saveToLocalStorage = () => {
    saveJson('promptpal_prompts', prompts.value)
    saveJson('promptpal_categories', categories.value)
    saveString('promptpal_default_prompt_id', defaultPromptId.value || '')
    autoExport()
  }

  const loadFromLocalStorage = () => {
    ensureSchemaVersion()
    prompts.value = loadJson('promptpal_prompts', prompts.value, promptsValidator)
    categories.value = loadJson('promptpal_categories', categories.value, categoriesValidator)
    const savedDefaultId = loadString('promptpal_default_prompt_id')
    if (savedDefaultId) {
      defaultPromptId.value = savedDefaultId
    }
  }

  // 导入导出
  const exportData = () => {
    return {
      prompts: prompts.value,
      categories: categories.value,
      defaultPromptId: defaultPromptId.value,
      exportedAt: new Date().toISOString()
    }
  }

  const importData = (data: { prompts: Prompt[], categories?: Category[], defaultPromptId?: string | null }) => {
    if (!data || !Array.isArray(data.prompts)) {
      throw new Error('Invalid data format: prompts array expected')
    }
    // 校验并按 id 去重（后出现的覆盖先出现的）
    const byId = new Map<string, Prompt>()
    data.prompts.forEach((p: any, i: number) => {
      const sanitized = sanitizePrompt(p, i)
      if (sanitized) byId.set(sanitized.id, sanitized)
    })
    prompts.value = [...byId.values()]
    if (data.categories && Array.isArray(data.categories)) {
      categories.value = data.categories
    }
    if (data.defaultPromptId !== undefined) {
      defaultPromptId.value = data.defaultPromptId
    }
    // 校验默认提示词仍然存在
    if (defaultPromptId.value && !byId.has(defaultPromptId.value)) {
      defaultPromptId.value = prompts.value.length > 0 ? prompts.value[0].id : null
    }
    saveToLocalStorage()
  }

  // 初始化
  loadFromLocalStorage()

  // 添加示例数据
  if (prompts.value.length === 0) {
    const p1 = addPrompt({
      title: '专业翻译助手',
      content: '你是一位专业的翻译专家，精通中文、英文、日文等多种语言。请将用户输入的内容翻译成目标语言，保持原文的语气和风格，并提供必要的注释说明。',
      category: 'chat',
      tags: ['翻译', '多语言'],
      source: 'local',
      favorite: true
    })
    // 将第一个设为默认（内置样例必然通过守卫）
    if (p1) defaultPromptId.value = p1.id
    
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
    
    saveToLocalStorage()
  }

  return {
    prompts,
    categories,
    searchQuery,
    selectedCategory,
    showFavorites,
    defaultPromptId,
    defaultPrompt,
    filteredPrompts,
    addPrompt,
    updatePrompt,
    deletePrompt,
    toggleFavorite,
    incrementUseCount,
    copyToClipboard,
    setDefaultPrompt,
    exportData,
    importData,
    reloadFromStorage: loadFromLocalStorage
  }
})
