<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted } from 'vue'
import type { Prompt, Category } from '../types'

const props = defineProps<{
  prompt: Prompt | null
  categories: Category[]
}>()

const emit = defineEmits<{
  (e: 'save', data: Partial<Prompt>): void
  (e: 'close'): void
  (e: 'ai-generate'): void
}>()

const title = ref(props.prompt?.title || '')
const content = ref(props.prompt?.content || '')
const category = ref(props.prompt?.category || 'chat')
const customCategory = ref('')
const tags = ref(props.prompt?.tags.join(', ') || '')
const favorite = ref(props.prompt?.favorite || false)

const isCustomCategory = computed(() => {
  return !props.categories.some(c => c.id === category.value)
})

const canSave = computed(() => title.value.trim() && content.value.trim())

// 草稿保存相关
const draftKey = computed(() => {
  return props.prompt ? `promptpal_edit_${props.prompt.id}` : 'promptpal_new_draft'
})

const saveDraft = () => {
  if (!title.value.trim() && !content.value.trim()) return
  const draft = {
    title: title.value,
    content: content.value,
    category: category.value,
    customCategory: customCategory.value,
    tags: tags.value,
    favorite: favorite.value,
    savedAt: Date.now()
  }
  localStorage.setItem(draftKey.value, JSON.stringify(draft))
}

const loadDraft = () => {
  const saved = localStorage.getItem(draftKey.value)
  if (saved) {
    try {
      const draft = JSON.parse(saved)
      title.value = draft.title || ''
      content.value = draft.content || ''
      category.value = draft.category || 'chat'
      customCategory.value = draft.customCategory || ''
      tags.value = draft.tags || ''
      favorite.value = draft.favorite || false
    } catch {}
  }
}

const clearDraft = () => {
  localStorage.removeItem(draftKey.value)
}

// 自动保存
let autoSaveTimer: number | null = null
const startAutoSave = () => {
  if (autoSaveTimer) clearInterval(autoSaveTimer)
  autoSaveTimer = window.setInterval(saveDraft, 5000) // 每5秒自动保存
}

const stopAutoSave = () => {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer)
    autoSaveTimer = null
  }
}

// 监听输入变化
watch([title, content, category, customCategory, tags, favorite], () => {
  saveDraft()
}, { deep: true })

const handleSave = () => {
  if (!canSave.value) return
  const finalCategory = isCustomCategory.value && customCategory.value.trim()
    ? customCategory.value.trim().toLowerCase().replace(/\s+/g, '-')
    : category.value
  emit('save', {
    title: title.value.trim(),
    content: content.value.trim(),
    category: finalCategory,
    tags: tags.value.split(',').map(t => t.trim()).filter(Boolean),
    source: 'local',
    favorite: favorite.value
  })
  clearDraft()
}

onMounted(() => {
  if (!props.prompt) {
    loadDraft()
  }
  startAutoSave()
})

onUnmounted(() => {
  stopAutoSave()
})
</script>

<template>
  <div class="editor-overlay" @click.self="emit('close')">
    <div class="editor-modal">
      <!-- 标题栏 -->
      <div class="editor-titlebar">
        <div class="editor-dots">
          <span class="dot close" @click="emit('close')"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
        <span class="editor-title">
          <span class="title-path">editor</span>
          <span class="title-sep">::</span>
          <span class="title-file">~/prompts/{{ prompt ? 'edit' : 'new' }}.prompt</span>
        </span>
        <div class="editor-spacer"></div>
      </div>

      <!-- 表单 -->
      <div class="editor-body">
        <!-- title -->
        <div class="field">
          <label class="field-label">
            <span class="label-key">title</span>
            <span class="label-colon">:</span>
          </label>
          <input
            v-model="title"
            type="text"
            class="field-input"
            placeholder="prompt title"
            spellcheck="false"
          />
        </div>

        <!-- content -->
        <div class="field">
          <label class="field-label">
            <span class="label-key">content</span>
            <span class="label-colon">:</span>
          </label>
          <textarea
            v-model="content"
            class="field-textarea"
            placeholder="prompt content..."
            rows="6"
            spellcheck="false"
          ></textarea>
        </div>

        <!-- favorite -->
        <div class="field">
          <label class="field-label">
            <span class="label-key">favorite</span>
            <span class="label-colon">:</span>
          </label>
          <button
            class="fav-btn"
            :class="{ active: favorite }"
            @click="favorite = !favorite"
          >
            <span class="fav-mark">{{ favorite ? '[*]' : '[ ]' }}</span>
            <span>{{ favorite ? 'starred' : 'not starred' }}</span>
          </button>
        </div>

        <!-- category -->
        <div class="field">
          <label class="field-label">
            <span class="label-key">category</span>
            <span class="label-colon">:</span>
          </label>
          <div class="cat-row">
            <button
              v-for="cat in categories"
              :key="cat.id"
              class="cat-btn"
              :class="{ active: category === cat.id }"
              @click="category = cat.id"
            >
              <span class="cat-dot" :style="{ background: cat.color }"></span>
              <span>{{ cat.name }}</span>
            </button>
          </div>
          <div class="custom-cat-row">
            <input
              v-model="customCategory"
              type="text"
              class="field-input custom-cat-input"
              placeholder="or custom category..."
              spellcheck="false"
              @focus="category = 'custom'"
            />
          </div>
        </div>

        <!-- tags -->
        <div class="field">
          <label class="field-label">
            <span class="label-key">tags</span>
            <span class="label-colon">:</span>
            <span class="label-hint"># csv</span>
          </label>
          <input
            v-model="tags"
            type="text"
            class="field-input"
            placeholder="ai, coding, creative"
            spellcheck="false"
          />
        </div>
      </div>

      <!-- 底部 -->
      <div class="editor-footer">
        <span class="footer-mode">-- NORMAL --</span>
        <span class="footer-draft">auto-save: on</span>
        <div class="footer-actions">
          <button class="action ai" @click="emit('ai-generate')">
            <span class="act-key">,ai</span>
          </button>
          <button class="action cancel" @click="emit('close')">
            <span class="act-key">:q</span> quit
          </button>
          <button
            class="action save"
            :disabled="!canSave"
            @click="handleSave"
          >
            <span class="act-key">:w</span> save
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001;
  backdrop-filter: blur(3px);
}

.editor-modal {
  width: 90%;
  max-width: 520px;
  background: var(--bg-primary);
  border: 1px solid var(--border-active);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg), 0 0 30px rgba(99, 102, 241, 0.1);
  overflow: hidden;
}

/* ── Titlebar ── */
.editor-titlebar {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}
.editor-dots { display: flex; gap: 7px; }
.dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  background: var(--text-muted);
}
.dot.close { background: #EF4444; cursor: pointer; transition: all 0.15s; }
.dot.close:hover { background: #F87171; box-shadow: 0 0 6px rgba(239, 68, 68, 0.4); }
.editor-title {
  flex: 1; text-align: center;
  font-family: var(--font-mono); font-size: 11px;
  display: flex; align-items: center; justify-content: center; gap: 5px;
}
.title-path { color: var(--terminal-green); }
.title-sep { color: var(--text-muted); }
.title-file { color: var(--text-secondary); }
.editor-spacer { width: 57px; }

/* ── Body ── */
.editor-body {
  padding: 18px 20px;
  max-height: 58vh;
  overflow-y: auto;
}
.field { margin-bottom: 16px; }
.field-label {
  display: flex; align-items: center; gap: 2px;
  margin-bottom: 6px;
  font-family: var(--font-mono); font-size: 11px;
}
.label-key { color: var(--accent); font-weight: 600; }
.label-colon { color: var(--text-muted); margin-right: 6px; }
.label-hint { color: var(--text-muted); font-size: 10px; font-style: italic; }

.field-input, .field-textarea {
  width: 100%;
  padding: 8px 12px;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-primary);
  outline: none;
  transition: all var(--transition-normal);
}
.field-input:focus, .field-textarea:focus {
  border-color: var(--primary);
  box-shadow: var(--glow-sm);
}
.field-input::placeholder, .field-textarea::placeholder {
  color: var(--text-muted);
  font-style: italic;
  opacity: 0.5;
}
.field-textarea {
  resize: vertical;
  min-height: 120px;
  line-height: 1.6;
}

/* ── Category ── */
.cat-row { display: flex; flex-wrap: wrap; gap: 6px; }
.cat-btn {
  display: flex; align-items: center; gap: 5px;
  padding: 5px 12px;
  border: 1px solid var(--border-color);
  background: transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono); font-size: 11px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-normal);
}
.cat-btn:hover { border-color: var(--text-muted); color: var(--text-secondary); }
.cat-btn.active {
  border-color: var(--primary);
  color: var(--primary-light);
  background: rgba(99, 102, 241, 0.08);
}
.cat-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.custom-cat-row { margin-top: 8px; }
.custom-cat-input { font-size: 11px; }

/* ── Favorite ── */
.fav-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 14px;
  border: 1px solid var(--border-color);
  background: transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono); font-size: 11px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-normal);
}
.fav-btn:hover { border-color: var(--warning); color: var(--warning); }
.fav-btn.active {
  border-color: var(--warning);
  color: var(--warning);
  background: rgba(245, 158, 11, 0.08);
}
.fav-mark { font-size: 11px; }

/* ── Footer ── */
.editor-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 14px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
}
.footer-mode {
  font-family: var(--font-mono); font-size: 10px;
  color: var(--terminal-green);
  opacity: 0.6;
  letter-spacing: 0.5px;
}
.footer-draft {
  font-family: var(--font-mono); font-size: 10px;
  color: var(--accent);
  opacity: 0.7;
  letter-spacing: 0.3px;
}
.footer-actions { display: flex; gap: 6px; }
.action {
  display: flex; align-items: center; gap: 4px;
  padding: 5px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono); font-size: 11px;
  cursor: pointer;
  transition: all var(--transition-normal);
  background: transparent;
  color: var(--text-secondary);
}
.action:hover { border-color: var(--text-muted); }
.action.save {
  border-color: var(--terminal-green);
  color: var(--terminal-green);
}
.action.save:hover:not(:disabled) {
  background: var(--terminal-green);
  color: var(--bg-primary);
}
.action.save:disabled { opacity: 0.3; cursor: not-allowed; }
.action.ai {
  border-color: var(--accent);
  color: var(--accent);
}
.action.ai:hover {
  background: var(--accent);
  color: var(--bg-primary);
}
.act-key { font-weight: 600; opacity: 0.7; }
</style>
