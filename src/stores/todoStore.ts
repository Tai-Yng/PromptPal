import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface TodoItem {
  id: string
  text: string
  done: boolean
  createdAt: number
  planId: string
  category: string
  source?: string
}

export interface TodoCategory {
  id: string
  name: string
  color: string
}

export interface StudyPlan {
  id: string
  name: string
  createdAt: number
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

const DEFAULT_PLAN_ID = '_default'

export const useTodoStore = defineStore('todo', () => {
  const items = ref<TodoItem[]>([])
  const categories = ref<TodoCategory[]>([...DEFAULT_CATEGORIES])
  const plans = ref<StudyPlan[]>([])
  const activePlanId = ref<string>(DEFAULT_PLAN_ID)

  // 计算
  const activePlan = computed(() => plans.value.find(p => p.id === activePlanId.value))
  const planItems = computed(() => items.value.filter(i => i.planId === activePlanId.value))
  const activeItems = computed(() => planItems.value.filter(i => !i.done))
  const doneItems = computed(() => planItems.value.filter(i => i.done))

  const getCategoryColor = (catId: string) =>
    categories.value.find(c => c.id === catId)?.color || '#6B7280'

  // Plan 管理
  const addPlan = (name: string) => {
    const id = crypto.randomUUID()
    plans.value.push({ id, name, createdAt: Date.now() })
    activePlanId.value = id
    save()
  }

  const deletePlan = (id: string) => {
    plans.value = plans.value.filter(p => p.id !== id)
    items.value = items.value.filter(i => i.planId !== id)
    if (activePlanId.value === id) {
      activePlanId.value = plans.value[0]?.id || DEFAULT_PLAN_ID
    }
    save()
  }

  const setActivePlan = (id: string) => {
    activePlanId.value = id
    save()
  }

  // Category 管理
  const addCategory = (name: string) => {
    const id = name.toLowerCase().replace(/\s+/g, '-')
    if (categories.value.find(c => c.id === id)) return
    const color = CAT_COLORS[categories.value.length % CAT_COLORS.length]
    categories.value.push({ id, name, color })
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

  // Todo 管理
  const addItem = (text: string, category = 'work', planId?: string) => {
    const pid = planId || activePlanId.value
    // 如果 plan 不存在，创建默认 plan
    if (pid !== DEFAULT_PLAN_ID && !plans.value.find(p => p.id === pid)) {
      plans.value.push({ id: pid, name: pid, createdAt: Date.now() })
    }
    items.value.unshift({
      id: crypto.randomUUID(),
      text,
      done: false,
      createdAt: Date.now(),
      planId: pid,
      category,
    })
    save()
  }

  const addItems = (texts: string[], category = 'work', planId?: string) => {
    const pid = planId || activePlanId.value
    for (let i = texts.length - 1; i >= 0; i--) {
      items.value.unshift({
        id: crypto.randomUUID(),
        text: texts[i],
        done: false,
        createdAt: Date.now(),
        planId: pid,
        category,
      })
    }
    save()
  }

  const toggleItem = (id: string) => {
    const item = items.value.find(i => i.id === id)
    if (item) { item.done = !item.done; save() }
  }

  const deleteItem = (id: string) => {
    items.value = items.value.filter(i => i.id !== id)
    save()
  }

  const clearDone = () => {
    const pid = activePlanId.value
    items.value = items.value.filter(i => i.planId !== pid || !i.done)
    save()
  }

  const save = () => {
    localStorage.setItem('promptpal_todos', JSON.stringify(items.value))
    localStorage.setItem('promptpal_todo_cats', JSON.stringify(categories.value))
    localStorage.setItem('promptpal_todo_plans', JSON.stringify(plans.value))
    localStorage.setItem('promptpal_todo_active_plan', activePlanId.value)
  }

  const load = () => {
    try {
      const saved = localStorage.getItem('promptpal_todos')
      if (saved) items.value = JSON.parse(saved)
    } catch {}
    try {
      const savedCats = localStorage.getItem('promptpal_todo_cats')
      if (savedCats) categories.value = JSON.parse(savedCats)
    } catch {}
    try {
      const savedPlans = localStorage.getItem('promptpal_todo_plans')
      if (savedPlans) plans.value = JSON.parse(savedPlans)
    } catch {}
    activePlanId.value = localStorage.getItem('promptpal_todo_active_plan') || DEFAULT_PLAN_ID
  }

  load()

  return {
    items, categories, plans, activePlanId, activePlan,
    planItems, activeItems, doneItems,
    getCategoryColor,
    addPlan, deletePlan, setActivePlan,
    addCategory, deleteCategory,
    addItem, addItems,
    toggleItem, deleteItem, clearDone
  }
})
