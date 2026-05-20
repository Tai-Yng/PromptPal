<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { searchPrompts, getTrendingPrompts, getLatestPrompts } from '../services/promptApi'
import { copyToClipboard as platformCopy } from '../services/platform'
import type { Prompt } from '../types'

const emit = defineEmits<{ (e: 'import', data: any): void }>()

const searchQuery = ref('')
const selectedCategory = ref<string>('all')
const selectedSort = ref<'trending' | 'latest'>('trending')
const isLoading = ref(false)
const hasSearched = ref(false)
const searchResults = ref<Partial<Prompt>[]>([])
const trendingResults = ref<Partial<Prompt>[]>([])

// 分类列表
const categories = [
  { id: 'all', name: 'All', icon: '◆' },
  { id: 'code', name: 'Code', icon: '💻' },
  { id: 'art', name: 'Art', icon: '🎨' },
  { id: 'writing', name: 'Writing', icon: '✍️' },
  { id: 'business', name: 'Business', icon: '💼' },
  { id: 'game', name: 'Game', icon: '🎮' },
  { id: 'learning', name: 'Learning', icon: '📚' }
]

// 加载热门提示词
const loadTrending = async () => {
  isLoading.value = true
  try {
    trendingResults.value = await getTrendingPrompts(12)
  } catch (e) {
    console.error('Failed to load trending:', e)
  }
  isLoading.value = false
}

// 搜索结果
const filteredResults = computed(() => {
  if (!hasSearched.value) {
    // 根据分类过滤热门结果
    let results = [...trendingResults.value]
    if (selectedCategory.value !== 'all') {
      results = results.filter(r => r.category === selectedCategory.value)
    }
    return results
  }
  return searchResults.value
})

// 搜索处理
const handleSearch = async () => {
  const q = searchQuery.value.trim()
  if (!q) {
    hasSearched.value = false
    searchResults.value = []
    return
  }

  isLoading.value = true
  hasSearched.value = true

  try {
    searchResults.value = await searchPrompts(
      q,
      selectedCategory.value === 'all' ? undefined : selectedCategory.value
    )
  } catch (e) {
    console.error('Search failed:', e)
    searchResults.value = []
  }

  isLoading.value = false
}

// 初始加载
onMounted(() => {
  loadTrending()
})

// 分类改变时，如果已搜索则重新搜索
watch(selectedCategory, () => {
  if (hasSearched.value && searchQuery.value.trim()) {
    handleSearch()
  }
})

const handleImport = (result: any) => {
  emit('import', {
    title: result.title,
    content: result.content,
    category: 'other',
    tags: result.tags || [],
    source: result.source,
    favorite: false
  })
}

const copyToClipboard = async (content: string) => {
  return await platformCopy(content)
}

// 分类颜色
const getCategoryColor = (category?: string) => {
  const colors: Record<string, string> = {
    code: '#22C55E',
    art: '#A855F7',
    writing: '#F59E0B',
    business: '#3B82F6',
    game: '#EF4444',
    learning: '#10B981'
  }
  return colors[category || ''] || '#64748B'
}

// 清除搜索
const clearSearch = () => {
  searchQuery.value = ''
  hasSearched.value = false
  searchResults.value = []
}
</script>

<template>
  <div class="network-panel">
    <!-- 搜索 -->
    <div class="search-area">
      <div class="search-row">
        <span class="search-prompt">~/network</span>
        <span class="search-arrow">❯</span>
        <input
          v-model="searchQuery"
          type="text"
          class="search-input"
          :placeholder="hasSearched ? 'refine search...' : 'search hot prompts...'"
          spellcheck="false"
          @keyup.enter="handleSearch"
        />
        <button
          v-if="searchQuery"
          class="search-clear"
          @click="clearSearch"
        >×</button>
        <button
          class="search-go"
          :disabled="!searchQuery.trim() || isLoading"
          @click="handleSearch"
        >run</button>
      </div>

      <div class="source-row">
        <button
          v-for="cat in categories" :key="cat.id"
          class="src-btn" :class="{ active: selectedCategory === cat.id }"
          @click="selectedCategory = cat.id"
        >
          <span>{{ cat.icon }}</span> {{ cat.name }}
        </button>
      </div>
    </div>

    <!-- 结果 -->
    <div class="results">
      <div v-if="isLoading" class="loading">
        <span class="loading-spinner"></span>
        <span class="loading-text animate-blink">fetching</span>
      </div>

      <template v-else>
        <!-- 标题行 -->
        <div class="section-header">
          <span v-if="hasSearched" class="section-title">
            search results <span class="result-count">({{ filteredResults.length }})</span>
          </span>
          <span v-else class="section-title">
            <span class="fire-icon">🔥</span> trending
          </span>
        </div>

        <div v-if="filteredResults.length > 0" class="result-list">
          <div v-for="r in filteredResults" :key="r.id" class="result-item">
            <div class="result-head">
              <span class="result-src" :style="{ color: getCategoryColor(r.category) }">
                {{ r.category || 'other' }}
              </span>
              <div class="result-meta-right">
                <span v-for="tag in (r.tags || []).slice(0, 2)" :key="tag" class="result-tag">{{ tag }}</span>
              </div>
            </div>
            <div class="result-title">{{ r.title }}</div>
            <pre class="result-body">{{ r.content }}</pre>
            <div class="result-foot">
              <span class="result-source">source: {{ r.source }}</span>
              <div class="result-actions">
                <button class="r-act" @click="copyToClipboard(r.content)">copy</button>
                <button class="r-act import" @click="handleImport(r)">import →</button>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="hasSearched" class="state-empty">
          <span class="state-icon">∅</span>
          <span>no results for "{{ searchQuery }}"</span>
          <span class="state-hint">try different keywords</span>
        </div>
      </template>
    </div>

    <!-- 快捷链接 -->
    <div class="quick-links">
      <span class="links-label">links:</span>
      <a href="https://prompthero.com/" target="_blank" class="qlink">prompthero</a>
      <a href="https://openart.ai/" target="_blank" class="qlink">openart</a>
      <a href="https://flowgpt.com/" target="_blank" class="qlink">flowgpt</a>
      <span class="api-status">API: {{ isLoading ? 'loading...' : 'ready' }}</span>
    </div>
  </div>
</template>

<style scoped>
.network-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-family: var(--font-mono);
}

/* 搜索区 */
.search-area {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color);
}

.search-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.search-prompt { color: var(--text-muted); font-size: 12px; }
.search-arrow { color: var(--primary-color); font-size: 13px; }

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--text-primary);
  outline: none;
}

.search-input::placeholder { color: var(--text-muted); }

.search-clear {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 16px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}
.search-clear:hover { color: var(--error-color); }

.search-go {
  padding: 3px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.search-go:hover:not(:disabled) { border-color: var(--primary-color); color: var(--primary-color); }
.search-go:disabled { opacity: 0.4; cursor: not-allowed; }

.source-row { display: flex; gap: 6px; }

.src-btn {
  padding: 3px 10px;
  border: 1px solid var(--border-color);
  background: transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.src-btn:hover { border-color: var(--text-muted); color: var(--text-secondary); }
.src-btn.active { border-color: var(--primary-color); color: var(--primary-color); background: rgba(0,212,170,0.08); }

/* 结果区 */
.results {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

/* 标题行 */
.section-header {
  padding: 8px 14px;
  border-bottom: 1px solid rgba(30,58,95,0.3);
}

.section-title {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.result-count { color: var(--primary-color); }
.fire-icon { font-size: 12px; }

/* 加载 */
.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px;
  color: var(--text-muted);
  font-size: 13px;
}

.loading-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--border-color);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* 列表 */
.result-list { display: flex; flex-direction: column; }

.result-item {
  padding: 10px 14px;
  border-bottom: 1px solid rgba(30,58,95,0.2);
  transition: background 0.1s ease;
}

.result-item:hover { background: var(--bg-hover); }

.result-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
  font-size: 11px;
}

.result-meta-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.result-tag {
  color: var(--text-muted);
  font-size: 10px;
  padding: 0 4px;
  border: 1px solid rgba(100,116,139,0.3);
  border-radius: 2px;
}

.result-likes { color: var(--text-muted); font-size: 11px; }

.result-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.result-body {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.4;
  margin: 0;
  white-space: pre-wrap;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  padding: 6px 10px;
  background: var(--bg-input);
  border-radius: var(--radius-sm);
  margin-bottom: 6px;
}

.result-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
}

.result-author { color: var(--text-muted); }
.result-actions { display: flex; gap: 6px; }

.r-act {
  padding: 2px 10px;
  border: 1px solid var(--border-color);
  background: transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.r-act:hover { border-color: var(--primary-color); color: var(--primary-color); }
.r-act.import:hover { border-color: var(--secondary-color); color: var(--secondary-color); }

/* 空状态 */
.state-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 40px;
  color: var(--text-muted);
  font-size: 13px;
}

.state-icon { font-size: 24px; opacity: 0.5; }
.state-hint { font-size: 11px; color: var(--text-muted); opacity: 0.6; }

/* 快捷链接 */
.quick-links {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-top: 1px solid var(--border-color);
  font-size: 11px;
}

.links-label { color: var(--text-muted); }

.qlink {
  color: var(--primary-color);
  text-decoration: none;
  opacity: 0.7;
  transition: opacity 0.15s ease;
}

.qlink:hover { opacity: 1; text-decoration: underline; }

.api-status {
  margin-left: auto;
  color: var(--text-muted);
  font-size: 10px;
}
</style>
