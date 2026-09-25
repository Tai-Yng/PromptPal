// 桌宠运动状态机：行走/暂停/小跳/拖拽/睡眠 + 窗口位置持久化
// 从 DesktopPet.vue 机械搬移，行为保持不变
import { ref, type Ref } from 'vue'
import { getCurrentWindow, currentMonitor } from '@tauri-apps/api/window'
import { LogicalPosition } from '@tauri-apps/api/dpi'
import { useSettingsStore } from '../stores/settingsStore'
import { loadJson, saveJson } from '../services/storage'

export type PetState = 'idle' | 'walk' | 'active' | 'sleeping'
export type Direction = 'left' | 'right'

// 窗口内容尺寸（与 pet.css 的 .pet-window 一致）
export const PET_W = 340
export const PET_H = 380

export function usePetMovement(options: { isCopying: Ref<boolean> }) {
  const { isCopying } = options
  const settingsStore = useSettingsStore()

  const state = ref<PetState>('walk')
  const direction = ref<Direction>('left')
  const isDragging = ref(false)
  const showSleepZzz = ref(false)

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

  // 拖拽状态
  let dragStartX = 0
  let dragStartY = 0
  let windowStartX = 0
  let windowStartY = 0

  // ============ 屏幕工作区 ============
  const updateWorkArea = async () => {
    try {
      const monitor = await currentMonitor()
      if (monitor) {
        workArea = { width: monitor.size.width, height: monitor.size.height }
      }
    } catch {/* ignore */}
  }

  const groundY = () => workArea.height - PET_H - 8
  const bounds = () => ({ left: 8, right: workArea.width - PET_W - 8 })

  // ============ 丰富行走行为 ============
  const getRandomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

  // 小跳后落回地面
  const landAfterHop = async () => {
    if (state.value !== 'sleeping') {
      try { await getCurrentWindow().setPosition(new LogicalPosition(Math.round(windowX), Math.round(groundY()))) } catch {/* ignore */}
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
      try { await getCurrentWindow().setPosition(new LogicalPosition(Math.round(windowX), Math.round(hopY))) } catch {/* ignore */}
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

    const maxX = workArea.width - PET_W
    const finalX = Math.min(windowX, maxX)
    try { await getCurrentWindow().setPosition(new LogicalPosition(Math.round(finalX), Math.round(windowY))) } catch {/* ignore */}
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
    const maxX = workArea.width - PET_W
    const maxY = workArea.height - PET_H
    windowX = Math.max(0, Math.min(windowX, maxX))
    windowY = Math.max(0, Math.min(windowY, maxY))

    try {
      await getCurrentWindow().setPosition(new LogicalPosition(Math.round(windowX), Math.round(windowY)))
    } catch {/* ignore */}
  }

  const handleMouseUp = () => {
    isDragging.value = false
    state.value = 'walk'

    // 持久化位置
    saveJson('promptpal_pet_position', { x: windowX, y: windowY })

    // 移除全局鼠标事件监听
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
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
  const init = async () => {
    await updateWorkArea()
    const b = bounds()

    // 尝试恢复上次位置
    const pos = loadJson<{ x?: number; y?: number } | null>('promptpal_pet_position', null)
    if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
      // 确保位置在屏幕范围内
      const maxX = workArea.width - PET_W
      const maxY = workArea.height - PET_H
      windowX = Math.max(0, Math.min(pos.x, maxX))
      windowY = Math.max(0, Math.min(pos.y, maxY))
    } else {
      windowX = b.right; windowY = groundY()
    }
    try { await getCurrentWindow().setPosition(new LogicalPosition(Math.round(windowX), Math.round(windowY))) } catch {/* ignore */}

    state.value = 'walk'
    moveTimer = window.setInterval(move, 120)
    sleepTimer = window.setInterval(checkSleep, 10000)
  }

  const cleanup = () => {
    if (moveTimer) clearInterval(moveTimer)
    if (sleepTimer) clearInterval(sleepTimer)
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }

  return {
    state, direction, isDragging, showSleepZzz,
    init, cleanup, wakeUp, handleMouseDown
  }
}
