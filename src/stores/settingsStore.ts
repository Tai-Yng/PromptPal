import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { loadJson, saveJson, ensureSchemaVersion, type Validator } from '../services/storage'

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
    contextAware: true,
    // AI 代理状态联动（v1.6）：总开关默认关，超时 30–300s 可调
    agentLink: false,
    agentLinkTimeoutMs: 90000
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

  // 保存到本地存储（经统一存储层）
  const saveToStorage = () => {
    saveJson('promptpal_ai_config', aiConfig.value)
    saveJson('promptpal_pet_config', petConfig.value)
    saveJson('promptpal_shortcuts', shortcuts.value)
    saveJson('promptpal_gitee_config', giteeConfig.value)
  }

  // 保留"默认值合并"语义：存量数据缺字段时回落默认而非整体替换
  const mergeValidator = <T extends object>(base: T): Validator<T> =>
    (raw) => (raw && typeof raw === 'object' && !Array.isArray(raw)) ? { ...base, ...(raw as T) } : null

  // 从本地存储加载
  const loadFromStorage = () => {
    ensureSchemaVersion()
    aiConfig.value = loadJson('promptpal_ai_config', aiConfig.value, mergeValidator(aiConfig.value))
    petConfig.value = loadJson('promptpal_pet_config', petConfig.value, mergeValidator(petConfig.value))
    shortcuts.value = loadJson('promptpal_shortcuts', shortcuts.value)
    giteeConfig.value = loadJson('promptpal_gitee_config', giteeConfig.value, mergeValidator(giteeConfig.value))
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

  // 构建聊天补全请求（generatePrompt / generatePromptStream / 连接测试共用）
  const buildChatRequest = (
    config: AIConfig,
    mode: 'generate' | 'optimize',
    input: string,
    stream: boolean
  ): { url: string; headers: Record<string, string>; body: Record<string, unknown> } => {
    const systemPrompt = mode === 'generate'
      ? 'You are a prompt engineering expert. Generate a high-quality, detailed prompt based on the user\'s request. The prompt should be clear, specific, and optimized for AI tools like ChatGPT, Midjourney, or Claude.'
      : 'You are a prompt engineering expert. Optimize and improve the user\'s prompt to make it more effective, clear, and detailed. Fix any issues and enhance the prompt quality.'

    const userPrompt = mode === 'generate'
      ? `Generate a professional prompt for: ${input}`
      : `Optimize this prompt:\n\n${input}`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    let body: Record<string, unknown>
    if (config.provider === 'claude') {
      // Claude Messages API：system 是顶层字段，不接受 role:'system' 消息
      headers['x-api-key'] = config.apiKey
      headers['anthropic-version'] = '2023-06-01'
      body = {
        model: config.model,
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        stream
      }
    } else {
      // OpenAI / DeepSeek / Custom (OpenAI compatible)
      headers['Authorization'] = `Bearer ${config.apiKey}`
      body = {
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
        stream
      }
    }
    return { url: config.apiUrl, headers, body }
  }

  // AI生成Prompt
  const generatePrompt = async (input: string, mode: 'generate' | 'optimize' = 'generate'): Promise<string> => {
    if (!isConfigured.value) {
      throw new Error('AI not configured')
    }

    const config = aiConfig.value
    const { url, headers, body } = buildChatRequest(config, mode, input, false)

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`API error: ${error}`)
    }

    const data = await response.json()

    // 解析不同格式的响应
    if (config.provider === 'claude') {
      // content 是内容块数组，取所有 text 块拼接
      return Array.isArray(data.content)
        ? data.content.map((b: { text?: string }) => b?.text || '').join('')
        : ''
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
    const { url, headers, body } = buildChatRequest(config, mode, input, true)

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
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
            if (json.type === 'error') {
              throw new Error(json.error?.message || 'stream error')
            }
            // 只取 text_delta 事件中的文本
            token = json.type === 'content_block_delta' && json.delta?.type === 'text_delta'
              ? (json.delta?.text || '')
              : ''
          } else {
            token = json.choices?.[0]?.delta?.content || ''
          }
          if (token) {
            fullResponse += token
            onToken(token)
          }
        } catch (e) {
          // 解析失败则跳过非JSON行，但 stream error 要抛出
          if (e instanceof Error && e.message === 'stream error') throw e
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
    buildChatRequest,
    generatePrompt,
    generatePromptStream
  }
})
