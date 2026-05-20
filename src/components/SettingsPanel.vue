<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSettingsStore, type AIProvider } from '../stores/settingsStore'
import { usePromptStore } from '../stores/promptStore'
import PetStyleSettings from './PetStyleSettings.vue'

const emit = defineEmits<{ (e: 'close'): void }>()

const store = useSettingsStore()
const promptStore = usePromptStore()

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') { e.preventDefault(); emit('close') }
}
onMounted(() => { window.addEventListener('keydown', handleKeyDown) })
onUnmounted(() => { window.removeEventListener('keydown', handleKeyDown) })
const activeTab = ref<'ai' | 'pet' | 'style'>('ai')
const isTesting = ref(false)
const testResult = ref<{ success: boolean; message: string } | null>(null)

const providers: { id: AIProvider; name: string; icon: string }[] = [
  { id: 'deepseek', name: 'DeepSeek', icon: '🐋' },
  { id: 'openai', name: 'OpenAI', icon: '🅾️' },
  { id: 'claude', name: 'Claude', icon: '🅲️' },
  { id: 'custom', name: 'Custom', icon: '⚙️' }
]

const currentProvider = computed(() => store.providerPresets[store.aiConfig.provider])

const handleProviderChange = (provider: AIProvider) => {
  store.setProvider(provider)
  testResult.value = null
}

const handleApiKeyChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  store.updateConfig({ apiKey: target.value })
  testResult.value = null
}

const handleModelChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  store.updateConfig({ model: target.value })
}

const handleUrlChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  store.updateConfig({ apiUrl: target.value })
}

// 测试连接
const testConnection = async () => {
  if (!store.isConfigured) return

  isTesting.value = true
  testResult.value = null

  try {
    // 简单的测试请求
    const response = await fetch(store.aiConfig.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${store.aiConfig.apiKey}`
      },
      body: JSON.stringify({
        model: store.aiConfig.model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5
      })
    })

    if (response.ok) {
      testResult.value = { success: true, message: 'Connection successful!' }
    } else {
      const error = await response.text()
      testResult.value = { success: false, message: `Error: ${error.slice(0, 100)}` }
    }
  } catch (err: any) {
    testResult.value = { success: false, message: `Error: ${err.message}` }
  } finally {
    isTesting.value = false
  }
}
</script>

<template>
  <div class="panel-overlay" @click.self="emit('close')">
    <div class="settings-modal">
      <!-- 标题栏 -->
      <div class="settings-titlebar">
        <div class="titlebar-dots">
          <span class="dot close" @click="emit('close')"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
      <span class="titlebar-text">
        <span class="title-prefix">⚙</span> settings
      </span>
      <div class="titlebar-spacer"></div>
    </div>

      <!-- Tab 导航 -->
      <div class="settings-tabs">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'ai' }"
          @click="activeTab = 'ai'"
        >
          <span class="tab-icon">🤖</span>
          <span>AI Config</span>
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'pet' }"
          @click="activeTab = 'pet'"
        >
          <span class="tab-icon">🐾</span>
          <span>Pet</span>
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'style' }"
          @click="activeTab = 'style'"
        >
          <span class="tab-icon">🎨</span>
          <span>Style</span>
        </button>
      </div>

      <!-- 内容 -->
      <div class="settings-body">
        <!-- AI 配置 -->
        <div v-if="activeTab === 'ai'" class="settings-section">
          <h3 class="section-title">
            <span class="section-icon">🤖</span> AI Configuration
          </h3>

          <!-- 提供商选择 -->
          <div class="form-group">
            <label class="form-label">provider:</label>
            <div class="provider-grid">
              <button
                v-for="p in providers"
                :key="p.id"
                class="provider-btn"
                :class="{ active: store.aiConfig.provider === p.id }"
                @click="handleProviderChange(p.id)"
              >
                <span class="provider-icon">{{ p.icon }}</span>
                <span>{{ p.name }}</span>
              </button>
            </div>
          </div>

          <!-- API Key -->
          <div class="form-group">
            <label class="form-label">api_key:</label>
            <input
              :value="store.aiConfig.apiKey"
              type="password"
              class="form-input"
              placeholder="sk-..."
              @input="handleApiKeyChange"
            />
            <span class="form-hint">Your API key is stored locally</span>
          </div>

          <!-- 自定义 URL (仅 custom 模式显示) -->
          <div v-if="store.aiConfig.provider === 'custom'" class="form-group">
            <label class="form-label">api_url:</label>
            <input
              :value="store.aiConfig.apiUrl"
              type="text"
              class="form-input"
              placeholder="https://api.example.com/v1/chat/completions"
              @input="handleUrlChange"
            />
          </div>

          <!-- 模型选择 -->
          <div class="form-group">
            <label class="form-label">model:</label>
            <select
              v-if="store.aiConfig.provider !== 'custom'"
              :value="store.aiConfig.model"
              class="form-select"
              @change="handleModelChange"
            >
              <option v-for="model in currentProvider.models" :key="model" :value="model">
                {{ model }}
              </option>
            </select>
            <input
              v-else
              :value="store.aiConfig.model"
              type="text"
              class="form-input"
              placeholder="model-name"
              @input="handleModelChange"
            />
          </div>

          <!-- 测试连接 -->
          <div class="form-group">
            <button
              class="test-btn"
              :disabled="!store.isConfigured || isTesting"
              @click="testConnection"
            >
              <span v-if="isTesting">testing...</span>
              <span v-else>test connection</span>
            </button>
            <div
              v-if="testResult"
              class="test-result"
              :class="{ success: testResult.success, error: !testResult.success }"
            >
              {{ testResult.message }}
            </div>
          </div>

          <!-- 状态提示 -->
          <div class="status-bar">
            <span class="status-indicator" :class="{ active: store.isConfigured }"></span>
            <span class="status-text">
              {{ store.isConfigured ? 'AI ready' : 'Configure API to enable AI features' }}
            </span>
          </div>
        </div>

        <!-- 桌宠配置 -->
        <div v-if="activeTab === 'pet'" class="settings-section">
          <h3 class="section-title">
            <span class="section-icon">🐾</span> Pet Settings
          </h3>

          <div class="form-group">
            <label class="form-label">sleep_timeout:</label>
            <div class="sleep-options">
              <button
                v-for="opt in [
                  { label: '1 min', value: 60 },
                  { label: '2 min', value: 120 },
                  { label: '5 min', value: 300 },
                  { label: '10 min', value: 600 },
                  { label: 'Never', value: 0 }
                ]"
                :key="opt.value"
                class="sleep-btn"
                :class="{ active: store.petConfig.sleepTimeout === opt.value }"
                @click="store.updatePetConfig({ sleepTimeout: opt.value })"
              >
                {{ opt.label }}
              </button>
            </div>
            <span class="form-hint">Time before pet goes to sleep (0 = never)</span>
          </div>

          <div class="form-group">
            <label class="form-label">walk_speed:</label>
            <div class="speed-control">
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                :value="store.petConfig.walkSpeed"
                class="speed-slider"
                @input="(e) => store.updatePetConfig({ walkSpeed: parseFloat((e.target as HTMLInputElement).value) })"
              />
              <span class="speed-value">{{ store.petConfig.walkSpeed.toFixed(1) }}x</span>
            </div>
            <div class="speed-labels">
              <span>慢</span>
              <span>快</span>
            </div>
            <span class="form-hint">Pet movement speed (lower = slower)</span>
          </div>

          <div class="form-group">
            <label class="form-label">double_click_action:</label>
            <div class="toggle-row">
              <span class="toggle-label">单击桌宠复制默认提示词</span>
              <button
                class="toggle-btn"
                :class="{ active: store.petConfig.dblClickCopy }"
                @click="store.updatePetConfig({ dblClickCopy: !store.petConfig.dblClickCopy })"
              >
                <span class="toggle-dot"></span>
              </button>
            </div>
            <span class="form-hint">关闭后单击将无操作，双击打开面板</span>
          </div>

          <div class="status-bar">
            <span class="status-indicator" :class="{ active: store.petConfig.dblClickCopy }"></span>
            <span class="status-text">
              {{ store.petConfig.dblClickCopy ? '双击复制已启用' : '双击复制已关闭' }}
            </span>
          </div>
        </div>

        <!-- 桌宠样式 -->
        <PetStyleSettings v-if="activeTab === 'style'" />
      </div>

      <!-- 底部 -->
      <div class="settings-footer">
        <span class="footer-hint">
          <span class="hint-key">esc</span> to close
        </span>
        <button class="close-btn" @click="emit('close')">done</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 遮罩层 */
.panel-overlay {
  position: fixed;
  inset: 0;
  z-index: 10002;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}

.settings-modal {
  width: 90%;
  max-width: 480px;
  max-height: 80vh;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 标题栏 */
.settings-titlebar {
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

.title-prefix {
  color: var(--primary-color);
  margin-right: 6px;
}

.titlebar-spacer { width: 52px; }

/* Tab 导航 */
.settings-tabs {
  display: flex;
  gap: 4px;
  padding: 8px 16px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid transparent;
  background: transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.tab-btn:hover {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.tab-btn.active {
  border-color: var(--primary-color);
  color: var(--primary-color);
  background: rgba(0, 212, 170, 0.08);
}

.tab-icon { font-size: 14px; }

/* 内容 */
.settings-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.settings-section {
  margin-bottom: 20px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

.section-icon { font-size: 14px; }

/* 表单 */
.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.form-input,
.form-select {
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

.form-input:focus,
.form-select:focus {
  border-color: var(--primary-color);
  box-shadow: var(--glow-sm);
}

.form-input::placeholder { color: var(--text-muted); }

.form-hint {
  display: block;
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 4px;
}

/* 提供商选择 */
.provider-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.provider-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--border-color);
  background: transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.provider-btn:hover {
  border-color: var(--text-muted);
  color: var(--text-primary);
}

.provider-btn.active {
  border-color: var(--primary-color);
  color: var(--primary-color);
  background: rgba(0, 212, 170, 0.08);
}

.provider-icon { font-size: 14px; }

/* 休眠时间选择 */
.sleep-options {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.sleep-btn {
  padding: 6px 12px;
  border: 1px solid var(--border-color);
  background: transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.sleep-btn:hover { border-color: var(--text-muted); color: var(--text-secondary); }
.sleep-btn.active { border-color: var(--primary-color); color: var(--primary-color); background: rgba(0,212,170,0.08); }

/* 速度控制 */
.speed-control {
  display: flex;
  align-items: center;
  gap: 12px;
}

.speed-slider {
  flex: 1;
  height: 6px;
  background: var(--border-color);
  border-radius: 3px;
  outline: none;
  -webkit-appearance: none;
}

.speed-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  background: var(--primary-color);
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.15s ease;
}

.speed-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.speed-value {
  min-width: 40px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--primary-color);
  text-align: right;
}

.speed-labels {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--text-muted);
  margin-top: -4px;
  margin-bottom: 4px;
}

/* Toggle 开关 */
.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
}

.toggle-label {
  font-size: 13px;
  color: var(--text-primary);
}

.toggle-btn {
  width: 44px;
  height: 24px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  border-radius: 12px;
  position: relative;
  cursor: pointer;
  transition: all 0.2s ease;
}

.toggle-btn.active {
  background: var(--primary-color);
  border-color: var(--primary-color);
}

.toggle-dot {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  background: var(--text-primary);
  border-radius: 50%;
  transition: transform 0.2s ease;
}

.toggle-btn.active .toggle-dot {
  transform: translateX(20px);
  background: var(--bg-primary);
}

/* 测试按钮 */
.test-btn {
  padding: 8px 16px;
  border: 1px solid var(--border-color);
  background: transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.test-btn:hover:not(:disabled) {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.test-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.test-result {
  margin-top: 8px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 11px;
}

.test-result.success {
  background: rgba(34, 197, 94, 0.1);
  color: var(--success-color);
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.test-result.error {
  background: rgba(239, 68, 68, 0.1);
  color: var(--error-color);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

/* 状态栏 */
.status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--bg-input);
  border-radius: var(--radius-sm);
  margin-top: 16px;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
}

.status-indicator.active {
  background: var(--success-color);
  box-shadow: 0 0 6px var(--success-color);
}

.status-text {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-secondary);
}

/* 底部 */
.settings-footer {
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

.close-btn {
  padding: 6px 16px;
  border: 1px solid var(--primary-color);
  background: transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--primary-color);
  cursor: pointer;
  transition: all 0.15s ease;
}

.close-btn:hover {
  background: var(--primary-color);
  color: var(--bg-primary);
}
</style>
