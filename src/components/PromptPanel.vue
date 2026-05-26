<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { usePromptStore } from '../stores/promptStore'
import { useTodoStore } from '../stores/todoStore'
import PromptCard from './PromptCard.vue'
import PromptEditor from './PromptEditor.vue'
import NetworkSearch from './NetworkSearch.vue'

const store = usePromptStore()
const todoStore = useTodoStore()

const activeTab = ref<'all' | 'favorites' | 'category'>('all')
const selectedCategory = ref('all')
const searchQuery = ref('')
const showEditor = ref(false)
const editingPromptId = ref<string | null>(null)
const showSearch = ref(false)
const expandedPromptId = ref<string | null>(null)

const searchInputRef = ref<HTMLInputElement | null>(null)

const filteredPrompts = computed(() => {
  let list = store.prompts
  if (activeTab.value === 'favorites') list = list.filter(p => p.favorite)
  if (activeTab.value === 'category' && selectedCategory.value !== 'all')
    list = list.filter(p => p.category === selectedCategory.value)
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(
      p => p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q)
    )
  }
  return list
})

// Esc / global shortcuts
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    if (showEditor.value) { showEditor.value = false; return }
    if (showSearch.value) { showSearch.value = false; return }
    e.preventDefault()
    getCurrentWindow().hide().catch(() => {})
  }
  // Ctrl+N: new prompt
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault()
    addNew()
  }
  // / : focus search (when not in input)
  if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
    e.preventDefault()
    searchInputRef.value?.focus()
  }
  
  // 键盘导航：上下箭头选择，Enter操作
  if (['ArrowUp', 'ArrowDown', 'Enter', ' '].includes(e.key) && 
      document.activeElement?.tagName !== 'INPUT' && 
      document.activeElement?.tagName !== 'TEXTAREA') {
    e.preventDefault()
    handleKeyboardNavigation(e.key)
  }
}

const handleKeyboardNavigation = (key: string) => {
  if (filteredPrompts.value.length === 0) return
  
  let currentIndex = -1
  if (expandedPromptId.value) {
    currentIndex = filteredPrompts.value.findIndex(p => p.id === expandedPromptId.value)
    if (currentIndex === -1) currentIndex = 0
  } else {
    currentIndex = 0
  }
  
  switch (key) {
    case 'ArrowUp':
      if (currentIndex > 0) {
        expandedPromptId.value = filteredPrompts.value[currentIndex - 1].id
      }
      break
    case 'ArrowDown':
      if (currentIndex < filteredPrompts.value.length - 1) {
        expandedPromptId.value = filteredPrompts.value[currentIndex + 1].id
      }
      break
    case 'Enter':
    case ' ':
      if (expandedPromptId.value) {
        const prompt = filteredPrompts.value.find(p => p.id === expandedPromptId.value)
        if (prompt) {
          if (key === 'Enter') {
            copyPrompt(prompt)
          } else if (key === ' ') {
            expandPrompt(prompt.id)
          }
        }
      }
      break
  }
}

onMounted(() => { window.addEventListener('keydown', handleKeyDown) })
onUnmounted(() => { window.removeEventListener('keydown', handleKeyDown) })

const addNew = () => { editingPromptId.value = null; showEditor.value = true }
const editPrompt = (id: string) => { editingPromptId.value = id; showEditor.value = true }

const handleSave = async (data: any) => {
  if (editingPromptId.value) await store.updatePrompt(editingPromptId.value, data)
  else await store.addPrompt(data)
  showEditor.value = false; editingPromptId.value = null
}

const closeEditor = () => { showEditor.value = false; editingPromptId.value = null }
const toggleFavorite = (id: string) => store.toggleFavorite(id)
const deletePrompt = (id: string) => {
  if (confirm('delete this prompt?')) store.deletePrompt(id)
  if (expandedPromptId.value === id) expandedPromptId.value = null
}
const copyPrompt = async (p: any) => {
  const ok = await store.copyToClipboard(p.content)
  if (ok) store.incrementUseCount(p.id)
}
const expandPrompt = (id: string) => {
  expandedPromptId.value = expandedPromptId.value === id ? null : id
}
const setDefaultPrompt = (id: string) => {
  if (store.defaultPromptId === id) {
    store.setDefaultPrompt(null)
  } else {
    store.setDefaultPrompt(id)
  }
}

const addToTodo = (p: any) => {
  todoStore.addItem(p.title, 'work', p.title)
}
</script>

<template>
  <div class="prompt-page">
    <!-- 顶部命令行栏 -->
    <div class="cmd-bar">
      <span class="cmd-path">~/prompts</span>
      <span class="cmd-sep">::</span>
      <span class="cmd-branch">main</span>
      <div class="cmd-actions">
        <button class="btn btn-secondary" @click="showSearch = !showSearch">
          <span class="cmd-sym">@</span>ext
        </button>
        <button class="btn btn-primary" @click="addNew">
          <span class="cmd-sym">+</span>new
        </button>
      </div>
    </div>

    <!-- 搜索栏 -->
    <div class="search-bar">
      <div class="terminal-input-wrap">
        <span class="terminal-prompt">$</span>
        <input
          ref="searchInputRef"
          v-model="searchQuery"
          class="terminal-input"
          placeholder="grep prompts..."
          spellcheck="false"
        />
      </div>
      <span class="result-badge">[{{ filteredPrompts.length }}]</span>
    </div>

    <!-- 网络搜索 -->
    <Transition name="fade-list">
      <div v-if="showSearch" class="search-section">
        <NetworkSearch @select="(p: any) => { store.addPrompt(p); showSearch = false }" />
      </div>
    </Transition>

    <!-- Tab 导航 (终端风格) -->
    <div class="tab-bar">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'all' }"
        @click="activeTab = 'all'"
      >
        <span class="tab-prefix">[1]</span>all
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'favorites' }"
        @click="activeTab = 'favorites'"
      >
        <span class="tab-prefix">[2]</span>fav
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'category' }"
        @click="activeTab = 'category'"
      >
        <span class="tab-prefix">[3]</span>cat
      </button>
    </div>

    <!-- 分类选择 -->
    <div v-if="activeTab === 'category'" class="category-bar">
      <button
        class="cat-chip"
        :class="{ active: selectedCategory === 'all' }"
        @click="selectedCategory = 'all'"
      >
        <span class="chip-dot" style="background: var(--text-muted);"></span>all
      </button>
      <button
        v-for="cat in store.categories"
        :key="cat.id"
        class="cat-chip"
        :class="{ active: selectedCategory === cat.id }"
        @click="selectedCategory = cat.id"
      >
        <span class="chip-dot" :style="{ background: cat.color }"></span>
        {{ cat.name }}
      </button>
    </div>

    <!-- Prompt 列表 -->
    <div class="prompt-list">
      <TransitionGroup name="fade-list">
        <PromptCard
          v-for="prompt in filteredPrompts"
          :key="prompt.id"
          :prompt="prompt"
          :is-default="store.defaultPromptId === prompt.id"
          :is-expanded="expandedPromptId === prompt.id"
          @edit="() => editPrompt(prompt.id)"
          @delete="() => deletePrompt(prompt.id)"
          @copy="() => copyPrompt(prompt)"
          @expand="() => expandPrompt(prompt.id)"
          @set-default="() => setDefaultPrompt(prompt.id)"
          @add-todo="() => addToTodo(prompt)"
        />
      </TransitionGroup>

      <!-- 空状态 -->
      <div v-if="filteredPrompts.length === 0" class="empty-state">
        <pre class="empty-ascii">
  ┌─────────────────────────┐
  │  No prompts found       │
  │                         │
  │  $ new --prompt         │
  │  $ import --file=data   │
  └─────────────────────────┘
        </pre>
        <button class="btn btn-primary" @click="addNew">
          <span class="cmd-sym">$</span> new --prompt
        </button>
      </div>
    </div>

    <!-- 编辑器弹窗 -->
    <div v-if="showEditor" class="editor-overlay" @click.self="closeEditor">
      <PromptEditor
        :prompt="editingPromptId ? store.prompts.find(p => p.id === editingPromptId) : null"
        :categories="store.categories"
        @save="handleSave"
        @close="closeEditor"
      />
    </div>
  </div>
</template>

<style scoped>
.prompt-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px 20px;
  gap: 12px;
  font-family: var(--font-mono);
}

/* ── Command Bar ── */
.cmd-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 11px;
}
.cmd-path { color: var(--terminal-green); font-weight: 600; }
.cmd-sep { color: var(--text-muted); }
.cmd-branch { color: var(--accent); }
.cmd-actions {
  margin-left: auto;
  display: flex;
  gap: 6px;
}
.cmd-sym { opacity: 0.6; font-size: 10px; }

/* ── Search ── */
.search-bar {
  display: flex;
  align-items: center;
  gap: 10px;
}
.search-bar .terminal-input-wrap { flex: 1; }
.result-badge {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  letter-spacing: 0.5px;
}

/* ── Search Section ── */
.search-section {
  padding: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}

/* ── Tab Bar ── */
.tab-bar {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border-color);
}
.tab-btn {
  padding: 8px 14px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition-normal);
  letter-spacing: 0.3px;
}
.tab-btn:hover {
  color: var(--text-secondary);
  border-bottom-color: var(--border-color);
}
.tab-btn.active {
  color: var(--primary-light);
  border-bottom-color: var(--primary);
}
.tab-prefix {
  font-size: 10px;
  color: var(--text-muted);
  margin-right: 4px;
  opacity: 0.6;
}
.tab-btn.active .tab-prefix {
  color: var(--primary);
  opacity: 0.8;
}

/* ── Category Chips ── */
.category-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.cat-chip {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
  cursor: pointer;
  transition: all var(--transition-normal);
  letter-spacing: 0.3px;
}
.cat-chip:hover {
  border-color: var(--border-active);
  color: var(--text-secondary);
  box-shadow: var(--glow-sm);
}
.cat-chip.active {
  background: rgba(99, 102, 241, 0.1);
  border-color: var(--primary);
  color: var(--primary-light);
}
.chip-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* ── Prompt List ── */
.prompt-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* ── Empty State ── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 50px 20px;
  gap: 16px;
}
.empty-ascii {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.6;
  white-space: pre;
  background: var(--bg-secondary);
  padding: 16px 20px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  text-align: left;
}

/* ── Editor Overlay ── */
.editor-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(2px);
}

/* ── Local btn styles (override global for compactness) ── */
.btn {
  padding: 5px 12px;
  font-size: 11px;
}
</style>
