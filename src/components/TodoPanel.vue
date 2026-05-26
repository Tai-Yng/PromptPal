<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTodoStore } from '../stores/todoStore'
import { useSettingsStore } from '../stores/settingsStore'

const todoStore = useTodoStore()
const settingsStore = useSettingsStore()

const newTaskText = ref('')
const selectedCategory = ref('all')
const activeCat = ref('work')

const isGenerating = ref(false)
const showAiInput = ref(false)
const aiPrompt = ref('')
const selectedAiCats = ref<string[]>(['work', 'study', 'personal'])

// 新建分类
const showAddCat = ref(false)
const newCatName = ref('')

const filteredItems = computed(() => {
  if (selectedCategory.value === 'all') return todoStore.items
  return todoStore.items.filter(i => i.category === selectedCategory.value)
})

const filteredActive = computed(() => filteredItems.value.filter(i => !i.done))
const filteredDone = computed(() => filteredItems.value.filter(i => i.done))

const addTask = () => {
  const text = newTaskText.value.trim()
  if (!text) return
  todoStore.addItem(text, activeCat.value)
  newTaskText.value = ''
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') addTask()
}

const clearAllDone = () => {
  if (filteredDone.value.length === 0) return
  todoStore.clearDone()
}

const addNewCategory = () => {
  const name = newCatName.value.trim()
  if (!name) return
  todoStore.addCategory(name)
  newCatName.value = ''
  showAddCat.value = false
}

const generateTodos = async () => {
  const prompt = aiPrompt.value.trim()
  if (!prompt || !settingsStore.aiConfig.apiKey) return

  isGenerating.value = true

  try {
    const catLabels = selectedAiCats.value
      .map(id => todoStore.categories.find(c => c.id === id))
      .filter(Boolean)
      .map(c => c!.name)
      .join(', ')

    const systemPrompt = `You are a task planning assistant. Break the user's goal into 3-7 actionable todo items. Assign each item to one of these categories: ${catLabels}. Output ONLY the items, one per line, in format: "category_id: task text". No numbering, no bullets, no extra text. Category ids: ${selectedAiCats.value.join(', ')}.`

    const response = await fetch(settingsStore.aiConfig.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settingsStore.aiConfig.apiKey}`
      },
      body: JSON.stringify({
        model: settingsStore.aiConfig.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        stream: false,
        max_tokens: 600
      })
    })

    if (!response.ok) {
      const err = await response.text()
      alert(`[ERR] ${err.slice(0, 100)}`)
      return
    }

    const data = await response.json()
    const raw = data.choices?.[0]?.message?.content || ''

    // 解析 "category: text" 格式
    const lines = raw.split('\n').map((l: string) => l.trim()).filter((l: string) => l)
    for (const line of lines) {
      const colonIdx = line.indexOf(':')
      if (colonIdx < 0) continue
      const catId = line.slice(0, colonIdx).trim().toLowerCase()
      const text = line.slice(colonIdx + 1).trim()
      if (!text || !todoStore.categories.find(c => c.id === catId)) continue
      todoStore.addItem(text, catId, `AI: ${aiPrompt.value}`)
    }

    aiPrompt.value = ''
    showAiInput.value = false
  } catch (err: any) {
    alert(`[ERR] ${err.message}`)
  } finally {
    isGenerating.value = false
  }
}
</script>

<template>
  <div class="todo-panel">
    <!-- Category Tabs -->
    <div class="cat-tabs">
      <button
        v-for="cat in todoStore.categories"
        :key="cat.id"
        class="cat-tab"
        :class="{ active: selectedCategory === cat.id }"
        :style="{ '--cat-color': cat.color }"
        @click="selectedCategory = selectedCategory === cat.id ? 'all' : cat.id"
        :title="`filter: ${cat.name}`"
      >{{ cat.name }}</button>
      <button
        class="cat-tab all"
        :class="{ active: selectedCategory === 'all' }"
        @click="selectedCategory = 'all'"
        title="show all"
      >all</button>

      <!-- Add category -->
      <div class="add-cat-wrap">
        <button v-if="!showAddCat" class="cat-tab add" @click="showAddCat = true" title="add category">+</button>
        <div v-else class="add-cat-form">
          <input
            v-model="newCatName"
            class="cat-name-input"
            placeholder="cat name"
            @keydown.enter="addNewCategory"
            @keydown.escape="showAddCat = false"
          />
          <button class="cat-ok" @click="addNewCategory">ok</button>
          <button class="cat-cancel" @click="showAddCat = false">x</button>
        </div>
      </div>
    </div>

    <!-- Input row -->
    <div class="input-section">
      <div class="todo-input-row">
        <span class="prompt-sym">&gt;</span>
        <input
          v-model="newTaskText"
          class="todo-input"
          placeholder="add task..."
          @keydown="handleKeydown"
          :disabled="isGenerating"
        />
        <!-- Category selector -->
        <select v-model="activeCat" class="cat-select" title="task category">
          <option v-for="c in todoStore.categories" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <button class="add-btn" @click="addTask" :disabled="isGenerating">+</button>
      </div>
    </div>

    <!-- AI toggle -->
    <div class="ai-toggle-row">
      <button class="ai-toggle-btn" @click="showAiInput = !showAiInput">
        <span class="ai-sym">{{ showAiInput ? '-' : '+' }}</span>
        generate with AI
      </button>
    </div>

    <!-- AI section -->
    <div v-if="showAiInput" class="ai-section">
      <div class="ai-cat-chips">
        <span class="ai-cat-label">classify into:</span>
        <label
          v-for="c in todoStore.categories"
          :key="c.id"
          class="ai-cat-chip"
          :style="{ '--cc': c.color }"
          :class="{ checked: selectedAiCats.includes(c.id) }"
        >
          <input type="checkbox" v-model="selectedAiCats" :value="c.id" />
          {{ c.name }}
        </label>
      </div>
      <div class="todo-input-row ai-row">
        <span class="prompt-sym dim">&gt;</span>
        <input
          v-model="aiPrompt"
          class="todo-input"
          placeholder="e.g. 本周: 复习数学, 写代码, 购物"
          @keydown.enter="generateTodos"
          :disabled="isGenerating"
        />
        <button
          class="add-btn gen"
          @click="generateTodos"
          :disabled="isGenerating || !aiPrompt.trim()"
        >{{ isGenerating ? '...' : 'go' }}</button>
      </div>
    </div>

    <div class="divider"></div>

    <!-- List -->
    <div class="todo-list">
      <div
        v-for="item in filteredActive"
        :key="item.id"
        class="todo-item"
      >
        <span
          class="cat-dot"
          :style="{ background: todoStore.getCategoryColor(item.category) }"
          :title="item.category"
        ></span>
        <button class="check-btn" title="done" @click="todoStore.toggleItem(item.id)">☐</button>
        <span class="todo-text" @click="todoStore.toggleItem(item.id)">
          {{ item.text }}
          <span v-if="item.source" class="todo-source">{{ item.source }}</span>
        </span>
        <button class="del-btn" title="delete" @click="todoStore.deleteItem(item.id)">×</button>
      </div>

      <template v-if="filteredDone.length > 0">
        <div class="done-header">
          <span class="done-dash">── done ──</span>
          <button class="clear-done-btn" @click="clearAllDone">clear all</button>
        </div>
        <div v-for="item in filteredDone" :key="item.id" class="todo-item done">
          <span
            class="cat-dot"
            :style="{ background: todoStore.getCategoryColor(item.category) }"
          ></span>
          <button class="check-btn done" title="undo" @click="todoStore.toggleItem(item.id)">☑</button>
          <span class="todo-text" @click="todoStore.toggleItem(item.id)">
            {{ item.text }}
          </span>
          <button class="del-btn" title="delete" @click="todoStore.deleteItem(item.id)">×</button>
        </div>
      </template>

      <div v-if="filteredItems.length === 0" class="empty-hint">
        <span class="hint-sym">&gt;</span> nothing here.
      </div>
    </div>
  </div>
</template>

<style scoped>
.todo-panel {
  padding: 18px 24px;
  height: 100%;
  display: flex;
  flex-direction: column;
  font-family: var(--font-mono);
  color: var(--text-primary);
  overflow-y: auto;
}

/* ── Category Tabs ── */
.cat-tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 14px;
  align-items: center;
}
.cat-tab {
  padding: 5px 12px;
  border: 1px solid var(--border-color);
  background: transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-normal);
  white-space: nowrap;
}
.cat-tab:hover { border-color: var(--primary); color: var(--text-primary); }
.cat-tab.active {
  border-color: var(--cat-color, var(--primary));
  color: var(--cat-color, var(--primary));
  background: rgba(99, 102, 241, 0.08);
}
.cat-tab.all { color: var(--text-muted); font-style: italic; }
.cat-tab.add {
  padding: 5px 8px;
  color: var(--text-muted);
  border-style: dashed;
}
.add-cat-wrap { display: flex; align-items: center; }
.add-cat-form {
  display: flex; align-items: center; gap: 4px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 2px 6px;
}
.cat-name-input {
  width: 70px; background: transparent; border: none;
  color: var(--text-primary); font-family: var(--font-mono); font-size: 11px; outline: none;
}
.cat-ok, .cat-cancel {
  background: none; border: none; font-family: var(--font-mono);
  font-size: 10px; cursor: pointer;
}
.cat-ok { color: var(--primary); }
.cat-cancel { color: var(--text-muted); }

/* ── Input ── */
.input-section { margin-bottom: 4px; }
.todo-input-row {
  display: flex; align-items: center; gap: 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 6px 10px;
  transition: border-color var(--transition-normal);
}
.todo-input-row:focus-within { border-color: var(--primary); }
.prompt-sym { color: var(--primary); font-weight: 700; font-size: 14px; }
.prompt-sym.dim { color: var(--text-muted); }
.todo-input {
  flex: 1; background: transparent; border: none;
  color: var(--text-primary); font-family: var(--font-mono); font-size: 13px; outline: none;
}
.todo-input::placeholder { color: var(--text-muted); }
.todo-input:disabled { opacity: 0.4; }
.cat-select {
  background: transparent; border: 1px solid var(--border-color);
  color: var(--text-muted); font-family: var(--font-mono); font-size: 11px;
  border-radius: var(--radius-sm); padding: 3px 6px; cursor: pointer; outline: none;
}
.cat-select:focus { border-color: var(--primary); }
.add-btn {
  width: 28px; height: 28px;
  border: 1px solid var(--border-color); background: transparent;
  color: var(--primary); border-radius: var(--radius-sm);
  font-family: var(--font-mono); font-size: 16px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all var(--transition-normal);
}
.add-btn:hover { border-color: var(--primary); background: rgba(99, 102, 241, 0.1); }
.add-btn.gen { width: 36px; font-size: 11px; }
.add-btn:disabled { opacity: 0.3; cursor: default; }

/* ── AI ── */
.ai-toggle-row { margin-bottom: 8px; }
.ai-toggle-btn {
  background: none; border: none; color: var(--text-muted);
  font-family: var(--font-mono); font-size: 11px; cursor: pointer;
  display: flex; align-items: center; gap: 4px;
}
.ai-toggle-btn:hover { color: var(--primary); }
.ai-sym { font-size: 12px; }
.ai-section { margin-bottom: 6px; }
.ai-row { margin-top: 6px; }
.ai-cat-chips {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  margin-top: 4px;
}
.ai-cat-label { color: var(--text-muted); font-size: 10px; }
.ai-cat-chip {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 10px; font-family: var(--font-mono);
  color: var(--text-muted); cursor: pointer; user-select: none;
  padding: 2px 6px; border: 1px solid transparent; border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}
.ai-cat-chip input { display: none; }
.ai-cat-chip.checked {
  color: var(--cc, var(--primary));
  border-color: var(--cc, var(--primary));
  background: rgba(99, 102, 241, 0.06);
}

/* ── Divider ── */
.divider { height: 1px; background: var(--border-light); margin: 10px 0; }

/* ── List ── */
.todo-list { flex: 1; overflow-y: auto; }
.todo-item {
  display: flex; align-items: center; gap: 6px;
  padding: 7px 4px; border-radius: var(--radius-sm);
  transition: background var(--transition-fast);
}
.todo-item:hover { background: var(--bg-secondary); }
.todo-item.done { opacity: 0.45; }
.cat-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
}
.check-btn {
  background: none; border: none; color: var(--primary);
  font-size: 14px; cursor: pointer; padding: 0 2px; flex-shrink: 0;
}
.check-btn:hover { color: var(--primary-light); }
.check-btn.done { color: var(--text-muted); }
.todo-text { flex: 1; font-size: 13px; cursor: default; }
.todo-item.done .todo-text { text-decoration: line-through; color: var(--text-muted); }
.todo-source { color: var(--text-muted); font-size: 10px; opacity: 0.6; margin-left: 8px; }
.del-btn {
  background: none; border: none; color: var(--text-muted);
  font-size: 16px; cursor: pointer; padding: 0 4px;
  opacity: 0; transition: all var(--transition-fast);
}
.todo-item:hover .del-btn { opacity: 0.6; }
.del-btn:hover { color: var(--error); opacity: 1; }

/* ── Done ── */
.done-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 4px 4px; border-top: 1px solid var(--border-light); margin-top: 6px;
}
.done-dash { color: var(--text-muted); font-size: 11px; opacity: 0.6; }
.clear-done-btn {
  background: none; border: none; color: var(--text-muted);
  font-size: 10px; cursor: pointer; opacity: 0.5;
}
.clear-done-btn:hover { opacity: 1; color: var(--error); }

/* ── Empty ── */
.empty-hint { color: var(--text-muted); font-size: 12px; padding: 20px 0; opacity: 0.5; }
.hint-sym { color: var(--text-muted); margin-right: 4px; }
</style>
