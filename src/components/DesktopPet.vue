<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { invoke, convertFileSrc } from '@tauri-apps/api/core'
import { getCurrentWindow, cursorPosition } from '@tauri-apps/api/window'
import { usePromptStore } from '../stores/promptStore'
import { useSettingsStore } from '../stores/settingsStore'
import { usePetStyleStore } from '../stores/petStyleStore'
import { useTodoStore } from '../stores/todoStore'
import { usePetMovement } from '../composables/usePetMovement'
import { useContextSuggest } from '../composables/useContextSuggest'
import { useFocusSync } from '../composables/useFocusSync'
import { exitApp } from '../services/autoSync'
import { isTauri } from '../services/platform'
import { loadJson, loadString } from '../services/storage'

const petStore = usePetStyleStore()
const settingsStore = useSettingsStore()
const todoStore = useTodoStore()

// ============ 运动状态机（行走/拖拽/睡眠） ============
const isCopying = ref(false)
const showCopySuccess = ref(false)
// 可见机器人尺寸：精灵模式跟随帧尺寸，CSS 机器人 80×100
const robotVisual = computed(() =>
  spriteMode.value ? { w: frameW.value, h: frameH.value } : { w: 80, h: 100 }
)
const movement = usePetMovement({ isCopying, robotVisual })
const { state, direction, isDragging, showSleepZzz, wakeUp, handleMouseDown } = movement

// ============ 精灵渲染（v1.4 自定义造型） ============
// 精灵模式与 CSS 机器人互斥；图片缺失/加载失败自动回落 CSS 渲染
// 双通道：Tauri 优先 asset 协议（convertFileSrc），失败粘住回落 dataURL（load_pet_sprite 兜底）
const spriteFailed = ref(false)
const assetFailed = ref(false)
const memoryDataUrl = ref('')
const spriteUrl = computed(() => {
  if (petStore.spritePath && !assetFailed.value) return convertFileSrc(petStore.spritePath)
  return petStore.currentStyle.spriteSheet || memoryDataUrl.value || ''
})
const spriteMode = computed(() =>
  petStore.useCustomSprite && !!spriteUrl.value && !spriteFailed.value
)

// 加载文件版精灵为 dataURL（asset 协议不可用时的渲染兜底）
const loadMemorySprite = async () => {
  if (!isTauri() || !petStore.spritePath) return
  try {
    const b64 = await invoke<string>('load_pet_sprite')
    if (b64) memoryDataUrl.value = `data:image/png;base64,${b64}`
  } catch {/* ignore */}
}
watch(() => petStore.spritePath, () => { void loadMemorySprite() }, { immediate: true })
const frameW = computed(() => Math.max(1, petStore.currentStyle.spriteFrameWidth || 80))
const frameH = computed(() => Math.max(1, petStore.currentStyle.spriteFrameHeight || 100))
const totalFrames = computed(() => Math.max(1, petStore.currentStyle.spriteFrames || 1))

// 取当前状态的播放序列：frames 列表优先，否则 start..start+count-1 区间；
// 越界钳制；未配置状态回退 walk；全未配置则第 1 帧静止
function rangeFor(s: string): number[] {
  const fm = petStore.frameMap
  const key = s === 'sleeping' ? 'sleep' : s === 'idle' ? 'idle' : 'walk'
  const r = (fm[key as 'walk'] || fm['walk']) as { start?: number; count?: number; frames?: number[] } | undefined
  const total = totalFrames.value
  const clamp = (n: number) => Math.min(Math.max(1, Math.floor(n)), total)
  if (r && Array.isArray(r.frames) && r.frames.length > 0) {
    const seq = r.frames.map(n => clamp(n))
    // 单帧重复列表视为该帧静止播放（保留时长语义）
    return seq
  }
  if (!r || !Number.isFinite(r.start) || !Number.isFinite(r.count)) {
    return [1]
  }
  const start = clamp(r.start)
  const count = Math.min(Math.max(1, Math.floor(r.count)), total - start + 1)
  return Array.from({ length: count }, (_, i) => start + i)
}

const currentFrame = ref(1)
let spriteTimer: number | null = null

// 按序列索引推进（支持 [1,2,1,3] 式重复引用）
let seqIndex = 0
const spriteTick = () => {
  const seq = rangeFor(state.value)
  seqIndex = seqIndex + 1 >= seq.length ? 0 : seqIndex + 1
  currentFrame.value = seq[seqIndex]
}

const stopSpriteTimer = () => {
  if (spriteTimer) { clearInterval(spriteTimer); spriteTimer = null }
}
const startSpriteTimer = () => {
  stopSpriteTimer()
  if (!spriteMode.value) return
  currentFrame.value = rangeFor(state.value)[0]
  spriteTimer = window.setInterval(spriteTick, 1000 / petStore.frameRate)
}

watch(spriteMode, (on) => { on ? startSpriteTimer() : stopSpriteTimer() })
watch(() => petStore.frameRate, () => { if (spriteMode.value) startSpriteTimer() })
watch(state, () => { if (spriteMode.value) currentFrame.value = rangeFor(state.value)[0] })

// 图片可加载性探测：asset 通道失败则粘住切 dataURL；dataURL 也失败回落 CSS 渲染
watch(spriteUrl, (url) => {
  if (!spriteMode.value) return
  spriteFailed.value = false
  const img = new Image()
  img.onerror = () => {
    if (petStore.spritePath && !assetFailed.value) assetFailed.value = true
    else spriteFailed.value = true
  }
  img.src = url
}, { immediate: true })

const spriteStyle = computed(() => ({
  width: `${frameW.value}px`,
  height: `${frameH.value}px`,
  backgroundImage: `url("${spriteUrl.value}")`,
  backgroundRepeat: 'no-repeat' as const,
  backgroundPosition: `-${(currentFrame.value - 1) * frameW.value}px 0`
}))

// 精灵模式下容器尺寸跟随帧尺寸（保持底部贴地）
const containerStyle = computed(() =>
  spriteMode.value ? { width: `${frameW.value}px`, height: `${frameH.value}px` } : {}
)

// ============ 专注模式 ============
const isHovering = ref(false)

// 是否显示专注气泡：悬浮 + 专注模式开启 + 有当前任务
const showFocusBubble = computed(() => {
  return isHovering.value && todoStore.focusMode && todoStore.currentFocusTask
})

// 完成动画状态
const focusBubbleState = computed(() => todoStore.focusAnim)

// 专注模式 CSS class
const focusClass = computed(() => ({
  celebrating: todoStore.focusAnim === 'celebrate',
  taskComplete: todoStore.focusAnim === 'complete'
}))

// 悬浮气泡延迟隐藏：鼠标离开后等 500ms 再消失，防止误触发
let hoverLeaveTimer: number | null = null

const handleMouseEnter = () => {
  isHovering.value = true
  if (hoverLeaveTimer) { clearTimeout(hoverLeaveTimer); hoverLeaveTimer = null }
  focusSync.syncTodoStore()  // 鼠标进入立即同步，确保气泡数据最新
  wakeUp()
}
const handleMouseLeave = () => {
  hoverLeaveTimer = window.setTimeout(() => {
    isHovering.value = false
    hoverLeaveTimer = null
  }, 500)
}

// ============ 智能气泡 ============
const suggest = useContextSuggest({ state, isDragging })
const { showSuggestBubble, suggestPromptTitle, suggestCopyAndDismiss, dismissSuggest } = suggest

// ============ 专注同步 ============
const focusSync = useFocusSync()
const { completeFocusTask } = focusSync

// ============ 单击复制提示词 ============
const handleClick = async () => {
  // 如果正在拖拽，不触发点击
  if (isDragging.value) return

  const store = usePromptStore()
  if (!settingsStore.petConfig.dblClickCopy) return
  if (isCopying.value) return
  isCopying.value = true

  // 跨窗口数据刷新（Panel 窗口可能刚改过数据）
  store.prompts = loadJson('promptpal_prompts', store.prompts)
  const savedDefaultId = loadString('promptpal_default_prompt_id')
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
const showContextMenu = ref(false)

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
  exitApp().catch(() => {})
}

// ============ 生命周期 ============
// ============ 动态鼠标穿透 ============
// 透明窗口会拦截 340x380 全矩形的点击；仅鼠标悬停机器人本体时接收事件，
// 其余时间整窗穿透（气泡/菜单/拖拽期间强制交互）
let cursorTimer: number | null = null
let ignoreState: boolean | null = null
const applyIgnore = async (v: boolean) => {
  if (ignoreState === v) return
  ignoreState = v
  try { await getCurrentWindow().setIgnoreCursorEvents(v) } catch {/* ignore */}
}
const updateCursorPass = async () => {
  try {
    const win = getCurrentWindow()
    // 气泡/右键菜单/拖拽/复制提示可见 → 必须可交互
    const interactive = isDragging.value || showSuggestBubble.value
      || showFocusBubble.value || showContextMenu.value || showCopySuccess.value
      || todoStore.focusAnim !== null
    if (interactive) { await applyIgnore(false); return }
    const pos = await cursorPosition()  // 物理像素（全局）
    const sf = movement.scaleFactor.value || 1
    const over = movement.cursorOverRobot(pos.x / sf, pos.y / sf)
    await applyIgnore(!over)
  } catch {/* ignore */}
}

onMounted(async () => {
  await movement.init()
  if (isTauri()) {
    await applyIgnore(true)  // 启动默认穿透，由轮询接管
    cursorTimer = window.setInterval(updateCursorPass, 120)
  }
  suggest.init()
  focusSync.syncTodoStore()  // 初始化同步，focusMode=on 时自动启动 polling
  if (spriteMode.value) startSpriteTimer()
})

onUnmounted(() => {
  if (cursorTimer) clearInterval(cursorTimer)
  movement.cleanup()
  suggest.cleanup()
  focusSync.cleanup()
  stopSpriteTimer()
  if (hoverLeaveTimer) clearTimeout(hoverLeaveTimer)
})
</script>

<template>
  <div class="pet-window" :style="petStore.cssVariables">
    <div
      class="pet-container"
      :class="[direction, state, { copying: isCopying, dragging: isDragging }, focusClass]"
      :style="containerStyle"
      @mousedown="handleMouseDown"
      @click="handleClick"
      @dblclick="handleDblClick"
      @contextmenu="handleContextMenu"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
    >
      <!-- 桌宠形象：精灵图模式 / CSS 机器人 -->
      <div v-if="!spriteMode" class="pet-body">
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
      <div v-else class="pet-sprite" :style="spriteStyle"></div>

      <div v-if="showCopySuccess" class="copy-tip">已复制!</div>
      <div v-if="showSleepZzz" class="zzz"><span>Z</span><span>z</span><span>z</span></div>
      <div v-if="todoStore.focusMode && todoStore.planActive.length > 0" class="focus-indicator" title="focus mode active">
        <span class="focus-dot">●</span>
      </div>
    </div>

    <!-- 智能气泡建议 -->
    <Transition name="bubble">
      <div v-if="showSuggestBubble" class="suggest-bubble" @click.stop="suggestCopyAndDismiss">
        <span class="bubble-tip">Try this?</span>
        <span class="bubble-title">&gt; {{ suggestPromptTitle }}</span>
        <span class="bubble-close" @click.stop="dismissSuggest">x</span>
      </div>
    </Transition>

    <!-- 专注模式任务气泡 -->
    <Transition name="bubble">
      <div v-if="showFocusBubble && focusBubbleState === null" class="focus-bubble" @click.stop="completeFocusTask">
        <div class="focus-bubble-header">
          <span class="focus-label">NOW</span>
          <span class="focus-hint">click to done</span>
        </div>
        <div class="focus-task-text">{{ todoStore.currentFocusTask?.text }}</div>
        <div class="focus-progress">{{ todoStore.planDone.length }} / {{ todoStore.planItems.length }}</div>
      </div>
    </Transition>

    <!-- 完成动画气泡 -->
    <Transition name="bubble">
      <div v-if="showFocusBubble && focusBubbleState === 'complete'" class="focus-bubble complete-anim">
        <div class="complete-text">✓ Done!</div>
      </div>
    </Transition>

    <!-- 庆祝动画气泡（不依赖 showFocusBubble，因为全完成时 currentFocusTask 为 null） -->
    <Transition name="bubble">
      <div v-if="focusBubbleState === 'celebrate'" class="focus-bubble celebrate-anim">
        <div class="celebrate-text">🎉 ALL DONE!</div>
        <div class="celebrate-sub">Great job!</div>
      </div>
    </Transition>

    <div v-if="showContextMenu" class="context-menu" @click.stop>
      <div class="menu-item" @click="openPanel">Show Panel</div>
      <div class="menu-item" @click="quitApp" style="color: #FCA5A5">Exit</div>
    </div>
  </div>
</template>

<style scoped src="./pet.css"></style>
