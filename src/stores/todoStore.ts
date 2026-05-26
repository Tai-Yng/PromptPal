import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface TodoItem {
  id: string
  text: string
  done: boolean
  createdAt: number
  source?: string
}

export const useTodoStore = defineStore('todo', () => {
  const items = ref<TodoItem[]>([])

  const activeItems = computed(() => items.value.filter(i => !i.done))
  const doneItems = computed(() => items.value.filter(i => i.done))

  const addItem = (text: string, source?: string) => {
    items.value.unshift({
      id: crypto.randomUUID(),
      text,
      done: false,
      createdAt: Date.now(),
      source
    })
    save()
  }

  const addItems = (texts: string[], source?: string) => {
    for (let i = texts.length - 1; i >= 0; i--) {
      items.value.unshift({
        id: crypto.randomUUID(),
        text: texts[i],
        done: false,
        createdAt: Date.now(),
        source
      })
    }
    save()
  }

  const toggleItem = (id: string) => {
    const item = items.value.find(i => i.id === id)
    if (item) {
      item.done = !item.done
      save()
    }
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
  }

  const load = () => {
    const saved = localStorage.getItem('promptpal_todos')
    if (saved) {
      try { items.value = JSON.parse(saved) } catch {}
    }
  }

  load()

  return {
    items,
    activeItems,
    doneItems,
    addItem,
    addItems,
    toggleItem,
    deleteItem,
    clearDone
  }
})
