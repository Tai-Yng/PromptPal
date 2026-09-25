// 专注模式跨窗口同步：Panel 与 Pet 是不同 Tauri 窗口，Pinia store 不共享，
// 通过轮询 localStorage 保持 pet 端的专注状态最新。
// 从 DesktopPet.vue 机械搬移，行为保持不变
import { useTodoStore } from '../stores/todoStore'
import { loadJson, saveJson } from '../services/storage'
import type { PlanItem } from '../stores/todoStore'

export function useFocusSync() {
  const todoStore = useTodoStore()

  // Polling 同步：仅在 focusMode 激活时运行，节省 CPU
  let syncTimer: number | null = null
  const startSyncPolling = () => {
    if (syncTimer) return
    syncTimer = window.setInterval(syncTodoStore, 1000)
  }
  const stopSyncPolling = () => {
    if (syncTimer) { clearInterval(syncTimer); syncTimer = null }
  }

  const syncTodoStore = () => {
    const prevFocusMode = todoStore.focusMode
    const prevActiveCount = todoStore.planActive.length

    todoStore.focusMode = loadJson('promptpal_focus_mode', todoStore.focusMode)
    todoStore.planItems = loadJson('promptpal_plan_items', todoStore.planItems)
    todoStore.focusAnim = loadJson('promptpal_focus_anim', todoStore.focusAnim)

    // Panel checkbox 完成最后任务时 pet 自动触发 celebrate
    if (prevFocusMode && prevActiveCount > 0 && todoStore.planActive.length === 0) {
      todoStore.focusAnim = 'celebrate'
      saveJson('promptpal_focus_anim', 'celebrate')
      setTimeout(() => {
        todoStore.focusAnim = null
        todoStore.focusMode = false
        saveJson('promptpal_focus_anim', null)
        saveJson('promptpal_focus_mode', false)
      }, 3000)
    }

    // 动态启停 polling
    if (todoStore.focusMode) {
      startSyncPolling()
    } else {
      stopSyncPolling()
    }
  }

  // 完成当前任务（直接操作 localStorage，避免跨窗口 store 竞争）
  const completeFocusTask = () => {
    const items = loadJson<PlanItem[]>('promptpal_plan_items', [])
    const target = items.find(i => !i.done)
    if (target) {
      target.done = true
      saveJson('promptpal_plan_items', items)

      const remainingActive = items.filter(i => !i.done)
      if (remainingActive.length === 0) {
        saveJson('promptpal_focus_mode', false)
        saveJson('promptpal_focus_anim', 'celebrate')
        setTimeout(() => {
          saveJson('promptpal_focus_anim', null)
        }, 3000)
      } else {
        saveJson('promptpal_focus_anim', 'complete')
        setTimeout(() => {
          saveJson('promptpal_focus_anim', null)
        }, 1500)
      }
    }

    // 立即同步本地 store 以触发 UI 更新
    syncTodoStore()
  }

  const cleanup = () => {
    stopSyncPolling()
  }

  return {
    syncTodoStore, completeFocusTask, cleanup
  }
}
