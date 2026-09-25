<script setup lang="ts">
import { ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useSettingsStore } from '../../stores/settingsStore'
import { usePetStyleStore } from '../../stores/petStyleStore'
import { usePromptStore } from '../../stores/promptStore'
import { loadString, saveString } from '../../services/storage'
import {
  buildExportData, pushToGitee, applyPulledData, fromBase64Utf8,
  markPushed, autoSyncHealth
} from '../../services/autoSync'

const store = useSettingsStore()
const petStore = usePetStyleStore()
const promptStore = usePromptStore()

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
const handleSyncSave = () => {
  syncMsg.value = 'exporting...'
  try {
    const data = {
      prompts: loadString('promptpal_prompts') || '[]',
      categories: loadString('promptpal_categories') || '[]',
      aiConfig: loadString('promptpal_ai_config') || '{}',
      petConfig: loadString('promptpal_pet_config') || '{}',
      petStyle: loadString('promptpal_pet_style') || '{}',
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
      if (data.prompts) saveString('promptpal_prompts', data.prompts)
      if (data.categories) saveString('promptpal_categories', data.categories)
      if (data.aiConfig) saveString('promptpal_ai_config', data.aiConfig)
      if (data.petConfig) saveString('promptpal_pet_config', data.petConfig)
      if (data.petStyle) saveString('promptpal_pet_style', data.petStyle)
      store.loadFromStorage()
      promptStore.reloadFromStorage()
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

const giteePush = async () => {
  syncGiteeToStore()
  if (!giteeToken.value || !giteeOwner.value || !giteeRepo.value) {
    giteeSyncMsg.value = '[ERR] configure token + owner/repo first'
    return
  }
  giteeSyncMsg.value = 'pushing...'
  try {
    // 推送前先做本地滚动备份
    await invoke('backup_data_file').catch(() => {})
    const cfg = {
      token: giteeToken.value,
      owner: giteeOwner.value,
      repo: giteeRepo.value,
      path: giteePath.value || 'promptpal_data.json',
      enabled: true
    }
    const result = await pushToGitee(cfg, buildExportData())
    markPushed()
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
    const base64Content = fileData.content
    if (!base64Content) throw new Error('empty content from Gitee')
    const decoded = JSON.parse(fromBase64Utf8(base64Content))

    applyPulledData(decoded)
    store.loadFromStorage()
    promptStore.reloadFromStorage()
    petStore.applyTheme(petStore.currentThemeId)
    const ts = decoded.exportedAt ? new Date(decoded.exportedAt).toLocaleString() : 'unknown'
    giteeSyncMsg.value = `[OK] pulled from ${giteeOwner.value}/${giteeRepo.value} (saved at ${ts})`
  } catch (e: any) {
    giteeSyncMsg.value = `[ERR] ${String(e)}`
  }
}
</script>

<template>
  <div class="config-section">
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

        <!-- 自动同步健康告警（连续推送失败时显示） -->
        <div v-if="autoSyncHealth.failing" class="sync-msg warn">
          [WARN] auto-push failing: {{ autoSyncHealth.lastError }}
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
</template>
