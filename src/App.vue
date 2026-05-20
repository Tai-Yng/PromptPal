<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import DesktopPet from './components/DesktopPet.vue'
import PanelPage from './components/PanelPage.vue'
import ContextMenu from './components/ContextMenu.vue'

const windowKind = computed(() => {
  // 优先使用 window label 判断
  try {
    const label = getCurrentWindow().label
    if (label.startsWith('context-menu')) return 'context-menu'
  } catch {}
  // 回退到 URL 查询参数
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
  <PanelPage v-else />
</template>
