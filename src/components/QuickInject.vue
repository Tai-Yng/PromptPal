<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { usePromptStore } from '../stores/promptStore'
import { loadJson, loadString } from '../services/storage'
import { parseVariables } from '../services/variables'
import VariableFillDialog from './VariableFillDialog.vue'

const store = usePromptStore()
const searchQuery = ref('')
const selectedIndex = ref(0)
const searchInputRef = ref<HTMLInputElement | null>(null)
const fillPrompt = ref<any>(null)

// 分类色点（与 PromptCard 一致）
const catColors: Record<string, string> = {
  chat: '#818CF8',
  image: '#A78BFA',
  code: '#22D3EE',
  writing: '#F59E0B',
  other: '#6B7280'
}
const catColor = (category: string) => catColors[category] || '#6B7280'

// 从 localStorage 同步最新数据（跨窗口）
onMounted(() => {
  store.prompts = loadJson('promptpal_prompts', store.prompts)
  const defId = loadString('promptpal_default_prompt_id')
  if (defId) store.defaultPromptId = defId
  searchInputRef.value?.focus()
})

// 搜索输入变化时选中位归零
watch(searchQuery, () => { selectedIndex.value = 0 })

const filteredPrompts = computed(() => {
  // 收藏优先 → useCount 降序
  const sorted = [...store.prompts].sort((a, b) =>
    (Number(b.favorite) - Number(a.favorite)) || (b.useCount - a.useCount)
  )
  if (!searchQuery.value.trim()) {
    return sorted.slice(0, 8)
  }
  const q = searchQuery.value.toLowerCase()
  return sorted.filter(p =>
    p.title.toLowerCase().includes(q) ||
    p.content.toLowerCase().includes(q) ||
    p.tags.some(t => t.toLowerCase().includes(q))
  ).slice(0, 8)
})

const visibleCount = computed(() => Math.max(1, filteredPrompts.value.length))

// 键盘导航（填空弹窗打开时让位给弹窗自己处理）
const handleKeyDown = async (e: KeyboardEvent) => {
  if (fillPrompt.value) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex.value = (selectedIndex.value + 1) % visibleCount.value
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = (selectedIndex.value - 1 + visibleCount.value) % visibleCount.value
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (filteredPrompts.value.length > 0) {
      await handleSelect(filteredPrompts.value[selectedIndex.value])
    }
  } else if (e.key === 'Escape') {
    e.preventDefault()
    await invoke('quick_inject_done').catch(() => {})
  }
}

// 复制到剪贴板
const writeClipboard = async (text: string) => {
  try {
    const { writeText } = await import('@tauri-apps/plugin-clipboard-manager')
    await writeText(text)
    return true
  } catch {
    await navigator.clipboard.writeText(text)
    return true
  }
}

const closeWindow = async () => {
  await invoke('quick_inject_done').catch(() => {})
}

// 选中：含变量 → 弹填空；无变量 → 复制并关窗
const handleSelect = async (prompt: any) => {
  if (parseVariables(String(prompt?.content ?? '')).length > 0) {
    fillPrompt.value = prompt
    return
  }
  await writeClipboard(prompt.content)
  store.incrementUseCount(prompt.id)
  await closeWindow()
}

const handleFillConfirm = async (text: string) => {
  const p = fillPrompt.value
  fillPrompt.value = null
  if (!p) return
  await writeClipboard(text)
  store.incrementUseCount(p.id)
  await closeWindow()
}

const handleCopyOriginal = async () => {
  const p = fillPrompt.value
  fillPrompt.value = null
  if (!p) return
  await writeClipboard(p.content)
  store.incrementUseCount(p.id)
  await closeWindow()
}

onMounted(() => { window.addEventListener('keydown', handleKeyDown) })
onUnmounted(() => { window.removeEventListener('keydown', handleKeyDown) })
</script>

<template>
  <div class="qi-overlay">
    <!-- 搜索框 -->
    <div class="qi-search">
      <div class="terminal-input-wrap">
        <span class="terminal-prompt">$</span>
        <input
          ref="searchInputRef"
          v-model="searchQuery"
          class="terminal-input"
          placeholder="search prompts..."
          spellcheck="false"
        />
      </div>
      <span class="qi-hint">[Ctrl+Alt+P]</span>
    </div>

    <!-- Prompt 列表 -->
    <div class="qi-list">
      <div
        v-for="(prompt, idx) in filteredPrompts"
        :key="prompt.id"
        class="qi-item"
        :class="{ active: idx === selectedIndex }"
        @click="handleSelect(prompt)"
        @mouseenter="selectedIndex = idx"
      >
        <span class="qi-idx">{{ idx + 1 }}</span>
        <span class="qi-dot" :style="{ background: catColor(prompt.category) }"></span>
        <div class="qi-info">
          <span class="qi-title">
            <span class="qi-prompt">&gt;</span>
            {{ prompt.title }}
            <span v-if="prompt.favorite" class="qi-fav">*</span>
          </span>
          <span class="qi-tags">
            <span v-for="tag in prompt.tags.slice(0, 3)" :key="tag" class="tag">{{ tag }}</span>
          </span>
        </div>
        <span class="qi-usage">{{ prompt.useCount }}x</span>
      </div>

      <!-- 空状态 -->
      <div v-if="filteredPrompts.length === 0" class="qi-empty">
        <span class="empty-msg">[0] no results</span>
      </div>
    </div>

    <!-- 底部提示 -->
    <div class="qi-footer">
      <span class="footer-key">&uarr;&darr;</span> nav
      <span class="footer-key">&crarr;</span> select
      <span class="footer-key">Esc</span> close
    </div>

    <!-- 变量填空弹窗 -->
    <VariableFillDialog
      v-if="fillPrompt"
      :prompt-id="fillPrompt.id"
      :title="fillPrompt.title"
      :content="fillPrompt.content"
      @confirm="handleFillConfirm"
      @copy-original="handleCopyOriginal"
      @close="fillPrompt = null"
    />
  </div>
</template>

<style scoped>
.qi-overlay {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-mono);
  overflow: hidden;
  user-select: none;
}

/* ── Search ── */
.qi-search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}
.qi-search .terminal-input-wrap { flex: 1; }
.qi-hint {
  font-size: 9px;
  color: var(--text-muted);
  padding: 2px 6px;
  border: 1px solid var(--border-color);
  border-radius: 2px;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

/* ── List ── */
.qi-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.qi-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  border: 1px solid transparent;
}
.qi-item:hover,
.qi-item.active {
  background: rgba(99, 102, 241, 0.1);
  border-color: var(--primary);
}

.qi-idx {
  font-size: 10px;
  color: var(--text-muted);
  min-width: 16px;
  text-align: right;
  flex-shrink: 0;
}

.qi-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  opacity: 0.85;
}

.qi-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.qi-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.qi-prompt {
  color: var(--terminal-green);
  font-size: 10px;
  flex-shrink: 0;
}
.qi-fav {
  color: var(--warning);
  font-size: 11px;
  flex-shrink: 0;
}

.qi-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.qi-usage {
  font-size: 9px;
  color: var(--text-muted);
  flex-shrink: 0;
}

/* ── Empty ── */
.qi-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}
.empty-msg {
  font-size: 12px;
  color: var(--text-muted);
}

/* ── Footer ── */
.qi-footer {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 6px 14px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  font-size: 10px;
  color: var(--text-muted);
}
.footer-key {
  padding: 1px 6px;
  border: 1px solid var(--border-color);
  border-radius: 2px;
  font-size: 9px;
  color: var(--text-secondary);
}

/* ── Scoped overrides ── */
.terminal-input-wrap {
  display: flex;
  align-items: center;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  transition: all var(--transition-normal);
  overflow: hidden;
}
.terminal-input-wrap:focus-within {
  border-color: var(--primary);
  box-shadow: var(--glow-sm);
}
.terminal-prompt {
  padding: 0 0 0 10px;
  color: var(--terminal-green);
  font-family: var(--font-mono);
  font-size: 13px;
  user-select: none;
  flex-shrink: 0;
}
.terminal-input {
  flex: 1;
  padding: 8px 10px;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 13px;
  outline: none;
}
.terminal-input::placeholder {
  color: var(--text-muted);
  font-style: italic;
  opacity: 0.5;
}
.tag {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  background: rgba(99, 102, 241, 0.1);
  color: var(--primary-light);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.3px;
}
</style>
