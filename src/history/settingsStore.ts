import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type AIProvider = 'openai' | 'deepseek' | 'claude' | 'custom'

export interface AIConfig {
  provider: AIProvider
  apiKey: string
  apiUrl: string
  model: string
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
    sleepTimeout: 120, // 休眠时间(秒)
    walkSpeed: 0.3,    // 走动速度 (0.1-1.0)
    defaultPromptId: '' as string  // 默认提示词 ID（双击复制）
  })

  // 预设配置
  const providerPresets: Record<AIProvider, { name: string; url: string; models: string[] }> = {
    openai: {
      name: 'OpenAI',
      url: 'https://api.openai.com/v1/chat/completions',
      models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo']
    },
    deepseek: {
      name: 'DeepSeek',
      url: 'https://api.deepseek.com/v1/chat/completions',
      models: ['deepseek-chat', 'deepseek-coder']
    },
    claude: {
      name: 'Claude',
      url: 'https://api.anthropic.com/v1/messages',
      models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku']
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

  return {
    aiConfig,
    petConfig,
    providerPresets,
    isConfigured,
    setProvider,
    updateConfig,
    updatePetConfig: (config: Partial<typeof petConfig.value>) => {
      petConfig.value = { ...petConfig.value, ...config }
      saveToStorage()
    },
    generatePrompt
  }
})
