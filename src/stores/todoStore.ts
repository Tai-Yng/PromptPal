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

  const activeItems = computed(() => items.value.filter(i => !i.done))
  const doneItems = computed(() => items.value.filter(i => i.done))

  const getCategoryColor = (catId: string) => {
    return categories.value.find(c => c.id === catId)?.color || '#6B7280'
  }

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
    // 将该分类的 todo 移到 'work'
    for (const item of items.value) {
      if (item.category === id) item.category = 'work'
    }
    save()
  }

  const addItem = (text: string, category = 'work', source?: string) => {
    items.value.unshift({
      id: crypto.randomUUID(),
      text,
      done: false,
      createdAt: Date.now(),
      category,
      source
    })
    save()
  }

  const addItems = (texts: string[], category = 'work', source?: string) => {
    for (let i = texts.length - 1; i >= 0; i--) {
      items.value.unshift({
        id: crypto.randomUUID(),
        text: texts[i],
        done: false,
        createdAt: Date.now(),
        category,
        source
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
    items.value = items.value.filter(i => !i.done)
    save()
  }

  const save = () => {
    localStorage.setItem('promptpal_todos', JSON.stringify(items.value))
    localStorage.setItem('promptpal_todo_cats', JSON.stringify(categories.value))
  }

  const load = () => {
    const saved = localStorage.getItem('promptpal_todos')
    if (saved) { try { items.value = JSON.parse(saved) } catch {} }
    const savedCats = localStorage.getItem('promptpal_todo_cats')
    if (savedCats) { try { categories.value = JSON.parse(savedCats) } catch {} }
  }

  load()

  return {
    items, categories,
    activeItems, doneItems,
    getCategoryColor,
    addCategory, deleteCategory,
    addItem, addItems,
    toggleItem, deleteItem, clearDone
  }
})
