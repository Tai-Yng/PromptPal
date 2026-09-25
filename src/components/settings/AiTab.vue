<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSettingsStore, type AIProvider } from '../../stores/settingsStore'

const store = useSettingsStore()
const isTesting = ref(false)
const testResult = ref<{ success: boolean; message: string } | null>(null)

const providers: { id: AIProvider; name: string }[] = [
  { id: 'deepseek', name: 'DeepSeek' },
  { id: 'openai', name: 'OpenAI' },
  { id: 'claude', name: 'Claude' },
  { id: 'custom', name: 'Custom' }
]

const currentProvider = computed(() => store.providerPresets[store.aiConfig.provider])

const handleProviderChange = (provider: AIProvider) => {
  store.setProvider(provider)
  testResult.value = null
}
const handleApiKeyChange = (e: Event) => {
  store.updateConfig({ apiKey: (e.target as HTMLInputElement).value })
  testResult.value = null
}
const handleModelChange = (e: Event) => {
  store.updateConfig({ model: (e.target as HTMLInputElement).value })
}
const handleUrlChange = (e: Event) => {
  store.updateConfig({ apiUrl: (e.target as HTMLInputElement).value })
}

const testConnection = async () => {
  if (!store.isConfigured) return
  isTesting.value = true; testResult.value = null
  try {
    // 复用 store 的请求构建：自动区分 Claude（x-api-key）与 OpenAI 兼容（Bearer）
    const { url, headers, body } = store.buildChatRequest(store.aiConfig, 'generate', 'ping', false)
    body.max_tokens = 5
    body.messages = [{ role: 'user', content: 'ping' }]
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    })
    if (response.ok) {
      testResult.value = { success: true, message: '[OK] connection established' }
    } else {
      const err = await response.text()
      testResult.value = { success: false, message: `[ERR] ${err.slice(0, 80)}` }
    }
  } catch (err: any) {
    testResult.value = { success: false, message: `[ERR] ${err.message}` }
  } finally {
    isTesting.value = false
  }
}
</script>

<template>
  <div class="config-section">
    <div class="section-label">
      <span class="sec-path">~/config/ai</span>
    </div>

    <!-- Provider -->
    <div class="cfg-row">
      <span class="cfg-key">provider</span>
      <span class="cfg-op">=</span>
      <div class="cfg-value provider-grid">
        <button
          v-for="p in providers" :key="p.id"
          class="prov-btn"
          :class="{ active: store.aiConfig.provider === p.id }"
          @click="handleProviderChange(p.id)"
        >
          {{ p.name }}
        </button>
      </div>
    </div>

    <!-- API Key -->
    <div class="cfg-row">
      <span class="cfg-key">api_key</span>
      <span class="cfg-op">=</span>
      <input
        :value="store.aiConfig.apiKey"
        type="password"
        class="cfg-input"
        placeholder="sk-..."
        @input="handleApiKeyChange"
      />
    </div>

    <!-- API URL (custom only) -->
    <div v-if="store.aiConfig.provider === 'custom'" class="cfg-row">
      <span class="cfg-key">api_url</span>
      <span class="cfg-op">=</span>
      <input
        :value="store.aiConfig.apiUrl"
        type="text"
        class="cfg-input"
        placeholder="https://..."
        @input="handleUrlChange"
      />
    </div>

    <!-- Model -->
    <div class="cfg-row">
      <span class="cfg-key">model</span>
      <span class="cfg-op">=</span>
      <select
        v-if="store.aiConfig.provider !== 'custom'"
        :value="store.aiConfig.model"
        class="cfg-select"
        @change="handleModelChange"
      >
        <option v-for="m in currentProvider.models" :key="m" :value="m">{{ m }}</option>
      </select>
      <input
        v-else
        :value="store.aiConfig.model"
        type="text"
        class="cfg-input"
        placeholder="model-name"
        @input="handleModelChange"
      />
    </div>

    <!-- Test -->
    <div class="cfg-row">
      <span class="cfg-key"></span>
      <span class="cfg-op"></span>
      <div class="cfg-value test-row">
        <button
          class="test-btn"
          :disabled="!store.isConfigured || isTesting"
          @click="testConnection"
        >
          <span class="btn-sym">$</span> ping {{ store.aiConfig.provider }}
        </button>
        <div v-if="testResult" class="test-msg" :class="testResult.success ? 'ok' : 'err'">
          {{ testResult.message }}
        </div>
      </div>
    </div>

    <!-- Status -->
    <div class="status-msg" :class="{ ok: store.isConfigured }">
      <span class="status-prefix">[{{ store.isConfigured ? 'OK' : '--' }}]</span>
      {{ store.isConfigured ? 'AI ready' : 'configure api_key' }}
    </div>
  </div>
</template>

<style scoped>
/* ── Provider Grid ── */
.provider-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.prov-btn {
  padding: 5px 12px;
  border: 1px solid var(--border-color);
  background: transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-normal);
}
.prov-btn:hover { border-color: var(--text-muted); color: var(--text-secondary); }
.prov-btn.active {
  border-color: var(--primary);
  color: var(--primary-light);
  background: rgba(99, 102, 241, 0.08);
}

/* ── Test ── */
.test-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.test-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid var(--accent);
  background: transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--accent);
  cursor: pointer;
  transition: all var(--transition-normal);
  align-self: flex-start;
}
.test-btn:hover:not(:disabled) {
  background: var(--accent);
  color: var(--bg-primary);
}
.test-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-sym { opacity: 0.7; }
.test-msg {
  font-size: 10px;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
}
.test-msg.ok { color: var(--terminal-green); background: rgba(74, 222, 128, 0.08); }
.test-msg.err { color: #FCA5A5; background: rgba(239, 68, 68, 0.08); }
</style>
