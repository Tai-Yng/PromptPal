<script setup lang="ts">
import { ref, computed } from 'vue'
import { usePromptStore } from '../stores/promptStore'
import { useSettingsStore } from '../stores/settingsStore'
import PromptCard from './PromptCard.vue'
import PromptEditor from './PromptEditor.vue'
import NetworkSearch from './NetworkSearch.vue'

const props = defineProps<{
  position: { x: number; y: number }
  aiContent?: string
}>()

const emit = defineEmits<{ 
  (e: 'close'): void
  (e: 'ai-generate'): void
  (e: 'copy-success'): void
}>()

const store = usePromptStore()
const settingsStore = useSettingsStore()
const activeTab = ref<'local' | 'network'>('local')
const showEditor = ref(false)
const editingPromptId = ref<string | null>(null)
const copiedId = ref<string | null>(null)

// 拖拽相关
const panelPos = ref({ x: 0, y: 0 })
const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })

// 初始化位置
const initPosition = () => {
  const w = 520, h = 560
  let x = props.position.x - w / 2
  let y = props.position.y - h - 30
  if (x < 16) x = 16
  if (x + w > window.innerWidth - 16) x = window.innerWidth - w - 16
  if (y < 16) y = props.position.y + 80
  if (y + h > window.innerHeight - 16) y = window.innerHeight - h - 16
  panelPos.value = { x, y }
}
initPosition()

const panelStyle = computed(() => {
  return { left: `${panelPos.value.x}px`, top: `${panelPos.value.y}px` }
})

// 拖拽处理
const handleDragStart = (e: MouseEvent) => {
  isDragging.value = true
  dragOffset.value = {
    x: e.clientX - panelPos.value.x,
    y: e.clientY - panelPos.value.y
  }
  document.addEventListener('mousemove', handleDragMove)
  document.addEventListener('mouseup', handleDragEnd)
}

const handleDragMove = (e: MouseEvent) => {
  if (!isDragging.value) return
  const w = 520, h = 560
  let x = e.clientX - dragOffset.value.x
  let y = e.clientY - dragOffset.value.y
  // 边界限制
  if (x < 0) x = 0
  if (x + w > window.innerWidth) x = window.innerWidth - w
  if (y < 0) y = 0
  if (y + h > window.innerHeight) y = window.innerHeight - h
  panelPos.value = { x, y }
}

const handleDragEnd = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', handleDragMove)
  document.removeEventListener('mouseup', handleDragEnd)
}

const handleCopy = async (id: string, content: string) => {
  const ok = await store.copyToClipboard(content)
  if (ok) {
    copiedId.value = id
    store.incrementUseCount(id)
    emit('copy-success')
    setTimeout(() => { copiedId.value = null }, 1200)
  }
}

const handleEdit = (id: string) => {
  editingPromptId.value = id
  showEditor.value = true
}

const handleDelete = (id: string) => {
  store.deletePrompt(id)
}

const handleFavorite = (id: string) => {
  store.toggleFavorite(id)
}

const handleSetDefault = (id: string) => {
  // 如果已经是默认，则取消默认
  if (settingsStore.petConfig.defaultPromptId === id) {
    settingsStore.updatePetConfig({ defaultPromptId: '' })
  } else {
    settingsStore.updatePetConfig({ defaultPromptId: id })
  }
}

const closeEditor = () => {
  showEditor.value = false
  editingPromptId.value = null
}

const handleSave = (data: any) => {
  if (editingPromptId.value) {
    store.updatePrompt(editingPromptId.value, data)
  } else {
    store.addPrompt(data)
  }
  closeEditor()
}

const handleAIGenerate = () => {
  emit('ai-generate')
  closeEditor()
}
</script>

<template>
  <div class="panel-overlay" @click.self="emit('close')">
    <div class="prompt-panel" :style="panelStyle" @click.stop>
      <!-- 标题栏 - 仿终端标题栏 -->
      <div class="titlebar" @mousedown.prevent="handleDragStart" :class="{ dragging: isDragging }">
        <div class="titlebar-dots">
          <span class="dot close" @click="emit('close')"></span>
          <span class="dot min"></span>
          <span class="dot max"></span>
        </div>
        <div class="titlebar-text">
          <span class="title-prefix">❯</span>
          <span>PromptPal</span>
          <span class="title-dim">— v1.0</span>
        </div>
        <div class="titlebar-spacer"></div>
      </div>

    <!-- 标签页 - 仿终端 tab -->
    <div class="tab-bar">
      <button 
        class="tab" 
        :class="{ active: activeTab === 'local' }"
        @click="activeTab = 'local'"
      >
        <span class="tab-icon">./</span>local
      </button>
      <button 
        class="tab" 
        :class="{ active: activeTab === 'network' }"
        @click="activeTab = 'network'"
      >
        <span class="tab-icon">~/</span>network
      </button>
    </div>

    <!-- 本地内容 -->
    <div v-if="activeTab === 'local'" class="panel-body">
      <!-- 命令行风格搜索 -->
      <div class="cmd-line">
        <span class="prompt-symbol">❯</span>
        <input 
          v-model="store.searchQuery"
          type="text" 
          class="cmd-input"
          placeholder="search prompts..."
          spellcheck="false"
        />
        <span class="cmd-cursor animate-blink">█</span>
      </div>

      <!-- 过滤标签 - 仿终端 tag -->
      <div class="filter-row">
        <button 
          class="filter-tag"
          :class="{ active: !store.selectedCategory && !store.showFavorites }"
          @click="store.selectedCategory = null; store.showFavorites = false"
        >all</button>
        <button 
          class="filter-tag fav"
          :class="{ active: store.showFavorites }"
          @click="store.showFavorites = !store.showFavorites; store.selectedCategory = null"
        >★ starred</button>
        <button 
          v-for="cat in store.categories.slice(0, 4)"
          :key="cat.id"
          class="filter-tag"
          :class="{ active: store.selectedCategory === cat.id }"
          @click="store.selectedCategory = cat.id; store.showFavorites = false"
        >{{ cat.icon }} {{ cat.name }}</button>
      </div>

      <!-- Prompt列表 -->
      <div class="prompt-list">
        <TransitionGroup name="list">
          <PromptCard
            v-for="prompt in store.filteredPrompts"
            :key="prompt.id"
            :prompt="prompt"
            :is-copied="copiedId === prompt.id"
            :is-default="prompt.id === settingsStore.petConfig.defaultPromptId"
            @copy="handleCopy(prompt.id, prompt.content)"
            @edit="handleEdit(prompt.id)"
            @delete="handleDelete(prompt.id)"
            @favorite="handleFavorite(prompt.id)"
            @set-default="handleSetDefault(prompt.id)"
          />
        </TransitionGroup>

        <div v-if="store.filteredPrompts.length === 0" class="empty">
          <span class="empty-prefix">$</span>
          <span class="empty-text"> No prompts found. </span>
          <button class="link-btn" @click="showEditor = true; editingPromptId = null">
            add one →
          </button>
        </div>
      </div>

      <!-- 底部状态栏 -->
      <div class="status-bar">
        <span class="status-left">
          <span class="status-dot"></span>
          {{ store.filteredPrompts.length }} prompts
        </span>
        <button class="status-action" @click="showEditor = true; editingPromptId = null">
          + new
        </button>
      </div>
    </div>

    <!-- 网络搜索 -->
    <NetworkSearch v-else @import="handleSave" />

    <!-- 编辑器 -->
    <Transition name="modal">
      <PromptEditor
        v-if="showEditor"
        :prompt="editingPromptId ? store.prompts.find(p => p.id === editingPromptId) : null"
        :categories="store.categories"
        @save="handleSave"
        @close="closeEditor"
        @ai-generate="handleAIGenerate"
      />
    </Transition>
    </div>
  </div>
</template>

<style scoped>
/* 外层遮罩 - 点击空白处关闭 */
.panel-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 60px;
}

.prompt-panel {
  position: relative;
  width: 520px;
  max-height: 560px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg), var(--glow-sm);
  overflow: hidden;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  font-family: var(--font-mono);
}

/* ===== 标题栏 ===== */
.titlebar {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  user-select: none;
  cursor: grab;
}

.titlebar:active,
.titlebar.dragging {
  cursor: grabbing;
  background: var(--bg-hover);
}

.titlebar-dots {
  display: flex;
  gap: 6px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.dot.close { background: #EF4444; cursor: pointer; }
.dot.close:hover { background: #F87171; }
.dot.min { background: #EAB308; }
.dot.max { background: #22C55E; }

.titlebar-text {
  flex: 1;
  text-align: center;
  font-size: 12px;
  color: var(--text-secondary);
}

.title-prefix {
  color: var(--primary-color);
  margin-right: 6px;
}

.title-dim {
  color: var(--text-muted);
  margin-left: 6px;
}

.titlebar-spacer {
  width: 52px;
}

/* ===== Tab 栏 ===== */
.tab-bar {
  display: flex;
  padding: 0 14px;
  gap: 0;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.tab {
  padding: 8px 16px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 12px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.15s ease;
}

.tab:hover {
  color: var(--text-secondary);
  background: rgba(255,255,255,0.02);
}

.tab.active {
  color: var(--primary-color);
  border-bottom-color: var(--primary-color);
}

.tab-icon {
  color: var(--text-muted);
  margin-right: 4px;
}

.tab.active .tab-icon {
  color: var(--primary-color);
}

/* ===== 面板内容 ===== */
.panel-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
}

/* 命令行搜索 */
.cmd-line {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  background: var(--bg-input);
  border-bottom: 1px solid var(--border-color);
}

.prompt-symbol {
  color: var(--primary-color);
  font-size: 14px;
  font-weight: bold;
  margin-right: 8px;
}

.cmd-input {
  flex: 1;
  border: none;
  background: transparent;
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--text-primary);
  outline: none;
}

.cmd-input::placeholder {
  color: var(--text-muted);
}

.cmd-cursor {
  color: var(--primary-color);
  font-size: 13px;
}

/* 过滤标签 */
.filter-row {
  display: flex;
  gap: 6px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--border-color);
  overflow-x: auto;
}

.filter-tag {
  padding: 3px 10px;
  border: 1px solid var(--border-color);
  background: transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.filter-tag:hover {
  border-color: var(--text-muted);
  color: var(--text-secondary);
}

.filter-tag.active {
  border-color: var(--primary-color);
  color: var(--primary-color);
  background: rgba(0, 212, 170, 0.08);
}

.filter-tag.fav.active {
  border-color: var(--accent-color);
  color: var(--accent-color);
  background: rgba(245, 158, 11, 0.08);
}

/* Prompt 列表 */
.prompt-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px 0;
}

.list-enter-active, .list-leave-active { transition: all 0.2s ease; }
.list-enter-from { opacity: 0; transform: translateX(-12px); }
.list-leave-to { opacity: 0; transform: translateX(12px); }

/* 空状态 */
.empty {
  display: flex;
  align-items: center;
  padding: 20px 14px;
  font-size: 13px;
  color: var(--text-muted);
}

.empty-prefix {
  color: var(--primary-color);
  margin-right: 8px;
}

.link-btn {
  background: none;
  border: none;
  color: var(--primary-color);
  font-family: var(--font-mono);
  font-size: 13px;
  cursor: pointer;
  padding: 0;
}

.link-btn:hover {
  text-decoration: underline;
}

/* 状态栏 */
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 14px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  font-size: 11px;
  color: var(--text-muted);
}

.status-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--primary-color);
  box-shadow: 0 0 4px var(--primary-color);
}

.status-action {
  background: none;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 2px 10px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.status-action:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

/* 模态框 */
.modal-enter-active, .modal-leave-active { transition: all 0.15s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; transform: scale(0.97); }
</style>
