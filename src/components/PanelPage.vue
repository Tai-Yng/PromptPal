<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import PromptPanel from './PromptPanel.vue'
import AIGeneratePanel from './AIGeneratePanel.vue'
import SettingsPanel from './SettingsPanel.vue'
import TodoPanel from './TodoPanel.vue'
import { useSettingsStore } from '../stores/settingsStore'
import { usePetStyleStore } from '../stores/petStyleStore'
import { usePromptStore } from '../stores/promptStore'
import { checkStartupSync, takeStartupCandidate, applyPulledData } from '../services/autoSync'

const activeView = ref<'prompt' | 'ai' | 'todo' | 'settings'>('prompt')

const closePanelWindow = async () => {
  try {
    await getCurrentWindow().hide()
  } catch {}
}

// ===== 启动拉取：远端较新时询问 =====
const settingsStore = useSettingsStore()
const petStore = usePetStyleStore()
const promptStore = usePromptStore()
const pullBanner = ref<string | null>(null)
let pullCandidate: any = null

onMounted(async () => {
  const result = await checkStartupSync()
  if (result === 'confirm') {
    pullCandidate = takeStartupCandidate()
    const ts = pullCandidate?.exportedAt ? new Date(pullCandidate.exportedAt).toLocaleString() : 'unknown'
    pullBanner.value = ts
  }
})

const handlePullNow = () => {
  pullBanner.value = null
  if (!pullCandidate) return
  applyPulledData(pullCandidate)
  settingsStore.loadFromStorage()
  promptStore.reloadFromStorage()
  petStore.applyTheme(petStore.currentThemeId)
  pullCandidate = null
}
const handleIgnorePull = () => {
  pullBanner.value = null
  pullCandidate = null
}
</script>

<template>
  <div class="panel-page">
    <!-- 启动拉取确认横幅 -->
    <div v-if="pullBanner" class="pull-banner">
      <span class="pull-text">[SYNC] remote data is newer (saved {{ pullBanner }})</span>
      <button class="pull-btn yes" @click="handlePullNow">pull</button>
      <button class="pull-btn no" @click="handleIgnorePull">ignore</button>
    </div>

    <!-- 侧边导航 -->
    <nav class="sidebar">
      <div class="sidebar-header">
        <span class="logo-bracket">[</span>
        <span class="logo-text">PromptPal</span>
        <span class="logo-bracket">]</span>
        <span class="cursor-blink" style="color: var(--primary-light); margin-left: 2px;">▍</span>
      </div>

      <div class="nav-items">
        <button
          class="nav-btn"
          :class="{ active: activeView === 'prompt' }"
          @click="activeView = 'prompt'"
        >
          <span class="nav-prompt">&gt;</span>
          <span>prompts</span>
        </button>
        <button
          class="nav-btn"
          :class="{ active: activeView === 'ai' }"
          @click="activeView = 'ai'"
        >
          <span class="nav-prompt">#</span>
          <span>ai-gen</span>
        </button>
        <button
          class="nav-btn"
          :class="{ active: activeView === 'todo' }"
          @click="activeView = 'todo'"
        >
          <span class="nav-prompt">+</span>
          <span>todo</span>
        </button>
        <button
          class="nav-btn"
          :class="{ active: activeView === 'settings' }"
          @click="activeView = 'settings'"
        >
          <span class="nav-prompt">*</span>
          <span>config</span>
        </button>
      </div>

      <div class="sidebar-footer">
        <span class="version-line">promptpal v2.0.0</span>
        <span class="version-line tui">[TUI]</span>
      </div>
    </nav>

    <!-- 主内容区 -->
    <main class="content">
      <PromptPanel v-if="activeView === 'prompt'" />
      <AIGeneratePanel v-if="activeView === 'ai'" @close="activeView = 'prompt'" @settings="activeView = 'settings'" />
      <TodoPanel v-if="activeView === 'todo'" />
      <SettingsPanel v-if="activeView === 'settings'" @close="closePanelWindow" />
    </main>
  </div>
</template>

<style scoped>
.pull-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--warning);
  font-family: var(--font-mono);
  font-size: 11px;
}
.pull-text { color: var(--warning); flex: 1; }
.pull-btn {
  padding: 3px 12px;
  border: 1px solid var(--border-color);
  background: transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 10px;
  cursor: pointer;
  color: var(--text-secondary);
}
.pull-btn.yes { border-color: var(--terminal-green); color: var(--terminal-green); }
.pull-btn.yes:hover { background: var(--terminal-green); color: var(--bg-primary); }
.pull-btn.no:hover { color: var(--text-primary); }

.panel-page {
  display: flex;
  width: 100%;
  height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-mono);
}

/* ── Sidebar ── */
.sidebar {
  width: 180px;
  min-width: 180px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  padding: 0;
  position: relative;
}

.sidebar::after {
  content: '';
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 1px;
  background: linear-gradient(to bottom, var(--primary), transparent 60%);
  opacity: 0.15;
}

.sidebar-header {
  display: flex;
  align-items: center;
  padding: 18px 14px;
  border-bottom: 1px solid var(--border-light);
  font-family: var(--font-mono);
}

.logo-bracket {
  font-size: 15px;
  color: var(--text-muted);
  font-weight: 300;
}

.logo-text {
  font-size: 14px;
  font-weight: 700;
  color: var(--primary-light);
  letter-spacing: 0.5px;
}

/* ── Navigation ── */
.nav-items {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 8px;
}

.nav-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  background: none;
  border: none;
  border-left: 2px solid transparent;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition-normal);
  text-align: left;
  letter-spacing: 0.3px;
}

.nav-prompt {
  font-size: 11px;
  flex-shrink: 0;
  opacity: 0.6;
  transition: opacity var(--transition-normal);
}

.nav-btn:hover {
  background: rgba(99, 102, 241, 0.06);
  color: var(--text-secondary);
}
.nav-btn:hover .nav-prompt {
  opacity: 1;
}

.nav-btn.active {
  background: rgba(99, 102, 241, 0.1);
  color: var(--primary-light);
  border-left-color: var(--primary);
  box-shadow: inset 2px 0 0 var(--primary), 0 0 12px rgba(99, 102, 241, 0.08);
}
.nav-btn.active .nav-prompt {
  color: var(--primary);
  opacity: 1;
}

/* ── Footer ── */
.sidebar-footer {
  padding: 12px 14px;
  border-top: 1px solid var(--border-light);
  font-family: var(--font-mono);
}

.version-line {
  display: block;
  font-size: 10px;
  color: var(--text-muted);
  letter-spacing: 0.3px;
}
.version-line.tui {
  color: var(--terminal-green);
  opacity: 0.5;
  margin-top: 2px;
  font-size: 9px;
}

/* ── Content ── */
.content {
  flex: 1;
  overflow: auto;
  background: var(--bg-primary);
}
</style>
