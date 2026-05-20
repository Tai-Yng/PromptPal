<script setup lang="ts">
import { ref, computed } from 'vue'
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

// 是否使用自定义分类
const isCustomCategory = computed(() => {
  return !props.categories.some(c => c.id === category.value)
})

const canSave = computed(() => title.value.trim() && content.value.trim())

const handleSave = () => {
  if (!canSave.value) return
  // 如果使用自定义分类，使用自定义值
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
}
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
          <span class="title-prompt">$</span>
          {{ prompt ? 'edit prompt' : 'new prompt' }}
        </span>
        <div class="editor-spacer"></div>
      </div>

      <!-- 表单 -->
      <div class="editor-body">
        <!-- title -->
        <div class="field">
          <label class="field-label">
            <span class="label-key">title</span>
            <span class="label-sep">:</span>
          </label>
          <input 
            v-model="title"
            type="text" 
            class="field-input"
            placeholder="enter prompt title..."
            spellcheck="false"
          />
        </div>

        <!-- content -->
        <div class="field">
          <label class="field-label">
            <span class="label-key">content</span>
            <span class="label-sep">:</span>
          </label>
          <textarea 
            v-model="content"
            class="field-textarea"
            placeholder="enter prompt content..."
            rows="8"
            spellcheck="false"
          ></textarea>
        </div>

        <!-- favorite -->
        <div class="field">
          <label class="field-label">
            <span class="label-key">favorite</span>
            <span class="label-sep">:</span>
          </label>
          <button 
            class="fav-btn"
            :class="{ active: favorite }"
            @click="favorite = !favorite"
          >
            <span class="fav-star">★</span>
            <span>{{ favorite ? 'starred' : 'not starred' }}</span>
          </button>
        </div>

        <!-- category -->
        <div class="field">
          <label class="field-label">
            <span class="label-key">category</span>
            <span class="label-sep">:</span>
          </label>
          <div class="cat-row">
            <button 
              v-for="cat in categories"
              :key="cat.id"
              class="cat-btn"
              :class="{ active: category === cat.id }"
              @click="category = cat.id"
            >
              <span class="cat-icon">{{ cat.icon }}</span>
              <span>{{ cat.name }}</span>
            </button>
          </div>
          <!-- 自定义分类输入 -->
          <div class="custom-cat-row">
            <input 
              v-model="customCategory"
              type="text" 
              class="field-input custom-cat-input"
              placeholder="or enter custom category..."
              spellcheck="false"
              @focus="category = 'custom'"
            />
          </div>
        </div>

        <!-- tags -->
        <div class="field">
          <label class="field-label">
            <span class="label-key">tags</span>
            <span class="label-sep">:</span>
            <span class="label-hint">comma separated</span>
          </label>
          <input 
            v-model="tags"
            type="text" 
            class="field-input"
            placeholder="ai, coding, creative..."
            spellcheck="false"
          />
        </div>
      </div>

      <!-- 底部 -->
      <div class="editor-footer">
        <span class="footer-hint">
          <span class="hint-key">esc</span> to cancel
        </span>
        <div class="footer-actions">
          <button class="action ai" @click="emit('ai-generate')">
            <span>✨</span> AI
          </button>
          <button class="action cancel" @click="emit('close')">cancel</button>
          <button 
            class="action save" 
            :disabled="!canSave"
            @click="handleSave"
          >
            <span class="save-prefix">❯</span> save
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
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001;
  backdrop-filter: blur(2px);
}

.editor-modal {
  width: 90%;
  max-width: 480px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

/* 标题栏 */
.editor-titlebar {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.editor-dots {
  display: flex;
  gap: 6px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--text-muted);
}

.dot.close { background: #EF4444; cursor: pointer; }

.editor-title {
  flex: 1;
  text-align: center;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
}

.title-prompt {
  color: var(--primary-color);
  margin-right: 6px;
}

.editor-spacer { width: 52px; }

/* 表单 */
.editor-body {
  padding: 16px;
  max-height: 60vh;
  overflow-y: auto;
}

.field {
  margin-bottom: 14px;
}

.field-label {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 6px;
  font-family: var(--font-mono);
  font-size: 12px;
}

.label-key {
  color: var(--secondary-color);
}

.label-sep {
  color: var(--text-muted);
}

.label-hint {
  color: var(--text-muted);
  font-size: 11px;
  margin-left: 4px;
}

.field-input,
.field-textarea {
  width: 100%;
  padding: 8px 12px;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.15s ease;
}

.field-input:focus,
.field-textarea:focus {
  border-color: var(--primary-color);
  box-shadow: var(--glow-sm);
}

.field-input::placeholder,
.field-textarea::placeholder {
  color: var(--text-muted);
}

.field-textarea {
  resize: vertical;
  min-height: 140px;
  line-height: 1.5;
}

/* 分类选择 */
.cat-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.cat-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border: 1px solid var(--border-color);
  background: transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.cat-btn:hover {
  border-color: var(--text-muted);
  color: var(--text-secondary);
}

.cat-btn.active {
  border-color: var(--primary-color);
  color: var(--primary-color);
  background: rgba(0, 212, 170, 0.08);
}

.cat-icon { font-size: 13px; }

/* 自定义分类输入 */
.custom-cat-row {
  margin-top: 8px;
}

.custom-cat-input {
  font-size: 12px;
}

/* 收藏按钮 */
.fav-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 1px solid var(--border-color);
  background: transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.fav-btn:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
}

.fav-btn.active {
  border-color: var(--accent-color);
  color: var(--accent-color);
  background: rgba(251, 191, 36, 0.1);
}

.fav-star {
  font-size: 14px;
}

/* 底部 */
.editor-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
}

.footer-hint {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
}

.hint-key {
  padding: 1px 6px;
  border: 1px solid var(--border-color);
  border-radius: 3px;
  font-size: 10px;
}

.footer-actions {
  display: flex;
  gap: 8px;
}

.action {
  padding: 6px 16px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
  background: transparent;
  color: var(--text-secondary);
}

.action.cancel:hover {
  border-color: var(--text-muted);
}

.action.save {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.action.save:hover:not(:disabled) {
  background: var(--primary-color);
  color: var(--bg-primary);
}

.action.ai {
  border-color: var(--accent-color);
  color: var(--accent-color);
}

.action.ai:hover {
  background: var(--accent-color);
  color: var(--bg-primary);
}

.action.save:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.save-prefix {
  margin-right: 4px;
}
</style>
