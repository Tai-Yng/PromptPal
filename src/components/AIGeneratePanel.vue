<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSettingsStore } from '../stores/settingsStore'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'apply', content: string): void
}>()

const store = useSettingsStore()

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') { e.preventDefault(); emit('close') }
}
onMounted(() => { window.addEventListener('keydown', handleKeyDown) })
onUnmounted(() => { window.removeEventListener('keydown', handleKeyDown) })

const mode = ref<'generate' | 'optimize'>('generate')
const input = ref('')
const result = ref('')
const isGenerating = ref(false)
const error = ref('')

const isReady = computed(() => store.isConfigured && input.value.trim().length > 0 && !isGenerating.value)

const handleGenerate = async () => {
  if (!isReady.value) return
  isGenerating.value = true; error.value = ''; result.value = ''
  try {
    const generated = await store.generatePromptStream(input.value, mode.value, (token) => {
      result.value += token
    })
    result.value = generated
  } catch (err: any) {
    error.value = err.message || 'generation failed'
  } finally {
    isGenerating.value = false
  }
}

const handleApply = () => { if (result.value) emit('apply', result.value) }
</script>

<template>
  <div class="panel-overlay" @click.self="emit('close')">
    <div class="ai-modal">
      <!-- 标题栏 -->
      <div class="ai-titlebar">
        <div class="titlebar-dots">
          <span class="dot close" @click="emit('close')"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
        <span class="titlebar-text">
          <span class="title-path">ai-gen</span>
          <span class="title-sep">::</span>
          <span class="title-file">~/generate</span>
        </span>
        <div class="titlebar-spacer"></div>
      </div>

      <!-- 未配置 -->
      <div v-if="!store.isConfigured" class="not-configured">
        <span class="nc-msg">[error] AI not configured</span>
        <p class="nc-hint">configure API settings first</p>
        <button class="nc-btn" @click="$emit('close'); $emit('settings')">
          $ settings
        </button>
      </div>

      <template v-else>
        <!-- 模式选择 -->
        <div class="mode-tabs">
          <button
            class="mode-tab"
            :class="{ active: mode === 'generate' }"
            @click="mode = 'generate'"
          >
            <span class="tab-tag">&lt;gen&gt;</span> generate
          </button>
          <button
            class="mode-tab"
            :class="{ active: mode === 'optimize' }"
            @click="mode = 'optimize'"
          >
            <span class="tab-tag">&lt;opt&gt;</span> optimize
          </button>
        </div>

        <!-- 输入区 -->
        <div class="input-section">
          <label class="input-label">
            <span class="label-key">{{ mode === 'generate' ? 'describe' : 'input' }}</span>
            <span class="label-colon">:</span>
          </label>
          <textarea
            v-model="input"
            class="input-textarea"
            :placeholder="mode === 'generate'
              ? 'describe what you need...'
              : 'paste your prompt here...'"
            rows="4"
          ></textarea>
        </div>

        <!-- 生成按钮 -->
        <button
          class="generate-btn"
          :disabled="!isReady"
          @click="handleGenerate"
        >
          <span v-if="isGenerating" class="btn-spinner"></span>
          <span v-else class="btn-sym">$</span>
          <span>{{ isGenerating
            ? 'generating...'
            : `ai ${mode} --model=${store.aiConfig.model}` }}</span>
        </button>

        <!-- 错误 -->
        <div v-if="error" class="error-msg">
          <span class="error-prefix">[ERR]</span> {{ error }}
        </div>

        <!-- 结果区 -->
        <div v-if="result" class="result-section">
          <div class="result-header">
            <span class="result-label">stdout ::</span>
            <button class="apply-btn" @click="handleApply">
              apply &gt;
            </button>
          </div>
          <pre class="result-content">{{ result }}</pre>
        </div>
      </template>

      <!-- 底部 -->
      <div class="ai-footer">
        <span class="footer-hint">
          <span class="hint-key">esc</span> close
        </span>
        <span class="provider-badge">
          {{ store.providerPresets[store.aiConfig.provider].name }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel-overlay {
  position: fixed; inset: 0; z-index: 10003;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}

.ai-modal {
  width: 92%; max-width: 560px;
  background: var(--bg-primary);
  border: 1px solid var(--border-active);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg), 0 0 30px rgba(99, 102, 241, 0.1);
  overflow: hidden;
  display: flex; flex-direction: column;
}

/* ── Titlebar ── */
.ai-titlebar {
  display: flex; align-items: center;
  padding: 10px 14px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}
.titlebar-dots { display: flex; gap: 7px; }
.dot { width: 10px; height: 10px; border-radius: 50%; }
.dot.close { background: #EF4444; cursor: pointer; }
.dot.close:hover { background: #F87171; box-shadow: 0 0 6px rgba(239, 68, 68, 0.4); }
.dot:not(.close) { background: var(--text-muted); }
.titlebar-text {
  flex: 1; text-align: center;
  font-family: var(--font-mono); font-size: 11px;
  display: flex; align-items: center; justify-content: center; gap: 5px;
}
.title-path { color: var(--accent); }
.title-sep { color: var(--text-muted); }
.title-file { color: var(--text-secondary); }
.titlebar-spacer { width: 57px; }

/* ── Not Configured ── */
.not-configured {
  padding: 40px; text-align: center;
  font-family: var(--font-mono);
}
.nc-msg { font-size: 13px; color: var(--warning); display: block; margin-bottom: 8px; }
.nc-hint { font-size: 11px; color: var(--text-muted); margin-bottom: 16px; }
.nc-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 18px;
  border: 1px solid var(--primary);
  background: transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono); font-size: 12px;
  color: var(--primary-light);
  cursor: pointer;
  transition: all var(--transition-normal);
}
.nc-btn:hover { background: var(--primary); color: #fff; }

/* ── Mode Tabs ── */
.mode-tabs {
  display: flex; padding: 12px 16px 0; gap: 8px;
}
.mode-tab {
  flex: 1;
  display: flex; align-items: center; justify-content: center; gap: 5px;
  padding: 10px;
  border: 1px solid var(--border-color);
  background: transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono); font-size: 11px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-normal);
}
.mode-tab:hover { border-color: var(--text-muted); color: var(--text-secondary); }
.mode-tab.active {
  border-color: var(--primary);
  color: var(--primary-light);
  background: rgba(99, 102, 241, 0.08);
}
.tab-tag { font-size: 10px; opacity: 0.7; font-weight: 600; }

/* ── Input ── */
.input-section { padding: 16px; }
.input-label {
  display: flex; align-items: center; gap: 2px;
  margin-bottom: 8px;
  font-family: var(--font-mono); font-size: 11px;
}
.label-key { color: var(--accent); font-weight: 600; }
.label-colon { color: var(--text-muted); }
.input-textarea {
  width: 100%; padding: 10px 12px;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono); font-size: 12px;
  color: var(--text-primary);
  resize: vertical; min-height: 90px;
  outline: none;
  transition: all var(--transition-normal);
}
.input-textarea:focus { border-color: var(--primary); box-shadow: var(--glow-sm); }
.input-textarea::placeholder { color: var(--text-muted); font-style: italic; opacity: 0.5; }

/* ── Generate Button ── */
.generate-btn {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  margin: 0 16px 16px; padding: 10px;
  border: 1px solid var(--primary);
  background: var(--primary);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono); font-size: 12px;
  color: #fff;
  cursor: pointer;
  transition: all var(--transition-normal);
}
.generate-btn:hover:not(:disabled) {
  background: var(--primary-light);
  border-color: var(--primary-light);
  box-shadow: var(--glow-md);
}
.generate-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.btn-sym { font-size: 12px; opacity: 0.7; }
.btn-spinner {
  width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

/* ── Error ── */
.error-msg {
  margin: 0 16px 16px; padding: 8px 12px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono); font-size: 11px;
  color: #FCA5A5;
}
.error-prefix { font-weight: 700; }

/* ── Result ── */
.result-section {
  margin: 0 16px 16px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.result-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  font-family: var(--font-mono);
}
.result-label { font-size: 11px; color: var(--terminal-green); }
.apply-btn {
  padding: 4px 10px;
  border: 1px solid var(--terminal-green);
  background: transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono); font-size: 10px;
  color: var(--terminal-green);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.apply-btn:hover { background: var(--terminal-green); color: var(--bg-primary); }
.result-content {
  padding: 12px; margin: 0;
  font-family: var(--font-mono); font-size: 12px;
  color: var(--text-primary);
  line-height: 1.6;
  background: var(--bg-input);
  white-space: pre-wrap;
  max-height: 180px;
  overflow-y: auto;
}

/* ── Footer ── */
.ai-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 14px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
}
.footer-hint {
  font-family: var(--font-mono); font-size: 10px; color: var(--text-muted);
}
.hint-key {
  padding: 1px 6px;
  border: 1px solid var(--border-color);
  border-radius: 2px;
  font-size: 9px;
}
.provider-badge {
  padding: 2px 10px;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.25);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono); font-size: 9px;
  color: var(--primary-light);
  letter-spacing: 0.5px;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>
