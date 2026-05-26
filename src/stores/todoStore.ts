import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface TodoItem {
  id: string
  text: string
  done: boolean
  createdAt: number
  category: string
  inPlan: boolean
  source?: string
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

  // 计算: 今日计划(从所有分类挑选的)
  const planItems = computed(() => items.value.filter(i => i.inPlan))
  const planActive = computed(() => planItems.value.filter(i => !i.done))
  const planDone = computed(() => planItems.value.filter(i => i.done))

  // 某个分类下的任务
  const itemsByCategory = (catId: string) => items.value.filter(i => i.category === catId)

  const getCategoryColor = (catId: string) =>
    categories.value.find(c => c.id === catId)?.color || '#6B7280'

  // Category
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

  // Todo
  const addItem = (text: string, category = 'work') => {
    items.value.unshift({
      id: crypto.randomUUID(), text, done: false,
      createdAt: Date.now(), category, inPlan: false
    })
    save()
  }

  const addItems = (texts: string[], category = 'work') => {
    for (let i = texts.length - 1; i >= 0; i--) {
      items.value.unshift({
        id: crypto.randomUUID(), text: texts[i], done: false,
        createdAt: Date.now(), category, inPlan: false
      })
    }
    save()
  }

  const toggleItem = (id: string) => {
    const item = items.value.find(i => i.id === id)
    if (item) { item.done = !item.done; save() }
  }

  const togglePlan = (id: string) => {
    const item = items.value.find(i => i.id === id)
    if (item) { item.inPlan = !item.inPlan; save() }
  }

  const deleteItem = (id: string) => {
    items.value = items.value.filter(i => i.id !== id)
    save()
  }

  const clearDone = () => {
    items.value = items.value.filter(i => !i.done)
    save()
  }

  const save = () => {
    localStorage.setItem('promptpal_todos', JSON.stringify(items.value))
    localStorage.setItem('promptpal_todo_cats', JSON.stringify(categories.value))
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
  }

  load()

  return {
    items, categories,
    planItems, planActive, planDone,
    getCategoryColor, itemsByCategory,
    addCategory, deleteCategory,
    addItem, addItems,
    toggleItem, togglePlan, deleteItem, clearDone
  }
})
