<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import type { Prompt } from '../types'

const props = defineProps<{
  prompt: Prompt
  isCopied?: boolean
  isDefault?: boolean
  isExpanded?: boolean
}>()

const emit = defineEmits<{
  (e: 'copy'): void
  (e: 'edit'): void
  (e: 'delete'): void
  (e: 'favorite'): void
  (e: 'set-default'): void
  (e: 'expand'): void
}>()

const flashCopied = ref(false)
const isHovered = ref(false)
const isFocused = ref(false)

const truncated = computed(() => {
  if (props.prompt.content.length > 150) {
    return props.prompt.content.slice(0, 150) + '...'
  }
  return props.prompt.content
})

const hasVariables = computed(() => {
  return props.prompt.content.includes('{{') && props.prompt.content.includes('}}')
})

const showExpandButton = computed(() => {
  return props.prompt.content.length > 150
})

const handleClick = () => {
  if (!props.isExpanded) {
    emit('expand')
  }
}

const handleCopy = (e: MouseEvent) => {
  e.stopPropagation()
  emit('copy')
}

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !props.isExpanded) {
    e.preventDefault()
    emit('expand')
  } else if (e.key === 'Enter' && props.isExpanded) {
    e.preventDefault()
    emit('copy')
  } else if (e.key === ' ' && !props.isExpanded) {
    e.preventDefault()
    emit('expand')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})

const catColors: Record<string, string> = {
  chat: '#818CF8',
  image: '#A78BFA',
  code: '#22D3EE',
  writing: '#F59E0B',
  other: '#6B7280'
}

const catColor = computed(() => catColors[props.prompt.category] || '#6B7280')

// 变量提取
const extractedVariables = computed(() => {
  const vars = new Set<string>()
  const regex = /\{\{(\w+)\}\}/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(props.prompt.content)) !== null) {
    vars.add(match[1])
  }
  return Array.from(vars)
})

const displayContent = computed(() => {
  if (props.isExpanded) return props.prompt.content
  return truncated.value
})
</script>

<template>
  <div 
    class="prompt-row" 
    :class="{ 
      copied: isCopied, 
      'is-default': isDefault,
      'is-expanded': isExpanded,
      'has-variables': hasVariables
    }"
    @click="handleClick"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
    @focus="isFocused = true"
    @blur="isFocused = false"
    tabindex="0"
    role="button"
    :aria-label="isExpanded ? '点击复制提示词' : '点击展开查看完整提示词'"
  >
    <!-- 行号槽 -->
    <div class="row-gutter">
      <span class="line-dot" :style="{ background: catColor }"></span>
      <span v-if="hasVariables" class="variable-indicator" title="包含变量">var</span>
    </div>

    <!-- 主内容 -->
    <div class="row-content">
      <div class="row-header">
        <span class="row-prompt">&gt;</span>
        <span class="row-title">{{ prompt.title }}</span>
        <span v-if="isDefault" class="default-badge">[DEFAULT]</span>
        <span v-if="prompt.favorite" class="fav-mark">*</span>
        <span v-if="hasVariables" class="variable-badge" title="包含变量模板">
          <span class="variable-bracket">{{ '{' }}{{ '{' }}</span>var<span class="variable-bracket">{{ '}' }}{{ '}' }}</span>
        </span>
      </div>
      
      <!-- 变量提示 -->
      <div v-if="hasVariables && !isExpanded" class="variable-hint">
        <span class="hint-text">包含 {{ extractedVariables.length }} 个变量</span>
        <span class="hint-vars">{{ extractedVariables.join(', ') }}</span>
      </div>
      
      <div class="row-body">
        <code class="body-code">{{ displayContent }}</code>
        <div v-if="showExpandButton && !isExpanded" class="expand-overlay">
          <button class="expand-btn" @click.stop="emit('expand')" title="展开查看完整内容">
            <span class="expand-text">... 点击展开 ({{ prompt.content.length }} 字符)</span>
          </button>
        </div>
      </div>
      
      <div class="row-meta">
        <span class="meta-tag" v-for="tag in prompt.tags.slice(0, 4)" :key="tag">{{ tag }}</span>
        <span class="meta-source" :class="prompt.source">
          {{ prompt.source === 'local' ? 'local' : prompt.source }}
        </span>
        <span class="meta-usage">{{ prompt.useCount }}x</span>
      </div>
    </div>

    <!-- 操作按钮 (terminal style) -->
    <div class="row-actions">
      <button class="act-btn" @click.stop="emit('copy')" title="复制">
        <span class="act-sym">cp</span>
      </button>
      <button class="act-btn" @click.stop="emit('expand')" title="展开/收起">
        <span class="act-sym">{{ isExpanded ? 'cl' : 'op' }}</span>
      </button>
      <button class="act-btn" @click.stop="emit('edit')" title="编辑">
        <span class="act-sym">ed</span>
      </button>
      <button
        class="act-btn fav"
        :class="{ active: isDefault }"
        @click.stop="emit('set-default')"
        title="设为默认"
      >
        <span class="act-sym">df</span>
      </button>
      <button class="act-btn del" @click.stop="emit('delete')" title="删除">
        <span class="act-sym">rm</span>
      </button>
    </div>

    <!-- 复制成功覆盖 -->
    <Transition name="flash">
      <div v-if="isCopied" class="copy-flash">
        <span class="flash-ok">[OK]</span> copied
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.prompt-row {
  display: flex;
  align-items: stretch;
  padding: 0;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-normal);
  position: relative;
  overflow: visible;
  outline: none;
}

.prompt-row:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}

.prompt-row.is-expanded {
  background: var(--bg-primary);
  border-color: var(--primary);
  box-shadow: var(--glow-md);
}

.prompt-row.has-variables {
  border-left: 3px solid var(--accent);
}

.prompt-row:hover {
  border-color: var(--border-active);
  box-shadow: var(--glow-sm);
  transform: translateX(2px);
}

.prompt-row:hover .row-actions {
  opacity: 1;
}

.prompt-row.copied {
  border-color: var(--terminal-green);
  box-shadow: 0 0 10px var(--terminal-green-glow);
}

/* ── Default prompt highlight ── */
.prompt-row.is-default {
  background: rgba(99, 102, 241, 0.08);
  border-color: var(--primary);
  box-shadow: 0 0 12px rgba(99, 102, 241, 0.12), inset 0 0 20px rgba(99, 102, 241, 0.04);
}
.prompt-row.is-default:hover {
  background: rgba(99, 102, 241, 0.14);
  box-shadow: 0 0 18px rgba(99, 102, 241, 0.18), inset 0 0 30px rgba(99, 102, 241, 0.06);
}

/* ── Gutter ── */
.row-gutter {
  width: 28px;
  min-width: 28px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 12px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-light);
  position: relative;
}
.line-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  opacity: 0.6;
  transition: all var(--transition-normal);
}
.prompt-row:hover .line-dot { opacity: 1; box-shadow: 0 0 6px currentColor; }

.variable-indicator {
  position: absolute;
  top: 4px;
  right: 2px;
  font-size: 7px;
  color: var(--accent);
  font-weight: 700;
  background: rgba(139, 92, 246, 0.1);
  padding: 1px 3px;
  border-radius: 2px;
  opacity: 0.7;
  letter-spacing: 0.3px;
}

/* ── Content ── */
.row-content {
  flex: 1;
  padding: 10px 12px;
  min-width: 0;
}

.row-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  font-family: var(--font-mono);
}
.row-prompt {
  color: var(--terminal-green);
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}
.row-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0.3px;
}
.fav-mark {
  color: var(--warning);
  font-size: 13px;
  font-weight: bold;
  flex-shrink: 0;
}
.default-badge {
  font-size: 9px;
  font-weight: 700;
  color: var(--primary-light);
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.35);
  padding: 1px 6px;
  border-radius: 3px;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}

/* ── Variable Badge ── */
.variable-badge {
  font-size: 9px;
  font-weight: 700;
  color: var(--accent);
  background: rgba(139, 92, 246, 0.15);
  border: 1px solid rgba(139, 92, 246, 0.35);
  padding: 1px 5px;
  border-radius: 3px;
  letter-spacing: 0.3px;
  flex-shrink: 0;
  cursor: default;
}
.variable-bracket {
  opacity: 0.5;
  font-size: 8px;
}

/* ── Variable Hint ── */
.variable-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  margin-bottom: 6px;
  background: rgba(139, 92, 246, 0.08);
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 10px;
}
.hint-text {
  color: var(--accent);
  font-weight: 600;
}
.hint-vars {
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

/* ── Body (code block) ── */
.row-body {
  position: relative;
  padding: 8px 10px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.55;
  transition: border-color var(--transition-normal);
  min-height: 40px;
}
.prompt-row:hover .row-body {
  border-color: var(--border-active);
}
.body-code {
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: break-word;
  font-family: inherit;
  font-size: inherit;
  color: inherit;
  display: block;
}

/* ── Expand Overlay ── */
.expand-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, 
    rgba(15, 23, 42, 0) 0%, 
    rgba(15, 23, 42, 0.7) 30%, 
    rgba(15, 23, 42, 0.95) 100%
  );
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 20px 10px 8px;
  border-radius: var(--radius-sm);
  opacity: 0;
  transition: opacity var(--transition-normal);
}

.prompt-row:hover .expand-overlay {
  opacity: 1;
}

.expand-btn {
  background: rgba(99, 102, 241, 0.2);
  border: 1px solid rgba(99, 102, 241, 0.4);
  border-radius: var(--radius-sm);
  padding: 4px 12px;
  cursor: pointer;
  transition: all var(--transition-normal);
  backdrop-filter: blur(4px);
}

.expand-btn:hover {
  background: rgba(99, 102, 241, 0.3);
  border-color: var(--primary);
  box-shadow: 0 0 8px rgba(99, 102, 241, 0.3);
}

.expand-text {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--primary-light);
  font-weight: 600;
  letter-spacing: 0.3px;
}

/* ── Meta ── */
.row-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-family: var(--font-mono);
}
.meta-tag {
  font-size: 10px;
  color: var(--primary-light);
  opacity: 0.7;
  letter-spacing: 0.3px;
}
.meta-source {
  font-size: 9px;
  color: var(--text-muted);
  padding: 0 5px;
  border: 1px solid var(--border-color);
  border-radius: 2px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.meta-source.local {
  color: var(--terminal-green);
  border-color: rgba(74, 222, 128, 0.25);
}
.meta-usage {
  margin-left: auto;
  font-size: 10px;
  color: var(--text-muted);
}

/* ── Actions ── */
.row-actions {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  padding: 8px 6px;
  opacity: 0;
  transition: opacity var(--transition-normal);
  border-left: 1px solid var(--border-light);
}
.act-btn {
  width: 28px;
  height: 22px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}
.act-btn:hover { background: var(--bg-hover); }
.act-btn.del:hover { background: rgba(239, 68, 68, 0.12); }

.act-sym {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--text-muted);
  font-weight: 600;
  letter-spacing: 0.5px;
}
.act-btn:hover .act-sym { color: var(--primary-light); }
.act-btn.fav.active .act-sym { color: var(--primary-light); }
.act-btn.del:hover .act-sym { color: #FCA5A5; }

/* ── Copy Flash ── */
.copy-flash {
  position: absolute;
  inset: 0;
  background: rgba(74, 222, 128, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--terminal-green);
  font-weight: 600;
  z-index: 1;
  letter-spacing: 0.5px;
}
.flash-ok {
  color: var(--bg-primary);
  background: var(--terminal-green);
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 700;
}

.flash-enter-active, .flash-leave-active { transition: all var(--transition-normal); }
.flash-enter-from, .flash-leave-to { opacity: 0; }
</style>
