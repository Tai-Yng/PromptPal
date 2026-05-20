<script setup lang="ts">
import { ref } from 'vue'
import PromptPanel from './PromptPanel.vue'
import AIGeneratePanel from './AIGeneratePanel.vue'
import SettingsPanel from './SettingsPanel.vue'

const activeView = ref<'prompt' | 'ai' | 'settings'>('prompt')
</script>

<template>
  <div class="panel-page">
    <!-- 侧边导航 -->
    <nav class="sidebar">
      <div class="sidebar-header">
        <span class="logo">⚡</span>
        <span class="logo-text">PromptPal</span>
      </div>
      <div class="nav-items">
        <button :class="{ active: activeView === 'prompt' }" @click="activeView = 'prompt'">
          📋 Prompt 管理
        </button>
        <button :class="{ active: activeView === 'ai' }" @click="activeView = 'ai'">
          ✨ AI 生成
        </button>
        <button :class="{ active: activeView === 'settings' }" @click="activeView = 'settings'">
          ⚙️ 设置
        </button>
      </div>
      <div class="sidebar-footer">
        <span class="version">v1.0.0</span>
      </div>
    </nav>

    <!-- 主内容区 -->
    <main class="content">
      <PromptPanel v-if="activeView === 'prompt'" />
      <AIGeneratePanel v-if="activeView === 'ai'" @close="activeView = 'prompt'" @settings="activeView = 'settings'" />
      <SettingsPanel v-if="activeView === 'settings'" @close="activeView = 'prompt'" />
    </main>
  </div>
</template>

<style scoped>
.panel-page {
  display: flex;
  width: 100%;
  height: 100vh;
  background: #0F172A;
  color: #E2E8F0;
  font-family: 'Segoe UI', 'Microsoft YaHei', -apple-system, BlinkMacSystemFont, sans-serif;
}

.sidebar {
  width: 200px;
  min-width: 200px;
  background: #1E293B;
  border-right: 1px solid rgba(100, 116, 139, 0.2);
  display: flex;
  flex-direction: column;
  padding: 0;
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 16px;
  border-bottom: 1px solid rgba(100, 116, 139, 0.2);
}
.logo { font-size: 24px; }
.logo-text { font-size: 16px; font-weight: 700; color: #00D4AA; }

.nav-items {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 8px;
}

.nav-items button {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 14px;
  background: none;
  border: none;
  border-radius: 8px;
  color: #94A3B8;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}
.nav-items button:hover { background: rgba(100, 116, 139, 0.15); color: #CBD5E1; }
.nav-items button.active {
  background: rgba(0, 212, 170, 0.1);
  color: #00D4AA;
  font-weight: 600;
}

.sidebar-footer {
  padding: 12px 16px;
  border-top: 1px solid rgba(100, 116, 139, 0.2);
}
.version { font-size: 12px; color: #475569; }

.content {
  flex: 1;
  overflow: auto;
}
</style>
