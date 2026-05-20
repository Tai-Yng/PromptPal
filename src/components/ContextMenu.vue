<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { invoke } from '@tauri-apps/api/core'
import { usePromptStore } from '../stores/promptStore'

const menuEl = ref<HTMLElement | null>(null)
const selectedIndex = ref(-1)

// 从本地存储加载数据
const loadStoreData = () => {
  const store = usePromptStore()
  try {
    const savedPrompts = localStorage.getItem('promptpal_prompts')
    const savedDefaultId = localStorage.getItem('promptpal_default_prompt_id')
    if (savedPrompts) store.prompts = JSON.parse(savedPrompts)
    if (savedDefaultId) store.defaultPromptId = savedDefaultId
  } catch {}
  return store
}

// 关闭菜单窗口
const closeWindow = async () => {
  try {
    await getCurrentWindow().close()
  } catch {}
}

// 获得到剪贴板的写入权限（Tauri 下）
const writeClipboard = async (text: string): Promise<boolean> => {
  try {
    if ((window as any).__TAURI_INTERNALS__) {
      const { writeText } = await import('@tauri-apps/plugin-clipboard-manager')
      await writeText(text)
    } else {
      await navigator.clipboard.writeText(text)
    }
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch { return false }
  }
}

// 菜单项
const items = [
  { id: 'panel', label: '打开 Prompt 面板', shortcut: 'Esc' },
  { id: 'copy', label: '复制默认提示词', shortcut: '双击' },
]

const handleAction = async (id: string) => {
  if (id === 'panel') {
    invoke('show_panel').catch(() => {})
  } else if (id === 'copy') {
    const store = loadStoreData()
    if (store.prompts.length > 0) {
      const targetId = store.defaultPromptId || store.prompts[0].id
      const prompt = store.prompts.find(p => p.id === targetId)
      if (prompt) {
        const ok = await writeClipboard(prompt.content)
        if (ok) store.incrementUseCount(prompt.id)
      }
    }
  }
  closeWindow()
}

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') { closeWindow(); return }
  if (e.key === 'ArrowDown') { selectedIndex.value = (selectedIndex.value + 1) % items.length; return }
  if (e.key === 'ArrowUp') { selectedIndex.value = (selectedIndex.value - 1 + items.length) % items.length; return }
  if (e.key === 'Enter' && selectedIndex.value >= 0) { handleAction(items[selectedIndex.value].id); return }
}

// 点击外部关闭
const handleOverlayClick = () => closeWindow()

// 鼠标悬停更新选中
const handleItemMouseEnter = (idx: number) => { selectedIndex.value = idx }

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('blur', closeWindow)
  // 自动聚焦
  setTimeout(() => menuEl.value?.focus(), 50)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('blur', closeWindow)
})
</script>

<template>
  <div class="overlay" @click="handleOverlayClick" @contextmenu.prevent="closeWindow">
    <div
      ref="menuEl"
      class="menu-container"
      tabindex="0"
      @click.stop
      @contextmenu.prevent
    >
      <div class="menu-header">
        <span class="menu-icon">⚡</span>
        <span class="menu-title">PromptPal</span>
      </div>
      <div class="menu-items">
        <button
          v-for="(item, idx) in items"
          :key="item.id"
          class="menu-item"
          :class="{ active: selectedIndex === idx }"
          @click="handleAction(item.id)"
          @mouseenter="handleItemMouseEnter(idx)"
        >
          <span v-if="item.id === 'panel'" class="item-icon">📋</span>
          <span v-else class="item-icon">⭐</span>
          <span class="item-label">{{ item.label }}</span>
          <span class="item-shortcut">{{ item.shortcut }}</span>
        </button>
      </div>
      <div class="menu-footer">
        <span class="footer-text">右键关闭 · Esc 退出</span>
      </div>
    </div>
  </div>
</template>

<style>
/* 确保全局透明背景 */
html, body, #app { background: transparent !important; }
</style>

<style scoped>
* { margin: 0; padding: 0; box-sizing: border-box; }

.overlay {
  position: fixed;
  inset: 0;
  background: transparent;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  pointer-events: auto;
}

.menu-container {
  min-width: 200px;
  background: rgba(15, 23, 42, 0.97);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(0, 212, 170, 0.25);
  border-radius: 14px;
  padding: 8px;
  box-shadow:
    0 8px 40px rgba(0, 0, 0, 0.6),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  outline: none;
  pointer-events: auto;
  animation: menu-in 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes menu-in {
  0% { opacity: 0; transform: scale(0.95) translateY(-4px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}

.menu-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 10px;
  border-bottom: 1px solid rgba(100, 116, 139, 0.15);
  margin-bottom: 4px;
}

.menu-icon {
  font-size: 16px;
}

.menu-title {
  font-size: 13px;
  font-weight: 500;
  color: #00D4AA;
  letter-spacing: 0.5px;
}

.menu-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  background: none;
  border: none;
  border-radius: 10px;
  color: #CBD5E1;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: all 0.12s ease;
  font-family: inherit;
}

.menu-item.active,
.menu-item:hover {
  background: rgba(0, 212, 170, 0.12);
  color: #00F5C8;
}

.menu-item:active {
  background: rgba(0, 212, 170, 0.2);
  transform: scale(0.98);
}

.item-icon {
  font-size: 14px;
  width: 20px;
  text-align: center;
  flex-shrink: 0;
}

.item-label {
  flex: 1;
  white-space: nowrap;
}

.item-shortcut {
  font-size: 11px;
  color: #64748B;
  background: rgba(100, 116, 139, 0.15);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
}

.menu-footer {
  padding: 8px 12px 4px;
  border-top: 1px solid rgba(100, 116, 139, 0.1);
  margin-top: 4px;
}

.footer-text {
  font-size: 10px;
  color: rgba(100, 116, 139, 0.6);
}
</style>
