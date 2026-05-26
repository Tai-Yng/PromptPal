<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { invoke } from '@tauri-apps/api/core'
import { usePromptStore } from '../stores/promptStore'
import { useSettingsStore } from '../stores/settingsStore'
import { usePetStyleStore } from '../stores/petStyleStore'

const petStore = usePetStyleStore()

// ============ 状态 ============
type PetState = 'idle' | 'walk' | 'active' | 'sleeping'
type Direction = 'left' | 'right'

const state = ref<PetState>('walk')
const direction = ref<Direction>('left')
const showSleepZzz = ref(false)
const showContextMenu = ref(false)
const showCopySuccess = ref(false)
const isCopying = ref(false)
const isDragging = ref(false)

// 运动状态
let windowX = 0
let windowY = 0
let walkDirection: 1 | -1 = -1
let workArea = { width: 1920, height: 1080 }
let randomPauseCounter = 0
let isPaused = false

// 定时器
let moveTimer: number | null = null
let sleepTimer: number | null = null
let pauseTimer: number | null = null
let hopTimer: number | null = null

// 拖拽状态
let dragStartX = 0
let dragStartY = 0
let windowStartX = 0
let windowStartY = 0

// 快捷方式
const settingsStore = useSettingsStore()

// ============ 智能气泡 ============
const showSuggestBubble = ref(false)
const suggestPromptTitle = ref('')
const suggestPromptContent = ref('')
const suggestPromptId = ref('')
let suggestTimer: number | null = null
let contextTimer: number | null = null
let suggestDismissTimer: number | null = null
const contextCooldown: Record<string, number> = {}

// 窗口标题 → 推荐 Prompt 类别
const contextRules: { pattern: RegExp; category: string }[] = [
  { pattern: /chat\.openai\.com|chatgpt/i, category: 'chat' },
  { pattern: /DeepSeek|deepseek/i, category: 'chat' },
  { pattern: /Visual Studio Code|VS Code/i, category: 'code' },
  { pattern: /Cursor|Windsurf/i, category: 'code' },
  { pattern: /Midjourney|Discord.*Midjourney/i, category: 'image' },
  { pattern: /翻译|translate/i, category: 'chat' },
  { pattern: /Notion|Obsidian/i, category: 'writing' },
  { pattern: /Claude|claude/i, category: 'chat' },
]

const suggestCopyAndDismiss = async () => {
  if (!suggestPromptContent.value) return
  const store = usePromptStore()
  try {
    const { writeText } = await import('@tauri-apps/plugin-clipboard-manager')
    await writeText(suggestPromptContent.value)
  } catch {
    await navigator.clipboard.writeText(suggestPromptContent.value)
  }
  store.incrementUseCount(suggestPromptId.value)
  showSuggestBubble.value = false
}

const dismissSuggest = () => {
  showSuggestBubble.value = false
}

// 每 5 秒检测一次活跃窗口
const checkContext = async () => {
  if (state.value === 'sleeping' || isDragging.value || showSuggestBubble.value) return
  if (!settingsStore.petConfig.contextAware) return
  
  try {
    const title: string = await invoke('get_active_window_title')
    if (!title) return
    
    // 防打扰：同一标题 30 分钟内只提示一次
    const now = Date.now()
    const key = title.slice(0, 50)
    if (contextCooldown[key] && now - contextCooldown[key] < 30 * 60 * 1000) return
    
    // 匹配规则
    for (const rule of contextRules) {
      if (rule.pattern.test(title)) {
        contextCooldown[key] = now
        
        // 找到匹配的 Prompt
        const store = usePromptStore()
        const saved = localStorage.getItem('promptpal_prompts')
        if (saved) { try { store.prompts = JSON.parse(saved) } catch {/* ignore */} }
        
        const match = store.prompts.find(p => p.category === rule.category && p.favorite)
          || store.prompts.find(p => p.category === rule.category)
        
        if (match) {
          suggestPromptTitle.value = match.title
          suggestPromptContent.value = match.content
          suggestPromptId.value = match.id
          showSuggestBubble.value = true
          
          // 5 秒后自动消失
          if (suggestDismissTimer) clearTimeout(suggestDismissTimer)
          suggestDismissTimer = window.setTimeout(() => {
            showSuggestBubble.value = false
          }, 5000)
        }
        break
      }
    }
  } catch {/* ignore */}
}

// ============ 屏幕工作区 ============
const updateWorkArea = async () => {
  try {
    const monitor = await getCurrentWindow().currentMonitor()
    if (monitor) {
      workArea = { width: monitor.size.width, height: monitor.size.height }
    }
  } catch {/* ignore */}
}

const groundY = () => workArea.height - 200 - 8
const bounds = () => ({ left: 8, right: workArea.width - 120 - 8 })

// ============ 丰富行走行为 ============
const getRandomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

// 小跳后落回地面
const landAfterHop = async () => {
  if (state.value !== 'sleeping') {
    try { await getCurrentWindow().setPosition({ type: 'Logical', x: Math.round(windowX), y: Math.round(groundY()) }) } catch {/* ignore */}
  }
}

const move = async () => {
  if (state.value === 'sleeping' || isCopying.value || isDragging.value) return
  
  const b = bounds()
  const isAtEdge = windowX <= b.left + 10 || windowX >= b.right - 10

  // 随机行为决策
  if (!isPaused && randomPauseCounter <= 0 && Math.random() < 0.06) {
    // 6% 概率进入暂停
    isPaused = true
    state.value = 'idle'
    randomPauseCounter = getRandomInt(15, 60) // 暂停 0.5~2 秒
    return
  }

  if (!isPaused && isAtEdge && Math.random() < 0.4) {
    // 到边缘时 40% 概率暂停一下
    isPaused = true
    state.value = 'idle'
    randomPauseCounter = getRandomInt(10, 30)
    return
  }

  if (!isPaused && !isAtEdge && Math.random() < 0.02) {
    // 2% 概率中途调头
    walkDirection = (walkDirection * -1) as 1 | -1
  }

  if (!isPaused && Math.random() < 0.015) {
    // 1.5% 概率小跳
    const hopY = groundY() - getRandomInt(15, 40)
    try { await getCurrentWindow().setPosition({ type: 'Logical', x: Math.round(windowX), y: Math.round(hopY) }) } catch {/* ignore */}
    setTimeout(landAfterHop, 180)
  }

  if (isPaused) {
    randomPauseCounter--
    if (randomPauseCounter <= 0) {
      isPaused = false
      state.value = 'walk'
      // 暂停结束后调头概率 30%
      if (Math.random() < 0.3) walkDirection = (walkDirection * -1) as 1 | -1
    }
    return
  }

  // 正常行走：速度从配置读取（walkSpeed 0.1~1.0 映射到 1~6 像素/帧）
  const speed = 1 + Math.round(settingsStore.petConfig.walkSpeed * 5)
  const jitter = Math.floor(Math.abs(Math.sin(Date.now() / 3000)) * 2)
  const moveSpeed = speed + jitter
  let x = windowX + moveSpeed * walkDirection

  if (x <= b.left) { x = b.left; walkDirection = 1 }
  else if (x >= b.right) { x = b.right; walkDirection = -1 }

  windowX = x; windowY = groundY()
  direction.value = walkDirection === 1 ? 'right' : 'left'

  const maxX = workArea.width - 140
  const finalX = Math.min(windowX, maxX)
  try { await getCurrentWindow().setPosition({ type: 'Logical', x: Math.round(finalX), y: Math.round(windowY) }) } catch {/* ignore */}
}

// ============ 拖拽移动 ============
const handleMouseDown = async (e: MouseEvent) => {
  // 只有左键可以拖拽
  if (e.button !== 0) return
  
  wakeUp()
  isDragging.value = true
  state.value = 'idle'
  
  dragStartX = e.screenX
  dragStartY = e.screenY
  windowStartX = windowX
  windowStartY = windowY
  
  // 添加全局鼠标事件监听
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

const handleMouseMove = async (e: MouseEvent) => {
  if (!isDragging.value) return
  
  const deltaX = e.screenX - dragStartX
  const deltaY = e.screenY - dragStartY
  
  windowX = windowStartX + deltaX
  windowY = windowStartY + deltaY
  
  // 限制在屏幕范围内
  const maxX = workArea.width - 120
  const maxY = workArea.height - 150
  windowX = Math.max(0, Math.min(windowX, maxX))
  windowY = Math.max(0, Math.min(windowY, maxY))
  
  try { 
    await getCurrentWindow().setPosition({ type: 'Logical', x: Math.round(windowX), y: Math.round(windowY) }) 
  } catch {/* ignore */}
}

const handleMouseUp = () => {
  isDragging.value = false
  state.value = 'walk'
  
  // 持久化位置
  localStorage.setItem('promptpal_pet_position', JSON.stringify({ x: windowX, y: windowY }))
  
  // 移除全局鼠标事件监听
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
}

// ============ 单击复制提示词 ============
const handleClick = async () => {
  // 如果正在拖拽，不触发点击
  if (isDragging.value) return
  
  const store = usePromptStore()
  if (!settingsStore.petConfig.dblClickCopy) return
  if (isCopying.value) return
  isCopying.value = true

  const saved = localStorage.getItem('promptpal_prompts')
  const savedDefaultId = localStorage.getItem('promptpal_default_prompt_id')
  if (saved) { try { store.prompts = JSON.parse(saved) } catch {/* ignore */} }
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
  // 如果正在拖拽，不触发双击
  if (isDragging.value) return
  
  state.value = 'active'
  invoke('show_panel').catch(() => {})
  setTimeout(() => { if (state.value === 'active') state.value = 'walk' }, 500)
}

// ============ 右键菜单 ============
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

const quitApp = () => {
  closeContextMenu()
  invoke('exit_app').catch(() => {})
}

// ============ 睡眠 ============
let lastActivityTime = Date.now()
const enterSleep = () => {
  if (state.value !== 'sleeping' && !isCopying.value && !isDragging.value) {
    state.value = 'sleeping'
    showSleepZzz.value = true
  }
}
const wakeUp = () => {
  lastActivityTime = Date.now()
  if (state.value === 'sleeping') {
    state.value = 'walk'
    showSleepZzz.value = false
  }
}
const checkSleep = () => {
  const timeout = settingsStore.petConfig.sleepTimeout * 1000
  if (timeout <= 0) return
  if (Date.now() - lastActivityTime > timeout) {
    enterSleep()
    lastActivityTime = Date.now()
  }
}

// ============ 初始化 ============
onMounted(async () => {
  await updateWorkArea()
  const b = bounds()
  
  // 尝试恢复上次位置
  const savedPosition = localStorage.getItem('promptpal_pet_position')
  if (savedPosition) {
    try {
      const pos = JSON.parse(savedPosition)
      // 确保位置在屏幕范围内
      const maxX = workArea.width - 120
      const maxY = workArea.height - 150
      windowX = Math.max(0, Math.min(pos.x, maxX))
      windowY = Math.max(0, Math.min(pos.y, maxY))
    } catch {
      windowX = b.right; windowY = groundY()
    }
  } else {
    windowX = b.right; windowY = groundY()
  }
  try { await getCurrentWindow().setPosition({ type: 'Logical', x: Math.round(windowX), y: Math.round(windowY) }) } catch {/* ignore */}

  state.value = 'walk'
  moveTimer = window.setInterval(move, 120)
  sleepTimer = window.setInterval(checkSleep, 10000)
  contextTimer = window.setInterval(checkContext, 5000)
})

onUnmounted(() => {
  if (moveTimer) clearInterval(moveTimer)
  if (sleepTimer) clearInterval(sleepTimer)
  if (contextTimer) clearInterval(contextTimer)
  if (suggestDismissTimer) clearTimeout(suggestDismissTimer)
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
})
</script>

<template>
  <div class="pet-window" :style="petStore.cssVariables">
    <div
      class="pet-container"
      :class="[direction, state, { copying: isCopying, dragging: isDragging }]"
      @mousedown="handleMouseDown"
      @click="handleClick"
      @dblclick="handleDblClick"
      @contextmenu="handleContextMenu"
    >
      <!-- 桌宠形象 -->
      <div class="pet-body">
        <div class="antenna">
          <div class="antenna-ball" :class="{ active: state === 'active' || showCopySuccess }"></div>
        </div>
        <div class="head">
          <div class="visor">
            <div class="eye" :class="state"></div>
            <div class="eye" :class="state"></div>
          </div>
        </div>
        <div class="torso">
          <div class="core" :class="{ active: state === 'active' || isCopying }"></div>
        </div>
        <div class="legs" :class="{ walk: state === 'walk' }">
          <div class="leg"></div>
          <div class="leg"></div>
        </div>
      </div>

      <div v-if="showCopySuccess" class="copy-tip">已复制!</div>
      <div v-if="showSleepZzz" class="zzz"><span>Z</span><span>z</span><span>z</span></div>
    </div>

    <!-- 智能气泡建议 -->
    <Transition name="bubble">
      <div v-if="showSuggestBubble" class="suggest-bubble" @click.stop="suggestCopyAndDismiss">
        <span class="bubble-tip">Try this?</span>
        <span class="bubble-title">&gt; {{ suggestPromptTitle }}</span>
        <span class="bubble-close" @click.stop="dismissSuggest">x</span>
      </div>
    </Transition>

    <div v-if="showContextMenu" class="context-menu" @click.stop>
      <div class="menu-item" @click="openPanel">Show Panel</div>
      <div class="menu-item" @click="quitApp" style="color: #FCA5A5">Exit</div>
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
  cursor: grab;
  user-select: none;
}

.pet-container.dragging {
  cursor: grabbing;
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

.pet-container.dragging .pet-body {
  animation: none;
  transform: scale(1.05);
}

.antenna {
  width: 3px;
  height: calc(12px * var(--pet-antenna-height, 1));
  background: var(--pet-body-border-color, #52525B);
  margin-bottom: -2px;
  position: relative;
}

.antenna-ball {
  width: 8px;
  height: 8px;
  background: var(--pet-secondary-color, #818CF8);
  border-radius: 50%;
  position: absolute;
  top: -10px;
  left: -2.5px;
  box-shadow: 0 0 8px var(--pet-secondary-color, #818CF8);
  transition: all 0.3s;
}

.antenna-ball.active {
  background: var(--pet-primary-color, #6366F1);
  box-shadow: 0 0 18px var(--pet-primary-color, #6366F1);
}

.head {
  width: calc(48px * var(--pet-head-size, 1));
  height: calc(40px * var(--pet-head-size, 1));
  background: var(--pet-body-color, #27272A);
  border: 2px solid var(--pet-body-border-color, #3F3F46);
  border-radius: 6px 6px 3px 3px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.visor {
  width: calc(36px * var(--pet-head-size, 1));
  height: calc(16px * var(--pet-head-size, 1));
  background: var(--pet-visor-color, #09090B);
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
}

.eye {
  width: calc(8px * var(--pet-head-size, 1));
  height: calc(8px * var(--pet-head-size, 1));
  background: var(--pet-eye-color, #22D3EE);
  border-radius: 50%;
  box-shadow: 0 0 6px var(--pet-eye-color, #22D3EE);
  transition: all 0.3s;
}

.eye.sleeping {
  width: calc(6px * var(--pet-head-size, 1));
  height: 2px;
  background: var(--pet-body-border-color, #52525B);
  box-shadow: none;
  border-radius: 0;
}

.torso {
  width: calc(40px * var(--pet-body-size, 1));
  height: calc(28px * var(--pet-body-size, 1));
  background: var(--pet-body-color, #27272A);
  border: 2px solid var(--pet-body-border-color, #3F3F46);
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
  background: var(--pet-primary-color, #6366F1);
  border-radius: 50%;
  opacity: 0.5;
  transition: all 0.3s;
}

.core.active { opacity: 1; box-shadow: 0 0 12px var(--pet-primary-color, #6366F1); }

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
  background: var(--pet-body-border-color, #3F3F46);
  border-radius: 0 0 3px 3px;
}

.legs.walk .leg:first-child { animation: leg-move 0.3s ease-in-out infinite; }
.legs.walk .leg:last-child { animation: leg-move 0.3s ease-in-out infinite reverse; }

.copy-tip {
  position: absolute;
  top: -30px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--pet-primary-color, #6366F1);
  color: #FAFAFA;
  padding: 4px 10px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: bold;
  font-family: var(--font-mono);
  white-space: nowrap;
  animation: pop 0.3s ease-out;
}

.zzz {
  position: absolute;
  top: -15px;
  right: -10px;
  display: flex;
  flex-direction: column;
  color: var(--pet-secondary-color, #818CF8);
}

.zzz span { font-size: 12px; opacity: 0.6; animation: zzz-float 2s ease-in-out infinite; }
.zzz span:nth-child(2) { animation-delay: 0.3s; font-size: 10px; }
.zzz span:nth-child(3) { animation-delay: 0.6s; font-size: 8px; }

.context-menu {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(9, 9, 11, 0.98);
  border: 1px solid rgba(99, 102, 241, 0.35);
  border-radius: 8px;
  padding: 6px;
  z-index: 99999;
  min-width: 120px;
  backdrop-filter: blur(10px);
}

.menu-item {
  padding: 8px 12px;
  color: #A1A1AA;
  font-family: var(--font-mono);
  font-size: 12px;
  cursor: pointer;
  border-radius: 4px;
  letter-spacing: 0.3px;
}

.menu-item:hover { background: rgba(99, 102, 241, 0.15); color: #818CF8; }

/* ── Suggest Bubble ── */
.suggest-bubble {
  position: absolute;
  bottom: 110%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(9, 9, 11, 0.95);
  border: 1px solid rgba(99, 102, 241, 0.4);
  border-radius: 10px;
  padding: 8px 14px;
  white-space: nowrap;
  cursor: pointer;
  z-index: 10;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5), 0 0 15px rgba(99, 102, 241, 0.15);
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 11px;
}
.suggest-bubble:hover {
  border-color: var(--primary);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5), 0 0 20px rgba(99, 102, 241, 0.25);
}
.suggest-bubble::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  width: 0; height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 6px solid rgba(99, 102, 241, 0.4);
}
.bubble-tip {
  color: var(--accent);
  font-size: 10px;
  flex-shrink: 0;
}
.bubble-title {
  color: var(--text-primary);
  font-weight: 600;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bubble-close {
  color: var(--text-muted);
  font-size: 12px;
  margin-left: 4px;
  cursor: pointer;
  padding: 0 2px;
}
.bubble-close:hover { color: var(--error); }

.bubble-enter-active, .bubble-leave-active { transition: all 0.2s ease; }
.bubble-enter-from, .bubble-leave-to { opacity: 0; transform: translateX(-50%) translateY(4px); }

@keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
@keyframes leg-move { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
@keyframes zzz-float { 0% { opacity: 0; transform: translateY(0); } 50% { opacity: 0.7; } 100% { opacity: 0; transform: translateY(-10px); } }
@keyframes pop { 0% { opacity: 0; transform: translateX(-50%) scale(0.8); } 100% { opacity: 1; transform: translateX(-50%) scale(1); } }
</style>
