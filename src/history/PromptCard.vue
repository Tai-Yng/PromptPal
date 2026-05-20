<script setup lang="ts">
import { computed } from 'vue'
import type { Prompt } from '../types'

const props = defineProps<{
  prompt: Prompt
  isCopied: boolean
  isDefault?: boolean
}>()

const emit = defineEmits<{
  (e: 'copy'): void
  (e: 'edit'): void
  (e: 'delete'): void
  (e: 'favorite'): void
  (e: 'set-default'): void
}>()

const truncated = computed(() => {
  if (props.prompt.content.length > 120) {
    return props.prompt.content.slice(0, 120) + '...'
  }
  return props.prompt.content
})

const catColors: Record<string, string> = {
  chat: '#3B82F6',
  image: '#A855F7',
  code: '#22C55E',
  writing: '#F59E0B',
  other: '#64748B'
}

const catColor = computed(() => catColors[props.prompt.category] || '#64748B')
</script>

<template>
  <div class="prompt-row" :class="{ copied: isCopied, 'is-default': isDefault }">
    <!-- 行号 + 来源标记 -->
    <div class="row-gutter">
      <span class="line-no" :style="{ color: catColor }">●</span>
    </div>

    <!-- 主内容 -->
    <div class="row-content" @click="emit('copy')">
      <div class="row-header">
        <span class="row-title">{{ prompt.title }}</span>
        <span v-if="isDefault" class="default-badge">DEFAULT</span>
        <span v-if="prompt.favorite" class="star">★</span>
      </div>
      <pre class="row-body">{{ truncated }}</pre>
      <div class="row-meta">
        <span class="meta-tag" v-for="tag in prompt.tags.slice(0, 3)" :key="tag">#{{ tag }}</span>
        <span class="meta-source" :class="prompt.source">
          {{ prompt.source === 'local' ? 'local' : prompt.source }}
        </span>
        <span class="meta-usage">{{ prompt.useCount }}x</span>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="row-actions">
      <button class="act-btn" @click.stop="emit('copy')" title="复制">
        <span>{{ isCopied ? '✓' : '⎘' }}</span>
      </button>
      <button class="act-btn" @click.stop="emit('edit')" title="编辑">✎</button>
      <button
        class="act-btn default"
        :class="{ active: isDefault }"
        @click.stop="emit('set-default')"
        title="设为默认"
      >
        ★
      </button>
      <button class="act-btn del" @click.stop="emit('delete')" title="删除">×</button>
    </div>

    <!-- 复制成功覆盖 -->
    <Transition name="flash">
      <div v-if="isCopied" class="copy-flash">
        <span class="flash-icon">✓</span> copied to clipboard
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.prompt-row {
  display: flex;
  align-items: stretch;
  padding: 0;
  border-bottom: 1px solid rgba(30, 58, 95, 0.4);
  cursor: pointer;
  transition: background 0.1s ease;
  position: relative;
}

.prompt-row:hover {
  background: var(--bg-hover);
}

.prompt-row:hover .row-actions {
  opacity: 1;
}

.prompt-row.copied {
  background: rgba(0, 212, 170, 0.06);
}

/* 默认提示词 - 荧光背景 */
.prompt-row.is-default {
  background: rgba(0, 255, 136, 0.12);
  border-left: 3px solid #00ff88;
  box-shadow: inset 0 0 20px rgba(0, 255, 136, 0.1);
}

.prompt-row.is-default:hover {
  background: rgba(0, 255, 136, 0.18);
  box-shadow: inset 0 0 30px rgba(0, 255, 136, 0.15), 0 0 10px rgba(0, 255, 136, 0.1);
}

/* 行号槽 */
.row-gutter {
  width: 32px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 10px;
  flex-shrink: 0;
}

.line-no {
  font-size: 10px;
}

/* 主内容 */
.row-content {
  flex: 1;
  padding: 8px 0;
  min-width: 0;
}

.row-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.row-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.star {
  color: var(--accent-color);
  font-size: 12px;
  flex-shrink: 0;
}

.default-badge {
  font-size: 9px;
  font-weight: 700;
  color: #00ff88;
  background: rgba(0, 255, 136, 0.15);
  border: 1px solid rgba(0, 255, 136, 0.4);
  padding: 1px 5px;
  border-radius: 3px;
  text-shadow: 0 0 8px rgba(0, 255, 136, 0.6);
  box-shadow: 0 0 6px rgba(0, 255, 136, 0.2);
  flex-shrink: 0;
  letter-spacing: 0.5px;
}

.row-body {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  padding: 6px 10px;
  background: var(--bg-input);
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  transition: border-color 0.15s ease;
}

.prompt-row:hover .row-body {
  border-color: var(--border-color);
}

/* 元信息 */
.row-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  font-size: 11px;
}

.meta-tag {
  color: var(--primary-color);
  opacity: 0.7;
}

.meta-source {
  color: var(--text-muted);
  padding: 0 4px;
  border: 1px solid var(--border-color);
  border-radius: 2px;
  font-size: 10px;
}

.meta-source.local { color: var(--success-color); border-color: rgba(34,197,94,0.3); }

.meta-usage {
  color: var(--text-muted);
  margin-left: auto;
}

/* 操作按钮 */
.row-actions {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  padding: 0 8px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.act-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.1s ease;
}

.act-btn:hover {
  background: var(--bg-card);
  color: var(--primary-color);
}

.act-btn.del:hover {
  color: var(--error-color);
}

.act-btn.default {
  color: var(--text-muted);
}

.act-btn.default.active {
  color: #00ff88;
  text-shadow: 0 0 8px rgba(0, 255, 136, 0.6);
}

.act-btn.default:hover {
  color: #00ff88;
}

/* 复制成功 */
.copy-flash {
  position: absolute;
  inset: 0;
  background: rgba(0, 212, 170, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  color: var(--primary-color);
  font-weight: 600;
  z-index: 1;
}

.flash-icon {
  width: 20px;
  height: 20px;
  background: var(--primary-color);
  color: var(--bg-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
}

.flash-enter-active, .flash-leave-active { transition: all 0.2s ease; }
.flash-enter-from, .flash-leave-to { opacity: 0; }
</style>
