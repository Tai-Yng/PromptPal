<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTodoStore } from '../stores/todoStore'
import { useSettingsStore } from '../stores/settingsStore'

const todoStore = useTodoStore()
const settingsStore = useSettingsStore()

// Plan 视图 or 分类视图
type ViewMode = 'plan' | string  // 'plan' | category_id
const viewMode = ref<ViewMode>('plan')

const isPlanView = computed(() => viewMode.value === 'plan')
const activeCatId = computed(() => isPlanView.value ? '' : viewMode.value as string)

const showList = computed(() => {
  if (isPlanView.value) return todoStore.planItems
  return todoStore.itemsByCategory(viewMode.value as string)
})

const showActive = computed(() => showList.value.filter(i => !i.done))
const showDone = computed(() => showList.value.filter(i => i.done))

const planCount = computed(() => todoStore.planActive.length)

// Category 管理
const showAddCat = ref(false)
const newCatName = ref('')
const addNewCategory = () => {
  const name = newCatName.value.trim()
  if (!name) return
  todoStore.addCategory(name)
  newCatName.value = ''
  showAddCat.value = false
}

// Add task
const newTaskText = ref('')
const activeCat = ref('work')
const addTask = () => {
  const text = newTaskText.value.trim()
  if (!text) return
  // 在分类视图时自动使用当前分类
  const cat = isPlanView.value ? activeCat.value : (viewMode.value as string)
  todoStore.addItem(text, cat)
  newTaskText.value = ''
  // 切换到对应分类查看
  if (isPlanView.value) viewMode.value = cat
}
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') addTask()
}

// AI generate
const showAiInput = ref(false)
const aiPrompt = ref('')
const isGenerating = ref(false)
const aiTargetCat = ref('work')

const generateWithAi = async () => {
  const prompt = aiPrompt.value.trim()
  if (!prompt || !settingsStore.aiConfig.apiKey) return
  isGenerating.value = true

  try {
    const catLabels = todoStore.categories.map(c => `${c.id}: ${c.name}`).join(', ')
    const catIds = todoStore.categories.map(c => c.id).join(', ')

    const systemPrompt = `You are a task planning assistant. Break the user's goal into 4-8 actionable todo items. Assign each to one of these categories: ${catLabels}. Output ONLY the items, one per line, in format: "category_id: task_text". No numbering, no bullets, no extra text. Keep each item under 60 characters. Category ids: ${catIds}.`

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
        max_tokens: 700
      })
    })

    if (!response.ok) { alert(`[ERR] ${(await response.text()).slice(0, 100)}`); return }
    const data = await response.json()
    const raw = data.choices?.[0]?.message?.content || ''
    const lines = raw.split('\n').map((l: string) => l.trim()).filter((l: string) => l)

    for (const line of lines) {
      const ci = line.indexOf(':')
      if (ci < 0) continue
      const catId = line.slice(0, ci).trim().toLowerCase()
      const text = line.slice(ci + 1).trim()
      if (!text || !todoStore.categories.find(c => c.id === catId)) continue
      todoStore.addItem(text, catId)
    }

    aiPrompt.value = ''
    showAiInput.value = false
    // 切换到第一个 AI 生成的分类
    if (lines.length > 0) {
      const ci = lines[0].indexOf(':')
      if (ci > 0) viewMode.value = lines[0].slice(0, ci).trim().toLowerCase()
    }
  } catch (err: any) {
    alert(`[ERR] ${err.message}`)
  } finally {
    isGenerating.value = false
  }
}

const clearDone = () => { if (showDone.value.length > 0) todoStore.clearDone() }

const showDeleteCat = (id: string) => !['work', 'study', 'personal'].includes(id)
</script>

<template>
  <div class="todo-panel">
    <!-- View Tabs -->
    <div class="view-tabs">
      <!-- Plan tab -->
      <button
        class="view-tab plan"
        :class="{ active: isPlanView }"
        @click="viewMode = 'plan'"
      >
        <span class="plan-dot">●</span>
        plan
        <span v-if="planCount > 0" class="plan-badge">{{ planCount }}</span>
      </button>

      <!-- Category tabs -->
      <button
        v-for="cat in todoStore.categories"
        :key="cat.id"
        class="view-tab cat"
        :class="{ active: viewMode === cat.id }"
        :style="{ '--cc': cat.color }"
        @click="viewMode = cat.id"
      >{{ cat.name }}</button>

      <!-- Add category -->
      <div class="add-cat-wrap">
        <button v-if="!showAddCat" class="view-tab add" @click="showAddCat = true">+ cat</button>
        <div v-else class="add-cat-form">
          <input
            v-model="newCatName" class="cat-name-input" placeholder="name"
            @keydown.enter="addNewCategory" @keydown.escape="showAddCat = false"
          />
          <button class="btn-ok" @click="addNewCategory">ok</button>
          <button class="btn-cancel" @click="showAddCat = false">x</button>
        </div>
      </div>
    </div>

    <!-- View indicator -->
    <div class="view-indicator">
      <template v-if="isPlanView">
        <span class="ind-label">today's plan</span>
        <span class="ind-count" v-if="planCount > 0">({{ planCount }} active)</span>
        <span class="ind-count dim" v-else>(empty — add tasks from categories)</span>
      </template>
      <template v-else>
        <span class="ind-label">category:</span>
        <span class="cat-chip-sm" :style="{ '--cc': todoStore.getCategoryColor(viewMode) }">
          {{ todoStore.categories.find(c => c.id === viewMode)?.name || viewMode }}
        </span>
        <span class="ind-count dim">({{ showActive.length }} / {{ showList.length }})</span>
      </template>
    </div>

    <!-- Input -->
    <div class="input-section">
      <div class="todo-input-row">
        <span class="prompt-sym">&gt;</span>
        <input
          v-model="newTaskText" class="todo-input" placeholder="add task..."
          @keydown="handleKeydown" :disabled="isGenerating"
        />
        <select v-if="isPlanView" v-model="activeCat" class="cat-select">
          <option v-for="c in todoStore.categories" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <button class="add-btn" @click="addTask" :disabled="isGenerating">+</button>
      </div>
    </div>

    <!-- AI generate -->
    <div class="ai-toggle-row">
      <button class="ai-toggle-btn" @click="showAiInput = !showAiInput">
        <span class="ai-sym">{{ showAiInput ? '-' : '+' }}</span>
        generate with AI
      </button>
    </div>

    <div v-if="showAiInput" class="ai-section">
      <div class="ai-cat-pick">
        <span class="pick-label">to:</span>
        <select v-model="aiTargetCat" class="cat-select">
          <option v-for="c in todoStore.categories" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>
      <div class="ai-hint">AI generates tasks auto-categorized using your tags.</div>
      <div class="todo-input-row ai-row">
        <span class="prompt-sym dim">&gt;</span>
        <input
          v-model="aiPrompt" class="todo-input"
          placeholder="e.g. 中考科学复习"
          @keydown.enter="generateWithAi" :disabled="isGenerating"
        />
        <button class="add-btn gen" @click="generateWithAi"
          :disabled="isGenerating || !aiPrompt.trim()"
        >{{ isGenerating ? '...' : 'go' }}</button>
      </div>
    </div>

    <div class="divider"></div>

    <!-- List -->
    <div class="todo-list">
      <!-- Active -->
      <div v-for="item in showActive" :key="item.id" class="todo-item">
        <button class="plan-btn" :class="{ on: item.inPlan }"
          :title="item.inPlan ? 'remove from plan' : 'add to plan'"
          @click="todoStore.togglePlan(item.id)"
        >
          {{ item.inPlan ? '●' : '○' }}
        </button>
        <span class="cat-dot" :style="{ background: todoStore.getCategoryColor(item.category) }" :title="item.category"></span>
        <button class="check-btn" title="done" @click="todoStore.toggleItem(item.id)">☐</button>
        <span class="todo-text" @click="todoStore.toggleItem(item.id)">{{ item.text }}</span>
        <button class="del-btn" title="delete" @click="todoStore.deleteItem(item.id)">×</button>
      </div>

      <!-- Done -->
      <template v-if="showDone.length > 0">
        <div class="done-header">
          <span class="done-dash">── done ──</span>
          <button class="clear-done-btn" @click="clearDone">clear all</button>
        </div>
        <div v-for="item in showDone" :key="item.id" class="todo-item done">
          <span class="plan-btn off"></span>
          <span class="cat-dot" :style="{ background: todoStore.getCategoryColor(item.category) }"></span>
          <button class="check-btn done" title="undo" @click="todoStore.toggleItem(item.id)">☑</button>
          <span class="todo-text" @click="todoStore.toggleItem(item.id)">{{ item.text }}</span>
          <button class="del-btn" title="delete" @click="todoStore.deleteItem(item.id)">×</button>
        </div>
      </template>

      <div v-if="showList.length === 0" class="empty-hint">
        <span class="hint-sym">&gt;</span>
        <template v-if="isPlanView">pick tasks from categories to plan your day</template>
        <template v-else>no tasks yet. add some or generate with AI</template>
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

/* ── Tabs ── */
.view-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; align-items: center; }
.view-tab {
  padding: 5px 12px;
  border: 1px solid var(--border-color);
  background: transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono); font-size: 11px;
  color: var(--text-muted); cursor: pointer;
  transition: all var(--transition-normal); white-space: nowrap;
  display: inline-flex; align-items: center; gap: 4px;
}
.view-tab:hover { border-color: var(--primary-light); color: var(--text-primary); }
.view-tab.active {
  border-color: var(--primary);
  color: var(--primary);
  background: rgba(99, 102, 241, 0.08);
}
.view-tab.cat.active { border-color: var(--cc); color: var(--cc); background: rgba(99, 102, 241, 0.06); }
.view-tab.plan .plan-dot { color: var(--primary); font-size: 8px; }
.plan-badge {
  background: var(--primary); color: #0a0a0f;
  font-size: 9px; padding: 1px 5px; border-radius: 8px;
  font-weight: 700;
}
.view-tab.add { border-style: dashed; font-size: 10px; padding: 5px 10px; }
.add-cat-wrap { display: flex; align-items: center; }
.add-cat-form {
  display: flex; align-items: center; gap: 4px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 2px 6px;
}
.cat-name-input {
  width: 60px; background: transparent; border: none;
  color: var(--text-primary); font-family: var(--font-mono); font-size: 11px; outline: none;
}
.btn-ok, .btn-cancel { background: none; border: none; font-family: var(--font-mono); font-size: 10px; cursor: pointer; }
.btn-ok { color: var(--primary); }
.btn-cancel { color: var(--text-muted); }

/* ── Indicator ── */
.view-indicator { color: var(--text-muted); font-size: 11px; padding: 2px 0 8px; }
.ind-label { opacity: 0.5; margin-right: 4px; }
.ind-count { opacity: 0.6; font-size: 10px; }
.ind-count.dim { opacity: 0.4; }
.cat-chip-sm {
  display: inline-flex; align-items: center;
  padding: 1px 6px; border: 1px solid var(--cc);
  border-radius: var(--radius-sm); font-size: 10px;
}

/* ── Input ── */
.input-section { margin-bottom: 8px; }
.todo-input-row {
  display: flex; align-items: center; gap: 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 6px 10px;
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
}
.add-btn:hover { border-color: var(--primary); background: rgba(99, 102, 241, 0.1); }
.add-btn.gen { width: 36px; font-size: 11px; }
.add-btn:disabled { opacity: 0.3; cursor: default; }

/* ── AI ── */
.ai-toggle-row { margin-bottom: 6px; }
.ai-toggle-btn {
  background: none; border: none; color: var(--text-muted);
  font-family: var(--font-mono); font-size: 11px; cursor: pointer;
  display: flex; align-items: center; gap: 4px;
}
.ai-toggle-btn:hover { color: var(--primary); }
.ai-sym { font-size: 12px; }
.ai-section { margin-bottom: 6px; }
.ai-cat-pick { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.pick-label { color: var(--text-muted); font-size: 10px; }
.ai-hint { color: var(--text-muted); font-size: 10px; opacity: 0.6; padding: 2px 0 6px; }
.ai-row { margin-top: 2px; }

/* ── Divider ── */
.divider { height: 1px; background: var(--border-light); margin: 10px 0; }

/* ── List ── */
.todo-list { flex: 1; overflow-y: auto; }
.todo-item {
  display: flex; align-items: center; gap: 5px;
  padding: 7px 4px; border-radius: var(--radius-sm);
  transition: background var(--transition-fast);
}
.todo-item:hover { background: var(--bg-secondary); }
.todo-item.done { opacity: 0.45; }
.plan-btn {
  background: none; border: none; color: var(--text-muted);
  font-size: 12px; cursor: pointer; padding: 0; flex-shrink: 0;
  transition: color var(--transition-fast); line-height: 1;
}
.plan-btn:hover { color: var(--primary); }
.plan-btn.on { color: var(--primary); }
.plan-btn.off { visibility: hidden; }
.cat-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.check-btn {
  background: none; border: none; color: var(--primary);
  font-size: 14px; cursor: pointer; padding: 0 2px; flex-shrink: 0;
}
.check-btn:hover { color: var(--primary-light); }
.check-btn.done { color: var(--text-muted); }
.todo-text { flex: 1; font-size: 13px; cursor: default; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.todo-item.done .todo-text { text-decoration: line-through; color: var(--text-muted); }
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
.clear-done-btn { background: none; border: none; color: var(--text-muted); font-size: 10px; cursor: pointer; opacity: 0.5; }
.clear-done-btn:hover { opacity: 1; color: var(--error); }

/* ── Empty ── */
.empty-hint { color: var(--text-muted); font-size: 12px; padding: 20px 0; opacity: 0.5; }
.hint-sym { color: var(--text-muted); margin-right: 4px; }
</style>
