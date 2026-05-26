import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type AIProvider = 'openai' | 'deepseek' | 'claude' | 'custom'

export interface AIConfig {
  provider: AIProvider
  apiKey: string
  apiUrl: string
  model: string
}

// 快捷方式类型
export interface Shortcut {
  id: string
  icon: string
  label: string
  type: 'app' | 'hotkey' | 'command'
  action: string
}

export const useSettingsStore = defineStore('settings', () => {
  // AI配置
  const aiConfig = ref<AIConfig>({
    provider: 'deepseek',
    apiKey: '',
    apiUrl: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat'
  })

  // 桌宠配置
  const petConfig = ref({
    sleepTimeout: 120,
    walkSpeed: 0.3,
    dblClickCopy: true,
    contextAware: true
  })

  // 快捷方式配置
  const shortcuts = ref<Shortcut[]>([
    { id: '1', icon: '🌐', label: '浏览器', type: 'app', action: 'https://www.google.com' },
    { id: '2', icon: '📁', label: '文件', type: 'app', action: 'explorer' },
    { id: '3', icon: '🔒', label: '锁屏', type: 'hotkey', action: 'win+l' },
    { id: '4', icon: '📋', label: '复制', type: 'hotkey', action: 'ctrl+c' },
  ])

  // Gitee 同步配置
  const giteeConfig = ref({
    token: '',
    owner: '',
    repo: '',
    path: 'promptpal_data.json',
    enabled: false
  })

  // 预设配置
  const providerPresets: Record<AIProvider, { name: string; url: string; models: string[] }> = {
    openai: {
      name: 'OpenAI',
      url: 'https://api.openai.com/v1/chat/completions',
      models: ['gpt-4.1', 'gpt-4o', 'gpt-4o-mini', 'o4-mini', 'o3-mini', 'gpt-4-turbo']
    },
    deepseek: {
      name: 'DeepSeek',
      url: 'https://api.deepseek.com/v1/chat/completions',
      models: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-coder', 'deepseek-v4', 'deepseek-v3']
    },
    claude: {
      name: 'Claude',
      url: 'https://api.anthropic.com/v1/messages',
      models: ['claude-sonnet-4-20250514', 'claude-3.5-sonnet', 'claude-3.5-haiku', 'claude-3-opus']
    },
    custom: {
      name: 'Custom',
      url: '',
      models: []
    }
  }

  // 是否已配置
  const isConfigured = computed(() => {
    return aiConfig.value.apiKey.length > 0 &&
           (aiConfig.value.provider !== 'custom' || aiConfig.value.apiUrl.length > 0)
  })

  // 更新提供商
  const setProvider = (provider: AIProvider) => {
    aiConfig.value.provider = provider
    if (provider !== 'custom') {
      aiConfig.value.apiUrl = providerPresets[provider].url
      aiConfig.value.model = providerPresets[provider].models[0]
    }
    saveToStorage()
  }

  // 更新配置
  const updateConfig = (config: Partial<AIConfig>) => {
    aiConfig.value = { ...aiConfig.value, ...config }
    saveToStorage()
  }

  // 保存到本地存储
  const saveToStorage = () => {
    localStorage.setItem('promptpal_ai_config', JSON.stringify(aiConfig.value))
    localStorage.setItem('promptpal_pet_config', JSON.stringify(petConfig.value))
    localStorage.setItem('promptpal_shortcuts', JSON.stringify(shortcuts.value))
    localStorage.setItem('promptpal_gitee_config', JSON.stringify(giteeConfig.value))
  }

  // 从本地存储加载
  const loadFromStorage = () => {
    const saved = localStorage.getItem('promptpal_ai_config')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        aiConfig.value = { ...aiConfig.value, ...parsed }
      } catch {}
    }
    const savedPet = localStorage.getItem('promptpal_pet_config')
    if (savedPet) {
      try {
        const parsed = JSON.parse(savedPet)
        petConfig.value = { ...petConfig.value, ...parsed }
      } catch {}
    }
    const savedShortcuts = localStorage.getItem('promptpal_shortcuts')
    if (savedShortcuts) {
      try {
        shortcuts.value = JSON.parse(savedShortcuts)
      } catch {}
    }
    const savedGitee = localStorage.getItem('promptpal_gitee_config')
    if (savedGitee) {
      try {
        giteeConfig.value = { ...giteeConfig.value, ...JSON.parse(savedGitee) }
      } catch {}
    }
  }

  // 快捷方式 CRUD
  const addShortcut = (shortcut: Omit<Shortcut, 'id'>) => {
    const newShortcut: Shortcut = { ...shortcut, id: crypto.randomUUID() }
    shortcuts.value.push(newShortcut)
    saveToStorage()
    return newShortcut
  }

  const updateShortcut = (id: string, updates: Partial<Shortcut>) => {
    const index = shortcuts.value.findIndex(s => s.id === id)
    if (index !== -1) {
      shortcuts.value[index] = { ...shortcuts.value[index], ...updates }
      saveToStorage()
    }
  }

  const deleteShortcut = (id: string) => {
    shortcuts.value = shortcuts.value.filter(s => s.id !== id)
    saveToStorage()
  }

  // AI生成Prompt
  const generatePrompt = async (input: string, mode: 'generate' | 'optimize' = 'generate'): Promise<string> => {
    if (!isConfigured.value) {
      throw new Error('AI not configured')
    }

    const config = aiConfig.value

    const systemPrompt = mode === 'generate'
      ? 'You are a prompt engineering expert. Generate a high-quality, detailed prompt based on the user\'s request. The prompt should be clear, specific, and optimized for AI tools like ChatGPT, Midjourney, or Claude.'
      : 'You are a prompt engineering expert. Optimize and improve the user\'s prompt to make it more effective, clear, and detailed. Fix any issues and enhance the prompt quality.'

    const userPrompt = mode === 'generate'
      ? `Generate a professional prompt for: ${input}`
      : `Optimize this prompt:\n\n${input}`

    // 根据不同提供商构建请求
    let requestBody: any
    let headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (config.provider === 'claude') {
      headers['x-api-key'] = config.apiKey
      headers['anthropic-version'] = '2023-06-01'
      requestBody = {
        model: config.model,
        max_tokens: 2000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      }
    } else {
      // OpenAI / DeepSeek / Custom (OpenAI compatible)
      headers['Authorization'] = `Bearer ${config.apiKey}`
      requestBody = {
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      }
    }

    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`API error: ${error}`)
    }

    const data = await response.json()

    // 解析不同格式的响应
    if (config.provider === 'claude') {
      return data.content?.[0]?.text || ''
    } else {
      return data.choices?.[0]?.message?.content || ''
    }
  }

  // 初始化
  loadFromStorage()

  // SSE流式生成Prompt
  const generatePromptStream = async (
    input: string,
    mode: 'generate' | 'optimize',
    onToken: (token: string) => void
  ): Promise<string> => {
    if (!isConfigured.value) {
      throw new Error('AI not configured')
    }

    const config = aiConfig.value

    const systemPrompt = mode === 'generate'
      ? 'You are a prompt engineering expert. Generate a high-quality, detailed prompt based on the user\'s request. The prompt should be clear, specific, and optimized for AI tools like ChatGPT, Midjourney, or Claude.'
      : 'You are a prompt engineering expert. Optimize and improve the user\'s prompt to make it more effective, clear, and detailed. Fix any issues and enhance the prompt quality.'

    const userPrompt = mode === 'generate'
      ? `Generate a professional prompt for: ${input}`
      : `Optimize this prompt:\n\n${input}`

    let requestBody: any
    let headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (config.provider === 'claude') {
      headers['x-api-key'] = config.apiKey
      headers['anthropic-version'] = '2023-06-01'
      requestBody = {
        model: config.model,
        max_tokens: 2000,
        stream: true,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      }
    } else {
      headers['Authorization'] = `Bearer ${config.apiKey}`
      requestBody = {
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
        stream: true
      }
    }

    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`API error: ${error}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let fullResponse = ''
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        if (trimmed === 'data: [DONE]') continue

        try {
          const json = JSON.parse(trimmed.slice(6))
          let token = ''
          if (config.provider === 'claude') {
            token = json.delta?.text || json.type === 'content_block_delta' ? json.delta?.text : ''
          } else {
            token = json.choices?.[0]?.delta?.content || ''
          }
          if (token) {
            fullResponse += token
            onToken(token)
          }
        } catch {
          // 跳过非JSON行
        }
      }
    }

    return fullResponse
  }

  return {
    aiConfig,
    petConfig,
    shortcuts,
    providerPresets,
    isConfigured,
    setProvider,
    updateConfig,
    updatePetConfig: (config: Partial<typeof petConfig.value>) => {
      petConfig.value = { ...petConfig.value, ...config }
      saveToStorage()
    },
    updateGiteeConfig: (config: Partial<typeof giteeConfig.value>) => {
      giteeConfig.value = { ...giteeConfig.value, ...config }
      saveToStorage()
    },
    giteeConfig,
    saveToStorage,
    loadFromStorage,
    addShortcut,
    updateShortcut,
    deleteShortcut,
    generatePrompt,
    generatePromptStream
  }
})
