// 桌宠运动状态机：巡逻行走/暂停/小跳/拖拽/睡眠 + 窗口位置持久化
// v1.4：以可见机器人为锚（窗口允许部分出屏），目标驱动巡逻保证横穿全屏
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

// 可见机器人尺寸：CSS 机器人 80×100；精灵模式下随帧尺寸变化
export interface RobotVisual { w: number; h: number }

export function usePetMovement(options: { isCopying: Ref<boolean>; robotVisual: Ref<RobotVisual> }) {
  const { isCopying, robotVisual } = options
  const settingsStore = useSettingsStore()

  const state = ref<PetState>('walk')
  const direction = ref<Direction>('left')
  const isDragging = ref(false)
  const showSleepZzz = ref(false)

  // 运动状态
  let windowX = 0
  let windowY = 0
  let workArea = { width: 1920, height: 1080 }
  let randomPauseCounter = 0
  let isPaused = false
  // 巡逻目标边：1 = 右缘，-1 = 左缘
  let targetEdge: 1 | -1 = -1

  // 定时器
  let moveTimer: number | null = null
  let sleepTimer: number | null = null

  // 拖拽状态
  let dragStartX = 0
  let dragStartY = 0
  let windowStartX = 0
  let windowStartY = 0

  // ============ 屏幕工作区 ============
  // Monitor.size() 是物理像素，setPosition 用逻辑坐标——必须按缩放系数转换，
  // 否则在 125%/150% 缩放的屏幕上会把桌宠算到屏幕外
  const updateWorkArea = async () => {
    try {
      const monitor = await currentMonitor()
      if (monitor) {
        const logical = monitor.size.toLogical(monitor.scaleFactor)
        workArea = { width: logical.width, height: logical.height }
      }
    } catch {/* ignore */}
  }

  // 机器人绘制于窗口底部中央：锚定数学以可见机器人为准，
  // 机器人水平可达 [8, 屏宽-8-机器人宽]，所在窗口允许相应移出屏幕（透明区）
  const robotOffX = () => (PET_W - robotVisual.value.w) / 2
  const groundY = () => workArea.height - PET_H - 8
  const bounds = () => ({
    left: 8 - robotOffX(),
    right: workArea.width - 8 - robotVisual.value.w - robotOffX()
  })

  // ============ 行走 ============
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
    const isAtEdge = windowX <= b.left + 2 || windowX >= b.right - 2

    // 1.5% 概率小跳
    if (!isPaused && Math.random() < 0.015) {
      const hopY = groundY() - getRandomInt(15, 40)
      try { await getCurrentWindow().setPosition(new LogicalPosition(Math.round(windowX), Math.round(hopY))) } catch {/* ignore */}
      setTimeout(landAfterHop, 180)
    }

    // 暂停倒计时（到边停顿 / 随机停步）
    if (isPaused) {
      randomPauseCounter--
      if (randomPauseCounter <= 0) {
        isPaused = false
        state.value = 'walk'
      }
      return
    }

    // 0.3% 概率中途改目标（巡逻为主，偶发折返）
    if (!isAtEdge && Math.random() < 0.003) {
      targetEdge = (targetEdge * -1) as 1 | -1
    }

    // 到达目标边：40% 长发呆（5–10s），否则短停（0.5–1.5s）后掉头
    if (isAtEdge) {
      targetEdge = windowX <= b.left + 2 ? 1 : -1
      isPaused = true
      state.value = 'idle'
      if (Math.random() < 0.4) {
        randomPauseCounter = getRandomInt(40, 80)
      } else {
        randomPauseCounter = getRandomInt(4, 12)
      }
      return
    }

    // 直奔目标边（速度语义不变：walkSpeed 0.1~1.0 → 1~6 像素/帧）
    const speed = 1 + Math.round(settingsStore.petConfig.walkSpeed * 5)
    const jitter = Math.floor(Math.abs(Math.sin(Date.now() / 3000)) * 2)
    const moveSpeed = speed + jitter
    let x = windowX + moveSpeed * targetEdge
    if (x <= b.left) { x = b.left }
    else if (x >= b.right) { x = b.right }

    windowX = x
    windowY = groundY()
    direction.value = targetEdge === 1 ? 'right' : 'left'

    try { await getCurrentWindow().setPosition(new LogicalPosition(Math.round(windowX), Math.round(windowY))) } catch {/* ignore */}
  }

  // ============ 拖拽移动（机器人锚钳制） ============
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

    // 限制在屏幕范围内（按机器人可见区域钳制）
    const b = bounds()
    const maxY = workArea.height - PET_H - 8
    const minY = 8 - (PET_H - robotVisual.value.h)
    windowX = Math.max(b.left, Math.min(windowX, b.right))
    windowY = Math.max(minY, Math.min(windowY, maxY))

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

  // 周期任务：工作区刷新（分辨率/缩放变化自适应）+ 睡眠检查
  const periodicCheck = async () => {
    const prevW = workArea.width
    const prevH = workArea.height
    await updateWorkArea()
    if (workArea.width !== prevW || workArea.height !== prevH) {
      // 工作区变化：重新钳制位置到合法范围
      const b = bounds()
      windowX = Math.max(b.left, Math.min(windowX, b.right))
      windowY = groundY()
      try { await getCurrentWindow().setPosition(new LogicalPosition(Math.round(windowX), Math.round(windowY))) } catch {/* ignore */}
    }
    checkSleep()
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

    // 尝试恢复上次位置（按机器人锚钳制）
    const pos = loadJson<{ x?: number; y?: number } | null>('promptpal_pet_position', null)
    if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
      windowX = Math.max(b.left, Math.min(pos.x, b.right))
      const maxY = workArea.height - PET_H - 8
      const minY = 8 - (PET_H - robotVisual.value.h)
      windowY = Math.max(minY, Math.min(pos.y, maxY))
    } else {
      windowX = b.right; windowY = groundY()
    }
    try { await getCurrentWindow().setPosition(new LogicalPosition(Math.round(windowX), Math.round(windowY))) } catch {/* ignore */}

    state.value = 'walk'
    moveTimer = window.setInterval(move, 120)
    sleepTimer = window.setInterval(periodicCheck, 10000)
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
