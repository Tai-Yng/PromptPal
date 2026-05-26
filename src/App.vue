<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import DesktopPet from './components/DesktopPet.vue'
import PanelPage from './components/PanelPage.vue'
import ContextMenu from './components/ContextMenu.vue'
import QuickInject from './components/QuickInject.vue'

const windowKind = computed(() => {
  try {
    const label = getCurrentWindow().label
    if (label.startsWith('context-menu')) return 'context-menu'
    if (label === 'quick-inject') return 'quick-inject'
  } catch {}
  const params = new URLSearchParams(window.location.search)
  return params.get('window') || 'pet'
})

// 面板窗口添加背景
onMounted(() => {
  if (windowKind.value === 'panel') {
    document.body.classList.add('panel-bg')
  }
})
</script>

<template>
  <DesktopPet v-if="windowKind === 'pet'" />
  <ContextMenu v-else-if="windowKind === 'context-menu'" />
  <QuickInject v-else-if="windowKind === 'quick-inject'" />
  <PanelPage v-else />
</template>
