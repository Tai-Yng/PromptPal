<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { invoke } from '@tauri-apps/api/core'
import { usePromptStore } from '../stores/promptStore'
import { useSettingsStore } from '../stores/settingsStore'

// ============ 状态 ============
type PetState = 'idle' | 'walk' | 'active' | 'sleeping'
type Direction = 'left' | 'right'

const state = ref<PetState>('walk')
const direction = ref<Direction>('left')
const showSleepZzz = ref(false)
const showContextMenu = ref(false)
const showCopySuccess = ref(false)
const isCopying = ref(false)

// 运动状态
let windowX = 0
let windowY = 0
let walkDirection: 1 | -1 = -1
let workArea = { width: 1920, height: 1080 }

// 定时器
let moveTimer: number | null = null
let sleepTimer: number | null = null

// ============ 屏幕工作区 ============
const updateWorkArea = async () => {
  try {
    const monitor = await getCurrentWindow().currentMonitor()
    if (monitor) {
      workArea = { width: monitor.size.width, height: monitor.size.height }
    }
  } catch {}
}

const groundY = () => workArea.height - 200 - 8
const bounds = () => ({ left: 8, right: workArea.width - 120 - 8 })

// ============ 行走 ============
const move = async () => {
  if (state.value === 'sleeping' || isCopying.value) return
  const b = bounds()
  let x = windowX + 3 * walkDirection
  if (x <= b.left) { x = b.left; walkDirection = 1 }
  else if (x >= b.right) { x = b.right; walkDirection = -1 }
  windowX = x; windowY = groundY()
  direction.value = walkDirection === 1 ? 'right' : 'left'
  try { await getCurrentWindow().setPosition({ type: 'Logical', x: Math.round(windowX), y: Math.round(windowY) }) } catch {}
}

// ============ 单击复制提示词 ============
const handleClick = async () => {
  const settingsStore = useSettingsStore()
  if (!settingsStore.petConfig.dblClickCopy) return
  if (isCopying.value) return
  isCopying.value = true
  
  const store = usePromptStore()
  const saved = localStorage.getItem('promptpal_prompts')
  const savedDefaultId = localStorage.getItem('promptpal_default_prompt_id')
  if (saved) { try { store.prompts = JSON.parse(saved) } catch {} }
  if (savedDefaultId) { store.defaultPromptId = savedDefaultId }
  
  if (store.prompts.length === 0) {
    isCopying.value = false
    invoke('show_panel').catch(() => {})
    return
  }
  
  const prompt = store.prompts.find(p => p.id === store.defaultPromptId) || store.prompts[0]
  if (!prompt) { isCopying.value = false; return }
  
  const ok = await store.copyToClipboard(prompt.content)
  if (ok) {
    store.incrementUseCount(prompt.id)
    showCopySuccess.value = true
    setTimeout(() => { showCopySuccess.value = false }, 1500)
  }
  isCopying.value = false
}

// ============ 双击打开面板 ============
const handleDblClick = () => {
  state.value = 'active'
  invoke('show_panel').catch(() => {})
  setTimeout(() => { if (state.value === 'active') state.value = 'walk' }, 500)
}

// ============ 右键菜单复制 ============
const handleContextMenu = (e: MouseEvent) => {
  e.preventDefault()
  e.stopPropagation()
  showContextMenu.value = true
}

const closeContextMenu = () => { showContextMenu.value = false }

const openPanel = () => {
  closeContextMenu()
  invoke('show_panel').catch(() => {})
}

const copyFromMenu = async () => {
  closeContextMenu()
  await handleDblClick()
}

// ============ 睡眠 ============
const enterSleep = () => {
  if (state.value !== 'sleeping' && !isCopying.value) {
    state.value = 'sleeping'
    showSleepZzz.value = true
  }
}

// ============ 初始化 ============
onMounted(async () => {
  await updateWorkArea()
  const b = bounds()
  windowX = b.right; windowY = groundY()
  try { await getCurrentWindow().setPosition({ type: 'Logical', x: Math.round(windowX), y: Math.round(windowY) }) } catch {}
  
  state.value = 'walk'
  moveTimer = window.setInterval(move, 120)
  sleepTimer = window.setInterval(enterSleep, 120000)
})

onUnmounted(() => {
  if (moveTimer) clearInterval(moveTimer)
  if (sleepTimer) clearInterval(sleepTimer)
})
</script>

<template>
  <div class="pet-window">
    <div
      class="pet-container"
      :class="[direction, state, { copying: isCopying }]"
      @click="handleClick"
      @dblclick="handleDblClick"
      @contextmenu="handleContextMenu"
    >
      <!-- 桌宠形象 -->
      <div class="pet-body">
        <!-- 天线 -->
        <div class="antenna">
          <div class="antenna-ball" :class="{ active: state === 'active' || showCopySuccess }"></div>
        </div>

        <!-- 头部 -->
        <div class="head">
          <div class="visor">
            <div class="eye" :class="state"></div>
            <div class="eye" :class="state"></div>
          </div>
        </div>

        <!-- 身体 -->
        <div class="torso">
          <div class="core" :class="{ active: state === 'active' || isCopying }"></div>
        </div>

        <!-- 腿部 -->
        <div class="legs" :class="{ walk: state === 'walk' }">
          <div class="leg"></div>
          <div class="leg"></div>
        </div>
      </div>

      <!-- 复制成功提示 -->
      <div v-if="showCopySuccess" class="copy-tip">已复制!</div>

      <!-- 睡眠Zzz -->
      <div v-if="showSleepZzz" class="zzz">
        <span>Z</span><span>z</span><span>z</span>
      </div>
    </div>

    <!-- 右键菜单 -->
    <div v-if="showContextMenu" class="context-menu" @click.stop>
      <div class="menu-item" @click="openPanel">打开面板</div>
      <div class="menu-item" @click="copyFromMenu">复制提示词</div>
      <div class="menu-item" @click="closeContextMenu">关闭</div>
    </div>
  </div>
</template>

<style scoped>
.pet-window {
  width: 120px;
  height: 200px;
  background: transparent;
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  overflow: visible;
}

.pet-container {
  position: relative;
  width: 80px;
  height: 100px;
  cursor: pointer;
  user-select: none;
}

.pet-container.right .pet-body { transform: scaleX(-1); }

.pet-body {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: float 2s ease-in-out infinite;
}

.pet-container.sleeping .pet-body {
  animation: none;
  transform: rotate(15deg);
  opacity: 0.7;
}

.pet-container.copying .pet-body {
  animation: bounce 0.3s ease-in-out;
}

/* 天线 */
.antenna {
  width: 3px;
  height: 12px;
  background: #64748B;
  margin-bottom: -2px;
  position: relative;
}

.antenna-ball {
  width: 8px;
  height: 8px;
  background: #F59E0B;
  border-radius: 50%;
  position: absolute;
  top: -10px;
  left: -2.5px;
  box-shadow: 0 0 6px #F59E0B;
}

.antenna-ball.active {
  background: #00D4AA;
  box-shadow: 0 0 12px #00D4AA;
}

/* 头部 */
.head {
  width: 48px;
  height: 40px;
  background: #334155;
  border: 2px solid #475569;
  border-radius: 6px 6px 3px 3px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.visor {
  width: 36px;
  height: 16px;
  background: #0F172A;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
}

.eye {
  width: 8px;
  height: 8px;
  background: #00F5C8;
  border-radius: 50%;
  box-shadow: 0 0 4px #00F5C8;
}

.eye.sleeping {
  width: 6px;
  height: 2px;
  background: #64748B;
  box-shadow: none;
  border-radius: 0;
}

/* 身体 */
.torso {
  width: 40px;
  height: 28px;
  background: #334155;
  border: 2px solid #475569;
  border-top: none;
  border-radius: 0 0 6px 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: -2px;
}

.core {
  width: 10px;
  height: 10px;
  background: #00D4AA;
  border-radius: 50%;
  opacity: 0.5;
}

.core.active {
  opacity: 1;
  box-shadow: 0 0 10px #00D4AA;
}

/* 腿部 */
.legs {
  display: flex;
  gap: 10px;
  margin-top: -2px;
  opacity: 0;
}

.legs.walk { opacity: 1; }

.leg {
  width: 8px;
  height: 14px;
  background: #475569;
  border-radius: 0 0 3px 3px;
}

.legs.walk .leg:first-child { animation: leg-move 0.3s ease-in-out infinite; }
.legs.walk .leg:last-child { animation: leg-move 0.3s ease-in-out infinite reverse; }

/* 复制提示 */
.copy-tip {
  position: absolute;
  top: -30px;
  left: 50%;
  transform: translateX(-50%);
  background: #00D4AA;
  color: #0F172A;
  padding: 4px 10px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: bold;
  white-space: nowrap;
  animation: pop 0.3s ease-out;
}

/* Zzz */
.zzz {
  position: absolute;
  top: -15px;
  right: -10px;
  display: flex;
  flex-direction: column;
  color: #00D4AA;
}

.zzz span {
  font-size: 12px;
  opacity: 0.6;
  animation: zzz-float 2s ease-in-out infinite;
}

.zzz span:nth-child(2) { animation-delay: 0.3s; font-size: 10px; }
.zzz span:nth-child(3) { animation-delay: 0.6s; font-size: 8px; }

/* 右键菜单 */
.context-menu {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(15, 23, 42, 0.98);
  border: 1px solid rgba(0, 212, 170, 0.5);
  border-radius: 8px;
  padding: 6px;
  z-index: 99999;
  min-width: 120px;
}

.menu-item {
  padding: 8px 12px;
  color: #E2E8F0;
  font-size: 13px;
  cursor: pointer;
  border-radius: 4px;
}

.menu-item:hover {
  background: rgba(0, 212, 170, 0.2);
  color: #00F5C8;
}

/* 动画 */
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}

@keyframes leg-move {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
}

@keyframes zzz-float {
  0% { opacity: 0; transform: translateY(0); }
  50% { opacity: 0.7; }
  100% { opacity: 0; transform: translateY(-10px); }
}

@keyframes pop {
  0% { opacity: 0; transform: translateX(-50%) scale(0.8); }
  100% { opacity: 1; transform: translateX(-50%) scale(1); }
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}
</style>
