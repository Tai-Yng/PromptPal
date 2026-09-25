<script setup lang="ts">
import { ref } from 'vue'
import { openUrl } from '../services/platform'
import { searchPrompts, getDatasetSource } from '../services/promptApi'
import { usePromptStore } from '../stores/promptStore'
import type { Prompt } from '../types'

const promptStore = usePromptStore()

const promptSites = [
  { name: 'PromptHero', url: 'https://prompthero.com/', desc: 'AI Prompt Library - Midjourney, SD, ChatGPT', tags: ['image', 'chat'] },
  { name: 'FlowGPT', url: 'https://flowgpt.com/', desc: 'ChatGPT Prompt Community', tags: ['chat', 'community'] },
  { name: 'OpenArt', url: 'https://openart.ai/', desc: 'AI Art Prompts & Gallery', tags: ['image', 'art'] },
  { name: 'Lexica', url: 'https://lexica.art/', desc: 'Stable Diffusion Search Engine', tags: ['image', 'search'] },
  { name: 'PublicPrompts', url: 'https://publicprompts.art/', desc: 'Free Quality Prompt Collection', tags: ['image', 'free'] },
  { name: 'Snoozy AI', url: 'https://snoozy.io/', desc: 'Midjourney Prompt Resources', tags: ['image', 'mj'] },
  { name: 'Learning Prompt', url: 'https://learningprompt.wiki/', desc: 'Chinese Prompt Tutorial', tags: ['cn', 'learn'] },
  { name: 'Awesome ChatGPT', url: 'https://github.com/f/awesome-chatgpt-prompts', desc: 'GitHub Prompt Collection', tags: ['github', 'list'] }
]

const handleOpenSite = async (url: string) => {
  try { await openUrl(url) } catch { window.open(url, '_blank') }
}

// ===== 社区提示词搜索 =====
const query = ref('')
const results = ref<Partial<Prompt>[]>([])
const searching = ref(false)
const searched = ref(false)
const errorMsg = ref('')
const savedKeys = ref<Set<string>>(new Set())
const copiedKey = ref('')

const handleSearch = async () => {
  searching.value = true
  errorMsg.value = ''
  try {
    results.value = await searchPrompts(query.value)
    searched.value = true
  } catch (e: any) {
    errorMsg.value = e?.message || 'search failed'
    results.value = []
  } finally {
    searching.value = false
  }
}

const handleCopy = async (p: Partial<Prompt>) => {
  const ok = await promptStore.copyToClipboard(p.content || '')
  if (ok) {
    copiedKey.value = p.id || ''
    setTimeout(() => { if (copiedKey.value === p.id) copiedKey.value = '' }, 1500)
  }
}

const handleSave = (p: Partial<Prompt>) => {
  promptStore.addPrompt({
    title: p.title || 'Untitled',
    content: p.content || '',
    category: p.category || 'other',
    tags: p.tags ? [...p.tags] : [],
    source: 'network',
    favorite: false
  })
  savedKeys.value.add(p.id || '')
}
</script>

<template>
  <div class="ext-panel">
    <div class="ext-cmd">
      <span class="cmd-path">~/ext</span>
      <span class="cmd-sep">::</span>
      <span class="cmd-label">external prompt resources</span>
    </div>

    <!-- 社区提示词搜索（f/awesome-chatgpt-prompts 数据集） -->
    <div class="search-box">
      <div class="search-row">
        <span class="search-prefix">&gt;</span>
        <input
          v-model="query"
          class="search-input"
          type="text"
          placeholder="search community prompts..."
          @keydown.enter="handleSearch"
        />
        <button class="search-btn" :disabled="searching" @click="handleSearch">
          {{ searching ? '...' : 'search' }}
        </button>
      </div>
      <div v-if="searched && !errorMsg" class="search-meta">
        <span class="meta-count">{{ results.length }} results</span>
        <span class="meta-src">source: {{ getDatasetSource() }}</span>
      </div>
      <div v-if="errorMsg" class="search-error">[ERR] {{ errorMsg }}</div>
    </div>

    <!-- 搜索结果 -->
    <div v-if="results.length" class="result-list">
      <div v-for="p in results" :key="p.id" class="result-card">
        <div class="result-header">
          <span class="result-title">{{ p.title }}</span>
          <span class="result-cat">{{ p.category }}</span>
        </div>
        <p class="result-content">{{ p.content }}</p>
        <div class="result-actions">
          <button class="action-btn" @click="handleCopy(p)">
            {{ copiedKey === p.id ? '[copied]' : 'copy' }}
          </button>
          <button
            class="action-btn"
            :class="{ saved: savedKeys.has(p.id || '') }"
            :disabled="savedKeys.has(p.id || '')"
            @click="handleSave(p)"
          >
            {{ savedKeys.has(p.id || '') ? '[saved]' : '+ save to library' }}
          </button>
        </div>
      </div>
    </div>
    <div v-else-if="searching" class="search-status">searching...</div>

    <div class="ext-cmd ext-cmd-second">
      <span class="cmd-path">~/ext</span>
      <span class="cmd-sep">::</span>
      <span class="cmd-label">prompt websites</span>
    </div>

    <div class="ext-grid">
      <div
        v-for="site in promptSites" :key="site.name"
        class="ext-card"
        @click="handleOpenSite(site.url)"
      >
        <div class="ext-card-header">
          <span class="ext-url-icon">&lt;a&gt;</span>
          <span class="ext-name">{{ site.name }}</span>
        </div>
        <p class="ext-desc">{{ site.desc }}</p>
        <div class="ext-tags">
          <span v-for="tag in site.tags" :key="tag" class="tag">{{ tag }}</span>
        </div>
      </div>
    </div>

    <div class="ext-footer">
      <span class="footer-hint">click to open in browser</span>
    </div>
  </div>
</template>

<style scoped>
.ext-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-family: var(--font-mono);
  overflow-y: auto;
}

.ext-cmd {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 0 10px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--border-light);
  font-size: 11px;
}
.ext-cmd-second { margin-top: 18px; }
.cmd-path { color: var(--terminal-green); font-weight: 600; }
.cmd-sep { color: var(--text-muted); }
.cmd-label { color: var(--text-secondary); font-size: 10px; }

/* ===== 搜索区 ===== */
.search-box {
  margin-bottom: 12px;
}
.search-row {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 8px 12px;
  transition: border-color var(--transition-normal);
}
.search-row:focus-within {
  border-color: var(--border-active);
  box-shadow: var(--glow-sm);
}
.search-prefix {
  color: var(--terminal-green);
  font-weight: 700;
  font-size: 13px;
}
.search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 12px;
}
.search-input::placeholder { color: var(--text-muted); }
.search-btn {
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid var(--border-active);
  border-radius: var(--radius-sm);
  color: var(--primary-light);
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 4px 12px;
  cursor: pointer;
  transition: all var(--transition-normal);
}
.search-btn:hover:not(:disabled) {
  background: rgba(99, 102, 241, 0.3);
}
.search-btn:disabled { opacity: 0.5; cursor: wait; }
.search-meta {
  display: flex;
  gap: 12px;
  margin-top: 6px;
  font-size: 10px;
  color: var(--text-muted);
}
.meta-count { color: var(--terminal-green); }
.search-error {
  margin-top: 6px;
  font-size: 10px;
  color: #f87171;
}
.search-status {
  font-size: 11px;
  color: var(--text-muted);
  padding: 10px 0;
}

/* ===== 搜索结果 ===== */
.result-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 6px;
}
.result-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 10px 12px;
}
.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}
.result-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: 0.3px;
}
.result-cat {
  font-size: 9px;
  color: var(--primary-light);
  background: rgba(99, 102, 241, 0.1);
  padding: 1px 6px;
  border-radius: 2px;
  border: 1px solid rgba(99, 102, 241, 0.2);
  flex-shrink: 0;
}
.result-content {
  font-size: 10px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin: 0 0 8px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.result-actions {
  display: flex;
  gap: 8px;
}
.action-btn {
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 3px 10px;
  cursor: pointer;
  transition: all var(--transition-normal);
}
.action-btn:hover:not(:disabled) {
  border-color: var(--border-active);
  color: var(--primary-light);
}
.action-btn.saved {
  color: var(--terminal-green);
  border-color: var(--terminal-green);
  cursor: default;
  opacity: 0.7;
}

.ext-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
}

.ext-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  cursor: pointer;
  transition: all var(--transition-normal);
}
.ext-card:hover {
  border-color: var(--border-active);
  box-shadow: var(--glow-sm);
  transform: translateY(-1px);
}
.ext-card-header {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 6px;
}
.ext-url-icon {
  font-size: 9px;
  color: var(--primary-light);
  background: rgba(99, 102, 241, 0.1);
  padding: 1px 5px;
  border-radius: 2px;
  border: 1px solid rgba(99, 102, 241, 0.2);
}
.ext-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: 0.3px;
}
.ext-desc {
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin: 0 0 10px 0;
  min-height: 32px;
}
.ext-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.ext-footer {
  margin-top: auto;
  padding-top: 14px;
  text-align: center;
}
.footer-hint {
  font-size: 10px;
  color: var(--text-muted);
}
</style>
