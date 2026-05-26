<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useSettingsStore, type AIProvider } from '../stores/settingsStore'
import { usePetStyleStore, presetThemes } from '../stores/petStyleStore'

const emit = defineEmits<{ (e: 'close'): void }>()

const store = useSettingsStore()
const petStore = usePetStyleStore()
const activeTab = ref<'ai' | 'pet' | 'sync'>('ai')
const isTesting = ref(false)
const showSaved = ref(false)
const syncMsg = ref('')
const syncPath = ref('')
const giteeSyncMsg = ref('')

// Gitee 表单本地绑定（避免 Pinia :value 绑定问题）
const giteeToken = ref(store.giteeConfig.token)
const giteeOwner = ref(store.giteeConfig.owner)
const giteeRepo = ref(store.giteeConfig.repo)
const giteePath = ref(store.giteeConfig.path)

const syncGiteeToStore = () => {
  store.updateGiteeConfig({
    token: giteeToken.value,
    owner: giteeOwner.value,
    repo: giteeRepo.value,
    path: giteePath.value
  })
}

// 本地文件同步
const fileInputRef = ref<HTMLInputElement | null>(null)

const handleSyncSave = () => {
  syncMsg.value = 'exporting...'
  try {
    const data = {
      prompts: localStorage.getItem('promptpal_prompts') || '[]',
      categories: localStorage.getItem('promptpal_categories') || '[]',
      aiConfig: localStorage.getItem('promptpal_ai_config') || '{}',
      petConfig: localStorage.getItem('promptpal_pet_config') || '{}',
      petStyle: localStorage.getItem('promptpal_pet_style') || '{}',
      exportedAt: new Date().toISOString()
    }
    const jsonStr = JSON.stringify(data, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    a.href = url
    a.download = `promptpal_backup_${ts}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    syncPath.value = a.download
    syncMsg.value = `[OK] exported → ${a.download}`
  } catch (e: any) {
    syncMsg.value = `[ERR] ${String(e)}`
  }
}

const handleSyncLoad = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) { syncMsg.value = '[--] cancelled'; return }
    syncMsg.value = 'importing...'
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (data.prompts) localStorage.setItem('promptpal_prompts', data.prompts)
      if (data.categories) localStorage.setItem('promptpal_categories', data.categories)
      if (data.aiConfig) localStorage.setItem('promptpal_ai_config', data.aiConfig)
      if (data.petConfig) localStorage.setItem('promptpal_pet_config', data.petConfig)
      if (data.petStyle) localStorage.setItem('promptpal_pet_style', data.petStyle)
      store.loadFromStorage()
      petStore.applyTheme(petStore.currentThemeId)
      syncPath.value = file.name
      syncMsg.value = `[OK] imported from ${file.name}${data.exportedAt ? ` (saved ${new Date(data.exportedAt).toLocaleString()})` : ''}`
    } catch (e: any) {
      syncMsg.value = `[ERR] ${String(e)}`
    }
  }
  input.click()
}

// Gitee 同步
const giteeVerify = async () => {
  syncGiteeToStore()
  if (!giteeToken.value) { giteeSyncMsg.value = '[ERR] token required'; return }
  if (!giteeOwner.value || !giteeRepo.value) { giteeSyncMsg.value = '[ERR] fill owner/repo first'; return }
  giteeSyncMsg.value = 'verifying...'
  try {
    const result = await invoke('gitee_verify', {
      token: giteeToken.value,
      owner: giteeOwner.value,
      repo: giteeRepo.value
    })
    giteeSyncMsg.value = result as string
  } catch (e: any) {
    giteeSyncMsg.value = `[ERR] ${e}`
  }
}

// 安全的 UTF-8 → Base64 编码（支持中文）
const toBase64Utf8 = (str: string): string => {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

// 安全的 Base64 → UTF-8 解码（支持中文）
const fromBase64Utf8 = (b64: string): string => {
  // Gitee 返回的 base64 可能有换行符，先清除
  const clean = b64.replace(/\s/g, '')
  const binary = atob(clean)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder('utf-8').decode(bytes)
}

const giteePush = async () => {
  syncGiteeToStore()
  if (!giteeToken.value || !giteeOwner.value || !giteeRepo.value) {
    giteeSyncMsg.value = '[ERR] configure token + owner/repo first'
    return
  }
  giteeSyncMsg.value = 'pushing...'
  try {
    const data: any = {}
    const prompts = localStorage.getItem('promptpal_prompts')
    if (prompts) { try { data.prompts = JSON.parse(prompts) } catch { data.prompts = [] } }
    const cats = localStorage.getItem('promptpal_categories')
    if (cats) { try { data.categories = JSON.parse(cats) } catch { data.categories = [] } }
    const style = localStorage.getItem('promptpal_pet_style')
    if (style) { try { data.petStyle = JSON.parse(style) } catch { } }
    data.exportedAt = new Date().toISOString()
    
    // 正确的 UTF-8 → Base64 编码，支持中文
    const jsonStr = JSON.stringify(data, null, 2)
    const content = toBase64Utf8(jsonStr)

    const result = await invoke('gitee_push', {
      token: giteeToken.value,
      owner: giteeOwner.value,
      repo: giteeRepo.value,
      path: giteePath.value || 'promptpal_data.json',
      content
    })
    giteeSyncMsg.value = result as string
  } catch (e: any) {
    giteeSyncMsg.value = `[ERR] ${String(e)}`
  }
}

const giteePull = async () => {
  syncGiteeToStore()
  if (!giteeToken.value || !giteeOwner.value || !giteeRepo.value) {
    giteeSyncMsg.value = '[ERR] configure token + owner/repo first'
    return
  }
  giteeSyncMsg.value = 'pulling...'
  try {
    const json = await invoke('gitee_pull', {
      token: giteeToken.value,
      owner: giteeOwner.value,
      repo: giteeRepo.value,
      path: giteePath.value || 'promptpal_data.json'
    }) as string

    const fileData = JSON.parse(json)
    
    // 使用正确的 UTF-8 Base64 解码
    const base64Content = fileData.content
    if (!base64Content) throw new Error('empty content from Gitee')
    const decodedStr = fromBase64Utf8(base64Content)
    
    const decoded = JSON.parse(decodedStr)
    if (decoded.prompts) localStorage.setItem('promptpal_prompts', JSON.stringify(decoded.prompts))
    if (decoded.categories) localStorage.setItem('promptpal_categories', JSON.stringify(decoded.categories))
    if (decoded.petStyle) localStorage.setItem('promptpal_pet_style', JSON.stringify(decoded.petStyle))
    store.loadFromStorage()
    petStore.applyTheme(petStore.currentThemeId)
    const ts = decoded.exportedAt ? new Date(decoded.exportedAt).toLocaleString() : 'unknown'
    giteeSyncMsg.value = `[OK] pulled from ${giteeOwner.value}/${giteeRepo.value} (saved at ${ts})`
  } catch (e: any) {
    giteeSyncMsg.value = `[ERR] ${String(e)}`
  }
}
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
    const response = await fetch(store.aiConfig.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${store.aiConfig.apiKey}`
      },
      body: JSON.stringify({
        model: store.aiConfig.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5
      })
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

// 导入精灵图
const handleSpriteImport = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/png'
  input.onchange = () => {
    const file = input.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      petStore.importSprite({
        imageUrl: reader.result as string,
        frameWidth: 32,
        frameHeight: 32,
        frames: 4
      })
    }
    reader.readAsDataURL(file)
  }
  input.click()
}

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') { e.preventDefault(); emit('close') }
}
onMounted(() => { window.addEventListener('keydown', handleKeyDown) })
onUnmounted(() => { window.removeEventListener('keydown', handleKeyDown) })
</script>

<template>
  <div class="settings-panel">
    <!-- Tab -->
    <div class="settings-tabs">
      <button :class="{ active: activeTab === 'ai' }" @click="activeTab = 'ai'">
        <span class="tab-tag">&lt;ai-config&gt;</span>
      </button>
      <button :class="{ active: activeTab === 'pet' }" @click="activeTab = 'pet'">
        <span class="tab-tag">&lt;pet-config&gt;</span>
      </button>
      <button :class="{ active: activeTab === 'sync' }" @click="activeTab = 'sync'">
        <span class="tab-tag">&lt;sync&gt;</span>
      </button>
    </div>

    <div class="settings-content">
      <!-- ── AI Config ── -->
      <div v-if="activeTab === 'ai'" class="config-section">
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

      <!-- ── Pet Config ── -->
      <div v-if="activeTab === 'pet'" class="config-section">
        <div class="section-label">
          <span class="sec-path">~/config/pet</span>
        </div>

        <!-- Theme -->
        <div class="cfg-row">
          <span class="cfg-key">theme</span>
          <span class="cfg-op">=</span>
          <div class="cfg-value theme-grid">
            <button
              v-for="t in presetThemes" :key="t.id"
              class="theme-btn"
              :class="{ active: petStore.currentThemeId === t.id }"
              @click="petStore.applyTheme(t.id)"
            >
              <span class="theme-dot" :style="{ background: t.style.primaryColor, boxShadow: `0 0 6px ${t.style.primaryColor}` }"></span>
              {{ t.name }}
            </button>
          </div>
        </div>

        <!-- Colors -->
        <div class="cfg-row">
          <span class="cfg-key">colors</span>
          <span class="cfg-op">=</span>
          <div class="cfg-value color-grid">
            <div class="color-item" v-for="c in [
              {k:'primaryColor',l:'eye'},
              {k:'secondaryColor',l:'ant'},
              {k:'bodyColor',l:'body'},
              {k:'bodyBorderColor',l:'bd'},
              {k:'visorColor',l:'vis'},
              {k:'eyeColor',l:'glw'}
            ]" :key="c.k">
              <span class="color-label">{{ c.l }}</span>
              <input
                type="color"
                :value="(petStore.currentStyle as any)[c.k]"
                class="color-pick"
                @input="petStore.updateColor(c.k as any, ($event.target as HTMLInputElement).value)"
              />
            </div>
          </div>
        </div>

        <!-- Shapes -->
        <div class="cfg-row">
          <span class="cfg-key">shape</span>
          <span class="cfg-op">=</span>
          <div class="cfg-value shape-group">
            <div class="shape-item" v-for="s in [
              {k:'headSize',l:'head'},
              {k:'bodySize',l:'body'},
              {k:'antennaHeight',l:'ant'}
            ]" :key="s.k">
              <span class="shape-label">{{ s.l }}</span>
              <input
                type="range"
                min="0.5" max="1.5" step="0.1"
                :value="petStore.currentStyle[s.k as keyof typeof petStore.currentStyle]"
                class="shape-slider"
                @input="petStore.updateShape(s.k as any, parseFloat(($event.target as HTMLInputElement).value))"
              />
              <span class="shape-val">{{ (petStore.currentStyle[s.k as keyof typeof petStore.currentStyle] as number).toFixed(1) }}</span>
            </div>
          </div>
        </div>

        <!-- Sprite -->
        <div class="cfg-row">
          <span class="cfg-key">sprite</span>
          <span class="cfg-op">=</span>
          <div class="cfg-value">
            <button class="opt-btn" @click="handleSpriteImport">
              {{ petStore.useCustomSprite ? 'change sprite' : 'import png' }}
            </button>
            <button v-if="petStore.useCustomSprite" class="opt-btn del" @click="petStore.clearSprite()">
              clear
            </button>
          </div>
        </div>

        <!-- Context Aware -->
        <div class="cfg-row">
          <span class="cfg-key">smart</span>
          <span class="cfg-op">=</span>
          <button
            class="toggle-char"
            :class="{ active: store.petConfig.contextAware }"
            @click="store.updatePetConfig({ contextAware: !store.petConfig.contextAware })"
          >
            {{ store.petConfig.contextAware ? '[x]' : '[ ]' }}
          </button>
          <span class="cfg-hint">detect apps &amp; suggest prompts</span>
        </div>

        <!-- Sleep timeout -->
        <div class="cfg-row">
          <span class="cfg-key">sleep</span>
          <span class="cfg-op">=</span>
          <div class="cfg-value sleep-opts">
            <button
              v-for="opt in [{l:'60s',v:60},{l:'120s',v:120},{l:'300s',v:300},{l:'600s',v:600},{l:'off',v:0}]"
              :key="opt.v"
              class="opt-btn"
              :class="{ active: store.petConfig.sleepTimeout === opt.v }"
              @click="store.updatePetConfig({ sleepTimeout: opt.v })"
            >
              {{ opt.l }}
            </button>
          </div>
        </div>

        <!-- Walk speed -->
        <div class="cfg-row">
          <span class="cfg-key">speed</span>
          <span class="cfg-op">=</span>
          <div class="cfg-value speed-row">
            <input
              type="range"
              min="0.1" max="1" step="0.1"
              :value="store.petConfig.walkSpeed"
              class="speed-slider"
              @input="store.updatePetConfig({ walkSpeed: parseFloat(($event.target as HTMLInputElement).value) })"
            />
            <span class="speed-val">{{ store.petConfig.walkSpeed.toFixed(1) }}x</span>
          </div>
        </div>

        <!-- Click copy -->
        <div class="cfg-row">
          <span class="cfg-key">copy</span>
          <span class="cfg-op">=</span>
          <button
            class="toggle-char"
            :class="{ active: store.petConfig.dblClickCopy }"
            @click="store.updatePetConfig({ dblClickCopy: !store.petConfig.dblClickCopy })"
          >
            {{ store.petConfig.dblClickCopy ? '[x]' : '[ ]' }}
          </button>
          <span class="cfg-hint">click pet to copy default prompt</span>
        </div>

        <!-- Save & Status -->
        <div class="cfg-row">
          <span class="cfg-key"></span>
          <span class="cfg-op"></span>
          <div class="cfg-value save-row">
            <button class="save-btn" @click="petStore.saveToStorage(); store.saveToStorage(); showSaved = true; setTimeout(() => showSaved = false, 1500)">
              <span class="save-sym">$</span> save config
            </button>
            <Transition name="flash">
              <span v-if="showSaved" class="saved-msg">[OK] saved</span>
            </Transition>
          </div>
        </div>

        <div class="status-msg" :class="{ ok: store.petConfig.contextAware }">
          <span class="status-prefix">[{{ store.petConfig.contextAware ? 'ON' : 'OFF' }}]</span>
          {{ store.petConfig.contextAware ? 'smart mode active' : 'smart mode disabled' }}
        </div>
      </div>

      <!-- ── Sync ── -->
      <div v-if="activeTab === 'sync'" class="config-section">
        <div class="section-label">
          <span class="sec-path">~/config/sync</span>
        </div>

        <!-- Local -->
        <div class="section-label sub">
          <span class="sec-path">-- local file --</span>
        </div>

        <div class="cfg-row">
          <span class="cfg-key">file</span>
          <span class="cfg-op">=</span>
          <span class="cfg-value">
            <span class="sync-path">{{ syncPath || '(click export/import to choose file)' }}</span>
          </span>
        </div>

        <div class="cfg-row">
          <span class="cfg-key"></span>
          <span class="cfg-op"></span>
          <div class="cfg-value sync-actions">
            <button class="save-btn" @click="handleSyncSave">
              <span class="save-sym">></span> export
            </button>
            <button class="load-btn" @click="handleSyncLoad">
              <span class="save-sym"><</span> import
            </button>
          </div>
        </div>

        <!-- 本地同步消息反馈 -->
        <div v-if="syncMsg" class="sync-msg" :class="{ ok: syncMsg.startsWith('[OK]'), err: syncMsg.startsWith('[ERR]'), warn: !syncMsg.startsWith('[') }">
          {{ syncMsg }}
        </div>

        <!-- Gitee -->
        <div class="section-label sub">
          <span class="sec-path">-- gitee --</span>
        </div>

        <div class="cfg-row">
          <span class="cfg-key">token</span>
          <span class="cfg-op">=</span>
          <input
            v-model="giteeToken"
            type="password"
            class="cfg-input"
            placeholder="gitee private token"
            @blur="syncGiteeToStore()"
          />
        </div>

        <div class="cfg-row">
          <span class="cfg-key">repo</span>
          <span class="cfg-op">=</span>
          <input
            v-model="giteeOwner"
            type="text"
            class="cfg-input"
            placeholder="username"
            @blur="syncGiteeToStore()"
            style="max-width: 160px;"
          />
          <span class="cfg-sep">/</span>
          <input
            v-model="giteeRepo"
            type="text"
            class="cfg-input"
            placeholder="repo-name"
            @blur="syncGiteeToStore()"
            style="flex: 1;"
          />
        </div>

        <div class="cfg-row">
          <span class="cfg-key">path</span>
          <span class="cfg-op">=</span>
          <input
            v-model="giteePath"
            type="text"
            class="cfg-input"
            placeholder="promptpal_data.json"
            @blur="syncGiteeToStore()"
          />
        </div>

        <div class="cfg-row">
          <span class="cfg-key"></span>
          <span class="cfg-op"></span>
          <div class="cfg-value sync-actions">
            <button class="gh-btn push" @click="giteePush">
              <span class="save-sym">^</span> push
            </button>
            <button class="gh-btn pull" @click="giteePull">
              <span class="save-sym">v</span> pull
            </button>
            <button class="gh-btn verify" @click="giteeVerify">
              <span class="save-sym">?</span> verify
            </button>
          </div>
        </div>

        <div v-if="giteeSyncMsg" class="sync-msg" :class="{ ok: giteeSyncMsg.startsWith('[OK]'), err: giteeSyncMsg.startsWith('[ERR]'), warn: !giteeSyncMsg.startsWith('[') }">
          {{ giteeSyncMsg }}
        </div>

        <div class="sync-hint">
          <span class="hint-icon">*</span>
          Create a token at <a href="https://gitee.com/profile/personal_access_tokens" target="_blank">gitee.com</a> with <strong>projects</strong> scope.
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
  font-family: var(--font-mono);
}

/* ── Tabs ── */
.settings-tabs {
  display: flex;
  gap: 0;
  padding: 10px 14px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}
.settings-tabs button {
  padding: 8px 16px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition-normal);
  letter-spacing: 0.3px;
}
.settings-tabs button:hover { color: var(--text-secondary); }
.settings-tabs button.active {
  color: var(--primary-light);
  border-bottom-color: var(--primary);
}
.tab-tag { font-size: 11px; }

/* ── Content ── */
.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}
.config-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.section-label {
  padding: 4px 0;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--border-light);
}
.sec-path {
  font-size: 11px;
  color: var(--terminal-green);
  opacity: 0.7;
  letter-spacing: 0.3px;
}

/* ── Config Rows ── */
.cfg-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cfg-key {
  min-width: 100px;
  font-size: 12px;
  color: var(--accent);
  font-weight: 600;
  text-align: right;
}
.cfg-op {
  color: var(--text-muted);
  font-size: 12px;
}
.cfg-value {
  flex: 1;
}
.cfg-input, .cfg-select {
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
.cfg-input:focus, .cfg-select:focus {
  border-color: var(--primary);
  box-shadow: var(--glow-sm);
}

.cfg-hint {
  font-size: 10px;
  color: var(--text-muted);
  font-style: italic;
  margin-left: 4px;
}

/* ── Theme Grid ── */
.theme-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}
.theme-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border: 1px solid var(--border-color);
  background: transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-normal);
}
.theme-btn:hover { border-color: var(--text-muted); color: var(--text-secondary); }
.theme-btn.active {
  border-color: var(--primary);
  color: var(--primary-light);
  background: rgba(99, 102, 241, 0.08);
}
.theme-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* ── Color Grid ── */
.color-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.color-item {
  display: flex;
  align-items: center;
  gap: 4px;
}
.color-label {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--text-muted);
  min-width: 20px;
}
.color-pick {
  width: 28px;
  height: 22px;
  border: 1px solid var(--border-color);
  border-radius: 3px;
  cursor: pointer;
  padding: 1px;
  background: transparent;
}
.color-pick::-webkit-color-swatch-wrapper { padding: 0; }
.color-pick::-webkit-color-swatch { border: none; border-radius: 2px; }

/* ── Shape ── */
.shape-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.shape-item {
  display: flex;
  align-items: center;
  gap: 8px;
}
.shape-label {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-muted);
  min-width: 28px;
}
.shape-slider { flex: 1; accent-color: var(--primary); height: 4px; }
.shape-val {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--primary-light);
  min-width: 22px;
  text-align: right;
}

/* ── Delete button ── */
.opt-btn.del {
  color: #FCA5A5;
  border-color: rgba(239, 68, 68, 0.3);
  margin-left: 6px;
}
.opt-btn.del:hover {
  background: rgba(239, 68, 68, 0.1);
  color: var(--error);
}

/* ── Save Button ── */
.save-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.save-btn, .load-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border: 1px solid var(--terminal-green);
  background: transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--terminal-green);
  cursor: pointer;
  transition: all var(--transition-normal);
}
.save-btn:hover {
  background: var(--terminal-green);
  color: var(--bg-primary);
}
.load-btn {
  border-color: var(--accent);
  color: var(--accent);
}
.load-btn:hover {
  background: var(--accent);
  color: var(--bg-primary);
}
.save-sym { opacity: 0.7; }
.saved-msg {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--terminal-green);
}

/* ── Sync ── */
.sync-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.sync-path {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
}
.sync-msg {
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  margin-top: 8px;
}
.sync-msg.ok { color: var(--terminal-green); border: 1px solid rgba(74, 222, 128, 0.25); background: rgba(74, 222, 128, 0.06); }
.sync-msg.err { color: #FCA5A5; border: 1px solid rgba(239, 68, 68, 0.25); background: rgba(239, 68, 68, 0.06); }
.sync-msg.warn { color: var(--warning); }
.sync-file {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--text-muted);
  margin-top: 6px;
  opacity: 0.6;
}

/* ── GitHub Sync ── */
.gh-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  border: 1px solid;
  background: transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 10px;
  cursor: pointer;
  transition: all var(--transition-normal);
}
.gh-btn.push {
  border-color: #6E40C9;
  color: #A78BFA;
}
.gh-btn.push:hover {
  background: #6E40C9;
  color: #fff;
}
.gh-btn.pull {
  border-color: var(--accent);
  color: var(--accent);
}
.gh-btn.pull:hover {
  background: var(--accent);
  color: var(--bg-primary);
}
.gh-btn.verify {
  border-color: var(--text-muted);
  color: var(--text-muted);
  margin-left: auto;
}
.gh-btn.verify:hover {
  border-color: var(--warning);
  color: var(--warning);
}
.section-label.sub {
  margin-top: 4px;
  opacity: 0.5;
}
.cfg-sep {
  color: var(--text-muted);
  font-size: 14px;
  flex-shrink: 0;
}
.sync-hint {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--text-muted);
  margin-top: 4px;
  opacity: 0.6;
}
.sync-hint a {
  color: var(--accent);
  text-decoration: none;
}
.sync-hint a:hover { text-decoration: underline; }
.hint-icon { color: var(--warning); margin-right: 4px; }
.hint-sub { opacity: 0.6; font-size: 9px; }

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

/* ── Sleep ── */
.sleep-opts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.opt-btn {
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
.opt-btn:hover { border-color: var(--text-muted); color: var(--text-secondary); }
.opt-btn.active {
  border-color: var(--primary);
  color: var(--primary-light);
  background: rgba(99, 102, 241, 0.08);
}

/* ── Speed ── */
.speed-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.speed-slider { flex: 1; accent-color: var(--primary); }
.speed-val {
  font-size: 12px;
  color: var(--primary-light);
  min-width: 32px;
  text-align: right;
}

/* ── Toggle ── */
.toggle-char {
  padding: 4px 10px;
  background: none;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-normal);
  letter-spacing: 1px;
}
.toggle-char:hover { border-color: var(--text-muted); }
.toggle-char.active {
  color: var(--terminal-green);
  border-color: var(--terminal-green);
  background: rgba(74, 222, 128, 0.08);
}

/* ── Status ── */
.status-msg {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 8px;
}
.status-msg.ok {
  border-color: rgba(74, 222, 128, 0.2);
  color: var(--terminal-green);
}
.status-prefix {
  font-weight: 700;
  letter-spacing: 0.3px;
}
</style>
