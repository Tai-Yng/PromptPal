import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface TodoItem {
  id: string
  text: string
  done: boolean
  createdAt: number
  category: string
  source?: string
}

// Plan 项是独立的副本，有自己的完成状态
export interface PlanItem {
  id: string
  text: string
  done: boolean
  createdAt: number
  category: string
  sourceId?: string
}

export interface TodoCategory {
  id: string
  name: string
  color: string
}

const DEFAULT_CATEGORIES: TodoCategory[] = [
  { id: 'work', name: 'Work', color: '#22D3EE' },
  { id: 'study', name: 'Study', color: '#A855F7' },
  { id: 'personal', name: 'Personal', color: '#F59E0B' },
]

const CAT_COLORS = [
  '#22D3EE', '#A855F7', '#F59E0B', '#34D399',
  '#F472B6', '#818CF8', '#FB923C', '#6B7280'
]

export const useTodoStore = defineStore('todo', () => {
  const items = ref<TodoItem[]>([])
  const categories = ref<TodoCategory[]>([...DEFAULT_CATEGORIES])
  const planItems = ref<PlanItem[]>([])

  // 专注模式状态
  const focusMode = ref(false)
  // 专注模式完成动画: 'complete' | 'celebrate' | null
  const focusAnim = ref<'complete' | 'celebrate' | null>(null)

  // 计算
  const planActive = computed(() => planItems.value.filter(i => !i.done))
  const planDone = computed(() => planItems.value.filter(i => i.done))

  // 当前专注任务：planActive 中的第一个（优先级最高）
  const currentFocusTask = computed(() => planActive.value[0] || null)

  const itemsByCategory = (catId: string) => items.value.filter(i => i.category === catId && !i.done)

  const getCategoryColor = (catId: string) =>
    categories.value.find(c => c.id === catId)?.color || '#6B7280'

  // ===== Category =====
  const addCategory = (name: string) => {
    const id = name.toLowerCase().replace(/\s+/g, '-')
    if (categories.value.find(c => c.id === id)) return
    categories.value.push({ id, name, color: CAT_COLORS[categories.value.length % CAT_COLORS.length] })
    save()
  }

  const deleteCategory = (id: string) => {
    if (['work', 'study', 'personal'].includes(id)) return
    categories.value = categories.value.filter(c => c.id !== id)
    for (const item of items.value) {
      if (item.category === id) item.category = 'work'
    }
    save()
  }

  // ===== Todo =====
  const addItem = (text: string, category = 'work') => {
    items.value.unshift({
      id: crypto.randomUUID(), text, done: false,
      createdAt: Date.now(), category
    })
    save()
  }

  const addItems = (texts: string[], category = 'work') => {
    for (let i = texts.length - 1; i >= 0; i--) {
      items.value.unshift({
        id: crypto.randomUUID(), text: texts[i], done: false,
        createdAt: Date.now(), category
      })
    }
    save()
  }

  const deleteItem = (id: string) => {
    items.value = items.value.filter(i => i.id !== id)
    save()
  }

  // ===== Plan 操作 =====
  const addToPlan = (todoId: string) => {
    const todo = items.value.find(i => i.id === todoId)
    if (!todo) return
    if (planItems.value.some(p => p.sourceId === todoId)) return
    planItems.value.unshift({
      id: crypto.randomUUID(),
      text: todo.text,
      done: false,
      createdAt: Date.now(),
      category: todo.category,
      sourceId: todoId
    })
    save()
  }

  const removeFromPlan = (planId: string) => {
    planItems.value = planItems.value.filter(i => i.id !== planId)
    save()
  }

  const togglePlanItem = (planId: string) => {
    const item = planItems.value.find(i => i.id === planId)
    if (item) { item.done = !item.done; save() }
  }

  const clearPlanDone = () => {
    planItems.value = planItems.value.filter(i => !i.done)
    save()
  }

  const addDirectToPlan = (text: string, category = 'work') => {
    planItems.value.unshift({
      id: crypto.randomUUID(),
      text, done: false,
      createdAt: Date.now(), category
    })
    save()
  }

  const isInPlan = (todoId: string) => {
    return planItems.value.some(p => p.sourceId === todoId)
  }

  // ===== 拖拽排序（基于ID，解决active/done列表索引不对齐问题）=====
  const reorderPlan = (fromId: string, toId: string) => {
    const list = [...planItems.value]
    const fromIdx = list.findIndex(i => i.id === fromId)
    const toIdx = list.findIndex(i => i.id === toId)
    if (fromIdx === -1 || toIdx === -1) return
    const [moved] = list.splice(fromIdx, 1)
    list.splice(toIdx, 0, moved)
    planItems.value = list
    save()
  }

  // ===== 专注模式 =====
  const startFocus = () => {
    // 检查是否有未完成的任务
    const hasActive = planItems.value.some(i => !i.done)
    if (!hasActive) return
    focusMode.value = true
    save()
  }

  const stopFocus = () => {
    focusMode.value = false
    focusAnim.value = null
    save()
  }

  // 完成当前专注任务
  const completeFocusTask = () => {
    const task = currentFocusTask.value
    if (!task) return
    task.done = true
    save()

    // 判断是否全部完成
    if (planActive.value.length === 0) {
      focusAnim.value = 'celebrate'
      setTimeout(() => {
        focusAnim.value = null
        focusMode.value = false
        save()
      }, 3000)
    } else {
      focusAnim.value = 'complete'
      setTimeout(() => { focusAnim.value = null }, 1500)
    }
  }

  const save = () => {
    localStorage.setItem('promptpal_todos', JSON.stringify(items.value))
    localStorage.setItem('promptpal_todo_cats', JSON.stringify(categories.value))
    localStorage.setItem('promptpal_plan_items', JSON.stringify(planItems.value))
    localStorage.setItem('promptpal_focus_mode', JSON.stringify(focusMode.value))
    localStorage.setItem('promptpal_focus_anim', JSON.stringify(focusAnim.value))
  }

  const load = () => {
    try {
      const s = localStorage.getItem('promptpal_todos')
      if (s) items.value = JSON.parse(s)
    } catch {}
    try {
      const s = localStorage.getItem('promptpal_todo_cats')
      if (s) categories.value = JSON.parse(s)
    } catch {}
    try {
      const s = localStorage.getItem('promptpal_plan_items')
      if (s) planItems.value = JSON.parse(s)
    } catch {}
    try {
      const s = localStorage.getItem('promptpal_focus_mode')
      if (s) focusMode.value = JSON.parse(s)
    } catch {}
    try {
      const s = localStorage.getItem('promptpal_focus_anim')
      if (s) focusAnim.value = JSON.parse(s) as 'complete' | 'celebrate' | null
    } catch {}
  }

  load()

  // ===== 跨窗口同步 =====
  // Panel 和 Pet 在不同 Tauri 窗口，Pinia store 不共享。
  // 监听 storage 事件，当另一个窗口写入 localStorage 时自动重载。
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key && e.key.startsWith('promptpal_')) {
        // 只重载 focus 和 plan 数据（其他数据 pet 窗口用不上）
        if (e.key === 'promptpal_focus_mode') {
          try {
            const s = localStorage.getItem('promptpal_focus_mode')
            if (s !== null) focusMode.value = JSON.parse(s)
          } catch {}
        }
        if (e.key === 'promptpal_focus_anim') {
          try {
            const s = localStorage.getItem('promptpal_focus_anim')
            if (s !== null) focusAnim.value = JSON.parse(s) as 'complete' | 'celebrate' | null
          } catch {}
        }
        if (e.key === 'promptpal_plan_items') {
          try {
            const s = localStorage.getItem('promptpal_plan_items')
            if (s !== null) planItems.value = JSON.parse(s)
          } catch {}
        }
      }
    })
  }

  return {
    items, categories, planItems,
    planActive, planDone,
    currentFocusTask, focusMode, focusAnim,
    getCategoryColor, itemsByCategory,
    addCategory, deleteCategory,
    addItem, addItems, deleteItem,
    addToPlan, removeFromPlan, togglePlanItem, clearPlanDone, addDirectToPlan,
    isInPlan, reorderPlan,
    startFocus, stopFocus, completeFocusTask
  }
})
