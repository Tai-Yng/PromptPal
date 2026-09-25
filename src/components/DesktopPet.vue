<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { usePromptStore } from '../stores/promptStore'
import { useSettingsStore } from '../stores/settingsStore'
import { usePetStyleStore } from '../stores/petStyleStore'
import { useTodoStore } from '../stores/todoStore'
import { usePetMovement } from '../composables/usePetMovement'
import { useContextSuggest } from '../composables/useContextSuggest'
import { useFocusSync } from '../composables/useFocusSync'
import { loadJson, loadString } from '../services/storage'

const petStore = usePetStyleStore()
const settingsStore = useSettingsStore()
const todoStore = useTodoStore()

// ============ 运动状态机（行走/拖拽/睡眠） ============
const isCopying = ref(false)
const showCopySuccess = ref(false)
const movement = usePetMovement({ isCopying })
const { state, direction, isDragging, showSleepZzz, wakeUp, handleMouseDown } = movement

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
  invoke('exit_app').catch(() => {})
}

// ============ 生命周期 ============
onMounted(async () => {
  await movement.init()
  suggest.init()
  focusSync.syncTodoStore()  // 初始化同步，focusMode=on 时自动启动 polling
})

onUnmounted(() => {
  movement.cleanup()
  suggest.cleanup()
  focusSync.cleanup()
  if (hoverLeaveTimer) clearTimeout(hoverLeaveTimer)
})
</script>

<template>
  <div class="pet-window" :style="petStore.cssVariables">
    <div
      class="pet-container"
      :class="[direction, state, { copying: isCopying, dragging: isDragging }, focusClass]"
      @mousedown="handleMouseDown"
      @click="handleClick"
      @dblclick="handleDblClick"
      @contextmenu="handleContextMenu"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
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
