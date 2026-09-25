// 桌宠上下文感知：检测活跃窗口标题，匹配规则后弹出提示词建议气泡
// 从 DesktopPet.vue 机械搬移，行为保持不变
import { ref, type Ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { usePromptStore } from '../stores/promptStore'
import { useSettingsStore } from '../stores/settingsStore'
import { loadJson } from '../services/storage'
import type { PetState } from './usePetMovement'

export function useContextSuggest(options: { state: Ref<PetState>; isDragging: Ref<boolean> }) {
  const { state, isDragging } = options
  const settingsStore = useSettingsStore()

  const showSuggestBubble = ref(false)
  const suggestPromptTitle = ref('')
  const suggestPromptContent = ref('')
  const suggestPromptId = ref('')
  let suggestDismissTimer: number | null = null
  let contextTimer: number | null = null
  const contextCooldown: Record<string, number> = {}

  // 窗口标题 → 推荐 Prompt 类别
  const contextRules: { pattern: RegExp; category: string }[] = [
    { pattern: /chat\.openai\.com|chatgpt/i, category: 'chat' },
    { pattern: /DeepSeek|deepseek/i, category: 'chat' },
    { pattern: /Visual Studio Code|VS Code/i, category: 'code' },
    { pattern: /Cursor|Windsurf/i, category: 'code' },
    { pattern: /Midjourney|Discord.*Midjourney/i, category: 'image' },
    { pattern: /翻译|translate/i, category: 'chat' },
    { pattern: /Notion|Obsidian/i, category: 'writing' },
    { pattern: /Claude|claude/i, category: 'chat' },
  ]

  const suggestCopyAndDismiss = async () => {
    if (!suggestPromptContent.value) return
    const store = usePromptStore()
    try {
      const { writeText } = await import('@tauri-apps/plugin-clipboard-manager')
      await writeText(suggestPromptContent.value)
    } catch {
      await navigator.clipboard.writeText(suggestPromptContent.value)
    }
    store.incrementUseCount(suggestPromptId.value)
    showSuggestBubble.value = false
  }

  const dismissSuggest = () => {
    showSuggestBubble.value = false
  }

  // 每 5 秒检测一次活跃窗口
  const checkContext = async () => {
    if (state.value === 'sleeping' || isDragging.value || showSuggestBubble.value) return
    if (!settingsStore.petConfig.contextAware) return

    try {
      const title: string = await invoke('get_active_window_title')
      if (!title) return

      // 防打扰：同一标题 30 分钟内只提示一次
      const now = Date.now()
      const key = title.slice(0, 50)
      if (contextCooldown[key] && now - contextCooldown[key] < 30 * 60 * 1000) return

      // 匹配规则
      for (const rule of contextRules) {
        if (rule.pattern.test(title)) {
          contextCooldown[key] = now

          // 找到匹配的 Prompt
          const store = usePromptStore()
          store.prompts = loadJson('promptpal_prompts', store.prompts)

          const match = store.prompts.find(p => p.category === rule.category && p.favorite)
            || store.prompts.find(p => p.category === rule.category)

          if (match) {
            suggestPromptTitle.value = match.title
            suggestPromptContent.value = match.content
            suggestPromptId.value = match.id
            showSuggestBubble.value = true

            // 5 秒后自动消失
            if (suggestDismissTimer) clearTimeout(suggestDismissTimer)
            suggestDismissTimer = window.setTimeout(() => {
              showSuggestBubble.value = false
            }, 5000)
          }
          break
        }
      }
    } catch {/* ignore */}
  }

  const init = () => {
    contextTimer = window.setInterval(checkContext, 5000)
  }

  const cleanup = () => {
    if (contextTimer) clearInterval(contextTimer)
    if (suggestDismissTimer) clearTimeout(suggestDismissTimer)
  }

  return {
    showSuggestBubble, suggestPromptTitle, suggestPromptContent,
    suggestCopyAndDismiss, dismissSuggest,
    init, cleanup
  }
}
