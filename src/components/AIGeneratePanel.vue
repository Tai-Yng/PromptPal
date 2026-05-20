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

  isGenerating.value = true
  error.value = ''
  result.value = ''

  try {
    const generated = await store.generatePrompt(input.value, mode.value)
    result.value = generated
  } catch (err: any) {
    error.value = err.message || 'Failed to generate'
  } finally {
    isGenerating.value = false
  }
}

const handleApply = () => {
  if (result.value) {
    emit('apply', result.value)
  }
}

const handleClose = () => {
  emit('close')
}
</script>

<template>
  <div class="panel-overlay" @click.self="handleClose">
    <div class="ai-modal">
      <!-- 标题栏 -->
      <div class="ai-titlebar">
        <div class="titlebar-dots">
          <span class="dot close" @click="handleClose"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
      <span class="titlebar-text">
        <span class="title-icon">✨</span> AI Generate
      </span>
      <div class="titlebar-spacer"></div>
      </div>

      <!-- 未配置提示 -->
      <div v-if="!store.isConfigured" class="not-configured">
        <span class="nc-icon">⚠️</span>
        <p>AI not configured</p>
        <p class="nc-hint">Please configure API settings first</p>
        <button class="nc-btn" @click="$emit('close'); $emit('settings')">Open Settings</button>
      </div>

      <!-- 主内容 -->
      <template v-else>
        <!-- 模式选择 -->
        <div class="mode-tabs">
          <button
            class="mode-tab"
            :class="{ active: mode === 'generate' }"
            @click="mode = 'generate'"
          >
            <span class="tab-icon">✨</span> Generate
          </button>
          <button
            class="mode-tab"
            :class="{ active: mode === 'optimize' }"
            @click="mode = 'optimize'"
          >
            <span class="tab-icon">🔧</span> Optimize
          </button>
        </div>

        <!-- 输入区 -->
        <div class="input-section">
          <label class="input-label">
            {{ mode === 'generate' ? 'Describe what you need:' : 'Paste your prompt:' }}
          </label>
          <textarea
            v-model="input"
            class="input-textarea"
            :placeholder="mode === 'generate' ? 'e.g., A professional coding assistant for Python...' : 'Paste your current prompt here...'"
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
          <span v-else class="btn-icon">⚡</span>
          <span>{{ isGenerating ? 'Generating...' : (mode === 'generate' ? 'Generate Prompt' : 'Optimize Prompt') }}</span>
        </button>

        <!-- 错误提示 -->
        <div v-if="error" class="error-msg">
          <span class="error-icon">❌</span> {{ error }}
        </div>

        <!-- 结果区 -->
        <div v-if="result" class="result-section">
          <div class="result-header">
            <span class="result-label">Result:</span>
            <button class="apply-btn" @click="handleApply">
              <span>Apply →</span>
            </button>
          </div>
          <pre class="result-content">{{ result }}</pre>
        </div>
      </template>

      <!-- 底部 -->
      <div class="ai-footer">
        <span class="footer-hint">
          <span class="hint-key">esc</span> to close
        </span>
        <span class="provider-badge">
          {{ store.providerPresets[store.aiConfig.provider].name }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 遮罩层 */
.panel-overlay {
  position: fixed;
  inset: 0;
  z-index: 10003;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}

.ai-modal {
  width: 90%;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 标题栏 */
.ai-titlebar {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
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
.dot:not(.close) { background: var(--text-muted); }

.titlebar-text {
  flex: 1;
  text-align: center;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
}

.title-icon {
  color: var(--primary-color);
  margin-right: 6px;
}

.titlebar-spacer { width: 52px; }

/* 未配置提示 */
.not-configured {
  padding: 40px;
  text-align: center;
  color: var(--text-secondary);
}

.nc-icon { font-size: 32px; margin-bottom: 12px; }
.not-configured p { margin-bottom: 4px; }
.nc-hint { font-size: 12px; color: var(--text-muted); margin-bottom: 16px; }

.nc-btn {
  padding: 8px 20px;
  border: 1px solid var(--primary-color);
  background: transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--primary-color);
  cursor: pointer;
  transition: all 0.15s ease;
}

.nc-btn:hover {
  background: var(--primary-color);
  color: var(--bg-primary);
}

/* 模式选择 */
.mode-tabs {
  display: flex;
  padding: 12px 16px 0;
  gap: 8px;
}

.mode-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  border: 1px solid var(--border-color);
  background: transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.mode-tab:hover {
  border-color: var(--text-muted);
  color: var(--text-secondary);
}

.mode-tab.active {
  border-color: var(--primary-color);
  color: var(--primary-color);
  background: rgba(0, 212, 170, 0.08);
}

.tab-icon { font-size: 13px; }

/* 输入区 */
.input-section {
  padding: 16px;
}

.input-label {
  display: block;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.input-textarea {
  width: 100%;
  padding: 12px;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--text-primary);
  resize: vertical;
  min-height: 100px;
  outline: none;
  transition: border-color 0.15s ease;
}

.input-textarea:focus {
  border-color: var(--primary-color);
  box-shadow: var(--glow-sm);
}

.input-textarea::placeholder { color: var(--text-muted); }

/* 生成按钮 */
.generate-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 0 16px 16px;
  padding: 12px;
  border: 1px solid var(--primary-color);
  background: var(--primary-color);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--bg-primary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.generate-btn:hover:not(:disabled) {
  background: var(--primary-light);
  border-color: var(--primary-light);
}

.generate-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(0, 0, 0, 0.3);
  border-top-color: var(--bg-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.btn-icon { font-size: 14px; }

/* 错误提示 */
.error-msg {
  margin: 0 16px 16px;
  padding: 10px 12px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--error-color);
}

.error-icon { margin-right: 6px; }

/* 结果区 */
.result-section {
  margin: 0 16px 16px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.result-label {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
}

.apply-btn {
  padding: 4px 12px;
  border: 1px solid var(--success-color);
  background: transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--success-color);
  cursor: pointer;
  transition: all 0.15s ease;
}

.apply-btn:hover {
  background: var(--success-color);
  color: var(--bg-primary);
}

.result-content {
  padding: 12px;
  margin: 0;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-primary);
  line-height: 1.6;
  background: var(--bg-input);
  white-space: pre-wrap;
  max-height: 200px;
  overflow-y: auto;
}

/* 底部 */
.ai-footer {
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

.provider-badge {
  padding: 2px 10px;
  background: rgba(0, 212, 170, 0.1);
  border: 1px solid rgba(0, 212, 170, 0.3);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--primary-color);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
