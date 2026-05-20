<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { usePromptStore } from '../stores/promptStore'
import PromptCard from './PromptCard.vue'
import PromptEditor from './PromptEditor.vue'
import NetworkSearch from './NetworkSearch.vue'

const emit = defineEmits<{ (e: 'close'): void }>()
const store = usePromptStore()

const activeTab = ref<'all' | 'favorites' | 'category'>('all')
const selectedCategory = ref('all')
const searchQuery = ref('')
const showEditor = ref(false)
const editingPromptId = ref<string | null>(null)
const showSearch = ref(false)

const filteredPrompts = computed(() => {
  let list = store.prompts
  if (activeTab.value === 'favorites') list = list.filter(p => p.favorite)
  if (activeTab.value === 'category' && selectedCategory.value !== 'all') list = list.filter(p => p.category === selectedCategory.value)
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(p => p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q))
  }
  return list
})

// Esc 关闭面板
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    if (showEditor.value) { showEditor.value = false; return }
    if (showSearch.value) { showSearch.value = false; return }
    e.preventDefault()
    getCurrentWindow().hide().catch(() => {})
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
const deletePrompt = (id: string) => { if (confirm('删除这个提示词？')) store.deletePrompt(id) }
const copyPrompt = async (p: any) => { const ok = await store.copyToClipboard(p.content); if (ok) store.incrementUseCount(p.id) }
const setDefaultPrompt = (id: string) => {
  // 如果已经是默认，则取消默认
  if (store.defaultPromptId === id) {
    store.setDefaultPrompt(null)
  } else {
    store.setDefaultPrompt(id)
  }
}
</script>

<template>
  <div class="prompt-page">
    <!-- 顶部搜索栏 -->
    <div class="top-bar">
      <h2 class="page-title">📋 Prompt 管理</h2>
      <div class="top-actions">
        <button class="btn btn-secondary" @click="showSearch = !showSearch">🌐 网络搜索</button>
        <button class="btn btn-primary" @click="addNew">+ 新建</button>
      </div>
    </div>

    <!-- 网络搜索 -->
    <div v-if="showSearch" class="search-section">
      <NetworkSearch @select="(p: any) => { store.addPrompt(p); showSearch = false }" />
    </div>

    <!-- Tab 导航 -->
    <div class="tabs">
      <button :class="{ active: activeTab === 'all' }" @click="activeTab = 'all'">全部</button>
      <button :class="{ active: activeTab === 'favorites' }" @click="activeTab = 'favorites'">⭐ 收藏</button>
      <button :class="{ active: activeTab === 'category' }" @click="activeTab = 'category'">📁 分类</button>
    </div>

    <!-- 分类选择 -->
    <div v-if="activeTab === 'category'" class="category-bar">
      <button :class="{ active: selectedCategory === 'all' }" @click="selectedCategory = 'all'">全部</button>
      <button v-for="cat in store.categories" :key="cat.id" :class="{ active: selectedCategory === cat.id }" @click="selectedCategory = cat.id">{{ cat.icon }} {{ cat.name }}</button>
    </div>

    <!-- 搜索 -->
    <div class="search-filter">
      <input v-model="searchQuery" class="input" placeholder="搜索提示词..." />
      <span class="result-count">{{ filteredPrompts.length }} 个结果</span>
    </div>

    <!-- 列表 -->
    <div class="prompt-list">
      <PromptCard
        v-for="prompt in filteredPrompts"
        :key="prompt.id"
        :prompt="prompt"
        :is-default="store.defaultPromptId === prompt.id"
        @edit="() => editPrompt(prompt.id)"
        @delete="() => deletePrompt(prompt.id)"
        @copy="() => copyPrompt(prompt)"
        @set-default="() => setDefaultPrompt(prompt.id)"
      />
      <div v-if="filteredPrompts.length === 0" class="empty-state">
        <span class="empty-icon">📝</span>
        <span class="empty-text">还没有提示词</span>
        <button class="btn btn-primary" @click="addNew">新建一个</button>
      </div>
    </div>

    <!-- 编辑器 -->
    <div v-if="showEditor" class="editor-overlay" @click.self="closeEditor">
      <PromptEditor :prompt="editingPromptId ? store.prompts.find(p => p.id === editingPromptId) : null" :categories="store.categories" @save="handleSave" @close="closeEditor" />
    </div>
  </div>
</template>

<style scoped>
.prompt-page { display: flex; flex-direction: column; height: 100%; padding: 20px; gap: 16px; }
.top-bar { display: flex; align-items: center; justify-content: space-between; }
.page-title { font-size: 20px; font-weight: 700; color: #F1F5F9; }
.top-actions { display: flex; gap: 8px; }
.tabs { display: flex; gap: 4px; }
.tabs button { padding: 8px 16px; background: rgba(100, 116, 139, 0.1); border: 1px solid rgba(100, 116, 139, 0.2); border-radius: 8px; color: #94A3B8; font-size: 13px; cursor: pointer; transition: all 0.2s; }
.tabs button:hover { background: rgba(100, 116, 139, 0.2); color: #CBD5E1; }
.tabs button.active { background: rgba(0, 212, 170, 0.15); border-color: #00D4AA; color: #00D4AA; font-weight: 600; }
.category-bar { display: flex; flex-wrap: wrap; gap: 6px; }
.category-bar button { padding: 4px 12px; background: rgba(100, 116, 139, 0.1); border: 1px solid rgba(100, 116, 139, 0.2); border-radius: 20px; color: #94A3B8; font-size: 12px; cursor: pointer; transition: all 0.2s; }
.category-bar button:hover { border-color: rgba(0, 212, 170, 0.5); color: #00D4AA; }
.category-bar button.active { background: rgba(0, 212, 170, 0.1); border-color: #00D4AA; color: #00D4AA; }
.search-filter { display: flex; align-items: center; gap: 12px; }
.search-filter .input { flex: 1; }
.result-count { font-size: 12px; color: #64748B; white-space: nowrap; }
.search-section { padding: 12px; background: rgba(30, 41, 59, 0.5); border-radius: 10px; border: 1px solid rgba(100, 116, 139, 0.2); }
.prompt-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; gap: 12px; color: #64748B; }
.empty-icon { font-size: 40px; opacity: 0.5; }
.empty-text { font-size: 14px; }
.editor-overlay { position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.5); }
.btn { padding: 8px 16px; border: none; border-radius: 8px; font-size: 13px; cursor: pointer; transition: all 0.2s; font-family: inherit; }
.btn-primary { background: linear-gradient(135deg, #00D4AA, #00B894); color: #0F172A; font-weight: 600; }
.btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0, 212, 170, 0.3); }
.btn-secondary { background: rgba(100, 116, 139, 0.2); color: #CBD5E1; border: 1px solid rgba(100, 116, 139, 0.3); }
.btn-secondary:hover { background: rgba(100, 116, 139, 0.3); }
.input { width: 100%; padding: 10px 14px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(100, 116, 139, 0.3); border-radius: 8px; color: #E2E8F0; font-size: 14px; font-family: inherit; outline: none; }
.input:focus { border-color: #00D4AA; }
.input::placeholder { color: #64748B; }
</style>
