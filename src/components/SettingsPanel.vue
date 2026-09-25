<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { exitApp } from '../services/autoSync'
import AiTab from './settings/AiTab.vue'
import PetTab from './settings/PetTab.vue'
import SyncTab from './settings/SyncTab.vue'

const emit = defineEmits<{ (e: 'close'): void }>()

const activeTab = ref<'ai' | 'pet' | 'sync'>('ai')

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
      <AiTab v-if="activeTab === 'ai'" />
      <PetTab v-else-if="activeTab === 'pet'" />
      <SyncTab v-else />

      <!-- Exit -->
      <div class="exit-row">
        <button class="exit-btn" @click="exitApp().catch(() => {})">
          <span class="exit-sym">x</span> exit PromptPal
        </button>
      </div>
    </div>
  </div>
</template>

<style src="./settings/settings-shared.css"></style>

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

/* ── Exit ── */
.exit-row {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-light);
  display: flex;
  justify-content: center;
}
.exit-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 20px;
  border: 1px solid rgba(239, 68, 68, 0.3);
  background: transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 11px;
  color: #FCA5A5;
  cursor: pointer;
  transition: all var(--transition-normal);
}
.exit-btn:hover {
  background: rgba(239, 68, 68, 0.12);
  color: var(--error);
  border-color: rgba(239, 68, 68, 0.5);
}
.exit-sym { opacity: 0.7; }
</style>
