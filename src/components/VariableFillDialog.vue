<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { parseVariables, substitute, recallVar, rememberVar, type PromptVariable } from '../services/variables'

const props = defineProps<{
  promptId: string
  title: string
  content: string
}>()

const emit = defineEmits<{
  (e: 'confirm', text: string): void
  (e: 'copy-original'): void
  (e: 'close'): void
}>()

const variables = ref<PromptVariable[]>([])
const values = ref<Record<string, string>>({})

onMounted(() => {
  variables.value = parseVariables(props.content)
  const init: Record<string, string> = {}
  for (const v of variables.value) {
    init[v.name] = recallVar(props.promptId, v.name)
  }
  values.value = init
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    emit('close')
  }
}

// 占位符显示文案（含花括号，须在 script 拼接以避免 Vue 模板解析冲突）
const displayName = (v: PromptVariable) =>
  v.syntax === 'brace' ? '{{' + v.name + '}}' : '[' + v.name + ']'

// 实时预览替换结果
const preview = computed(() => substitute(props.content, values.value))

// 确认：非空值写入记忆，回传替换后的文本
const handleConfirm = () => {
  for (const v of variables.value) {
    const val = values.value[v.name]
    if (val && val.trim()) rememberVar(props.promptId, v.name, val)
  }
  emit('confirm', substitute(props.content, values.value))
}
</script>

<template>
  <div class="fill-overlay" @click.self="emit('close')">
    <div class="fill-card">
      <div class="fill-cmd">
        <span class="fill-path">~/fill</span>
        <span class="fill-sep">::</span>
        <span class="fill-title">{{ title }}</span>
        <button class="fill-close" @click="emit('close')">x</button>
      </div>

      <div class="fill-vars">
        <div class="fill-row" v-for="v in variables" :key="v.name">
          <span class="fill-name" :class="v.syntax">
            {{ displayName(v) }}
          </span>
          <span class="fill-op">=</span>
          <input
            v-model="values[v.name]"
            class="fill-input"
            type="text"
            :placeholder="`value for ${v.name}`"
            @keydown.enter="handleConfirm"
          />
        </div>
      </div>

      <div class="fill-preview">
        <span class="preview-label">preview</span>
        <code class="preview-code">{{ preview }}</code>
      </div>

      <div class="fill-actions">
        <button class="fill-btn primary" @click="handleConfirm">
          <span class="btn-sym">$</span> copy filled
        </button>
        <button class="fill-btn" @click="emit('copy-original')">
          <span class="btn-sym">&gt;</span> copy original
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fill-overlay {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  font-family: var(--font-mono);
}
.fill-card {
  width: min(520px, calc(100vw - 40px));
  max-height: 80vh;
  overflow-y: auto;
  background: var(--bg-primary);
  border: 1px solid var(--primary);
  border-radius: var(--radius-md);
  box-shadow: var(--glow-md);
  padding: 14px 16px;
}

.fill-cmd {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 10px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--border-light);
  font-size: 11px;
}
.fill-path { color: var(--terminal-green); font-weight: 600; }
.fill-sep { color: var(--text-muted); }
.fill-title {
  flex: 1;
  color: var(--text-primary);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fill-close {
  background: none;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 2px 8px;
  cursor: pointer;
}
.fill-close:hover { color: #FCA5A5; border-color: rgba(239, 68, 68, 0.4); }

.fill-vars {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}
.fill-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.fill-name {
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
  background: rgba(139, 92, 246, 0.12);
  border: 1px solid rgba(139, 92, 246, 0.3);
  padding: 3px 8px;
  border-radius: var(--radius-sm);
  white-space: nowrap;
  max-width: 45%;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fill-name.brace { color: var(--primary-light); background: rgba(99, 102, 241, 0.12); border-color: rgba(99, 102, 241, 0.3); }
.fill-op { color: var(--text-muted); font-size: 12px; }
.fill-input {
  flex: 1;
  padding: 6px 10px;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-primary);
  outline: none;
  transition: all var(--transition-normal);
}
.fill-input:focus {
  border-color: var(--primary);
  box-shadow: var(--glow-sm);
}

.fill-preview {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  margin-bottom: 12px;
}
.preview-label {
  display: block;
  font-size: 9px;
  color: var(--text-muted);
  letter-spacing: 0.5px;
  text-transform: uppercase;
  margin-bottom: 4px;
}
.preview-code {
  display: block;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 120px;
  overflow-y: auto;
}

.fill-actions {
  display: flex;
  gap: 8px;
}
.fill-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid var(--border-color);
  background: transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-normal);
}
.fill-btn:hover { border-color: var(--border-active); color: var(--text-primary); }
.fill-btn.primary {
  border-color: var(--terminal-green);
  color: var(--terminal-green);
}
.fill-btn.primary:hover {
  background: var(--terminal-green);
  color: var(--bg-primary);
}
.btn-sym { opacity: 0.7; }
</style>
