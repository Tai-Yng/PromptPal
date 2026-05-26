<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTodoStore } from '../stores/todoStore'
import { useSettingsStore } from '../stores/settingsStore'

const todoStore = useTodoStore()
const settingsStore = useSettingsStore()

// ── Plan ──
const showNewPlan = ref(false)
const newPlanName = ref('')

const createPlan = () => {
  const name = newPlanName.value.trim()
  if (!name) return
  todoStore.addPlan(name)
  newPlanName.value = ''
  showNewPlan.value = false
}

// ── Add task ──
const newTaskText = ref('')
const activeCat = ref('work')

const addTask = () => {
  const text = newTaskText.value.trim()
  if (!text) return
  todoStore.addItem(text, activeCat.value)
  newTaskText.value = ''
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') addTask()
}

// ── AI 生成计划 ──
const showAiInput = ref(false)
const aiPrompt = ref('')
const isGenerating = ref(false)

const generatePlan = async () => {
  const prompt = aiPrompt.value.trim()
  if (!prompt || !settingsStore.aiConfig.apiKey) return

  isGenerating.value = true
  try {
    const catLabels = todoStore.categories.map(c => `${c.id}: ${c.name}`).join(', ')
    const catIds = todoStore.categories.map(c => c.id).join(', ')

    const systemPrompt = `You are a study/life planning assistant. Create a structured plan with a title and todo items. Output format:
Line 1: plan_title (a short 2-6 word title for the plan, in the user's language)
Then one todo per line in format: "category_id: task_text"
Available categories: ${catLabels}
Category ids: ${catIds}

Rules:
- Keep the plan title concise
- 4-10 todo items
- Each item under 60 characters
- No numbering, no bullets, no extra text`

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
        max_tokens: 800
      })
    })

    if (!response.ok) {
      const err = await response.text()
      alert(`[ERR] ${err.slice(0, 100)}`)
      return
    }

    const data = await response.json()
    const raw = data.choices?.[0]?.message?.content || ''
    const lines = raw.split('\n').map((l: string) => l.trim()).filter((l: string) => l)

    if (lines.length < 2) {
      alert('[ERR] AI returned too few items')
      return
    }

    // 第一行是计划标题
    const planTitle = lines[0]
    todoStore.addPlan(planTitle)
    const pid = todoStore.activePlanId

    // 后续行是 todo
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      const colonIdx = line.indexOf(':')
      if (colonIdx < 0) continue
      const catId = line.slice(0, colonIdx).trim().toLowerCase()
      const text = line.slice(colonIdx + 1).trim()
      if (!text || !todoStore.categories.find(c => c.id === catId)) continue
      todoStore.addItem(text, catId, pid)
    }

    aiPrompt.value = ''
    showAiInput.value = false
  } catch (err: any) {
    alert(`[ERR] ${err.message}`)
  } finally {
    isGenerating.value = false
  }
}

// ── Category management ──
const showAddCat = ref(false)
const newCatName = ref('')

const addNewCategory = () => {
  const name = newCatName.value.trim()
  if (!name) return
  todoStore.addCategory(name)
  newCatName.value = ''
  showAddCat.value = false
}

const clearAllDone = () => {
  if (todoStore.doneItems.length === 0) return
  todoStore.clearDone()
}

const planHasContent = computed(() => todoStore.planItems.length > 0)
</script>

<template>
  <div class="todo-panel">
    <!-- Plan Tabs -->
    <div class="plan-tabs">
      <button
        v-for="plan in todoStore.plans"
        :key="plan.id"
        class="plan-tab"
        :class="{ active: todoStore.activePlanId === plan.id }"
        @click="todoStore.setActivePlan(plan.id)"
      >
        {{ plan.name }}
        <span
          class="plan-del"
          @click.stop="todoStore.deletePlan(plan.id)"
          title="delete plan"
        >×</span>
      </button>

      <!-- New plan -->
      <div class="add-plan-wrap">
        <button v-if="!showNewPlan" class="plan-tab add" @click="showNewPlan = true">+ new plan</button>
        <div v-else class="add-plan-form">
          <input
            v-model="newPlanName"
            class="plan-name-input"
            placeholder="plan name"
            @keydown.enter="createPlan"
            @keydown.escape="showNewPlan = false"
          />
          <button class="btn-ok" @click="createPlan">ok</button>
          <button class="btn-cancel" @click="showNewPlan = false">x</button>
        </div>
      </div>
    </div>

    <!-- Active plan indicator -->
    <div v-if="todoStore.activePlan" class="plan-indicator">
      <span class="plan-label">plan:</span>
      <span class="plan-name">{{ todoStore.activePlan.name }}</span>
      <span class="plan-count">({{ todoStore.activeItems.length }} active)</span>
    </div>
    <div v-else class="plan-indicator empty">
      <span class="hint-sym">&gt;</span> create a plan or generate one with AI
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
        <select v-model="activeCat" class="cat-select" title="category">
          <option v-for="c in todoStore.categories" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <button class="add-btn" @click="addTask" :disabled="isGenerating">+</button>
      </div>
    </div>

    <!-- Category chips -->
    <div class="cat-row">
      <span v-for="c in todoStore.categories" :key="c.id" class="cat-chip" :style="{ '--cc': c.color }">
        <span class="cat-chip-dot" :style="{ background: c.color }"></span>
        {{ c.name }}
        <button
          v-if="!['work','study','personal'].includes(c.id)"
          class="cat-chip-del"
          @click="todoStore.deleteCategory(c.id)"
          title="delete category"
        >×</button>
      </span>
      <div class="add-cat-wrap">
        <button v-if="!showAddCat" class="cat-chip add" @click="showAddCat = true">+ cat</button>
        <div v-else class="add-cat-form">
          <input
            v-model="newCatName"
            class="cat-name-input"
            placeholder="name"
            @keydown.enter="addNewCategory"
            @keydown.escape="showAddCat = false"
          />
          <button class="btn-ok" @click="addNewCategory">ok</button>
          <button class="btn-cancel" @click="showAddCat = false">x</button>
        </div>
      </div>
    </div>

    <!-- AI generate plan -->
    <div class="ai-toggle-row">
      <button class="ai-toggle-btn" @click="showAiInput = !showAiInput">
        <span class="ai-sym">{{ showAiInput ? '-' : '+' }}</span>
        generate plan with AI
      </button>
    </div>

    <div v-if="showAiInput" class="ai-section">
      <div class="ai-hint">
        AI will create a new plan with tasks, auto-categorized using your tags above.
      </div>
      <div class="todo-input-row ai-row">
        <span class="prompt-sym dim">&gt;</span>
        <input
          v-model="aiPrompt"
          class="todo-input"
          placeholder="e.g. 中考科学冲刺14天计划"
          @keydown.enter="generatePlan"
          :disabled="isGenerating"
        />
        <button
          class="add-btn gen"
          @click="generatePlan"
          :disabled="isGenerating || !aiPrompt.trim()"
        >{{ isGenerating ? '...' : 'go' }}</button>
      </div>
    </div>

    <div class="divider"></div>

    <!-- Todo list -->
    <div class="todo-list">
      <!-- Active items -->
      <div v-for="item in todoStore.activeItems" :key="item.id" class="todo-item">
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

      <!-- Done items -->
      <template v-if="todoStore.doneItems.length > 0">
        <div class="done-header">
          <span class="done-dash">── done ──</span>
          <button class="clear-done-btn" @click="clearAllDone">clear all</button>
        </div>
        <div v-for="item in todoStore.doneItems" :key="item.id" class="todo-item done">
          <span class="cat-dot" :style="{ background: todoStore.getCategoryColor(item.category) }"></span>
          <button class="check-btn done" title="undo" @click="todoStore.toggleItem(item.id)">☑</button>
          <span class="todo-text" @click="todoStore.toggleItem(item.id)">{{ item.text }}</span>
          <button class="del-btn" title="delete" @click="todoStore.deleteItem(item.id)">×</button>
        </div>
      </template>

      <!-- Empty -->
      <div v-if="!planHasContent" class="empty-hint">
        <span class="hint-sym">&gt;</span>
        <template v-if="todoStore.activePlan">
          add tasks above or generate with AI
        </template>
        <template v-else>
          create a plan or generate one with AI to get started
        </template>
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

/* ── Plan Tabs ── */
.plan-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; align-items: center; }
.plan-tab {
  padding: 6px 14px;
  border: 1px solid var(--border-color);
  background: transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-normal);
  display: flex; align-items: center; gap: 6px;
  white-space: nowrap;
}
.plan-tab:hover { border-color: var(--primary-light); color: var(--text-primary); }
.plan-tab.active {
  border-color: var(--primary);
  color: var(--primary);
  background: rgba(99, 102, 241, 0.08);
}
.plan-tab.add { border-style: dashed; font-size: 11px; padding: 6px 12px; }
.plan-del {
  opacity: 0; font-size: 14px; line-height: 1;
  transition: opacity var(--transition-fast);
}
.plan-tab:hover .plan-del { opacity: 0.5; }
.plan-del:hover { opacity: 1; color: var(--error); }
.add-plan-wrap { display: flex; align-items: center; }
.add-plan-form {
  display: flex; align-items: center; gap: 4px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 3px 8px;
}
.plan-name-input {
  width: 100px; background: transparent; border: none;
  color: var(--text-primary); font-family: var(--font-mono); font-size: 12px; outline: none;
}
.btn-ok, .btn-cancel { background: none; border: none; font-family: var(--font-mono); font-size: 10px; cursor: pointer; }
.btn-ok { color: var(--primary); }
.btn-cancel { color: var(--text-muted); }

/* ── Plan indicator ── */
.plan-indicator {
  color: var(--text-muted); font-size: 11px; padding: 2px 0 8px;
}
.plan-indicator.empty { opacity: 0.5; }
.plan-label { opacity: 0.5; margin-right: 4px; }
.plan-name { color: var(--primary); font-weight: 600; }
.plan-count { opacity: 0.5; margin-left: 6px; }

/* ── Input ── */
.input-section { margin-bottom: 8px; }
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

/* ── Category row ── */
.cat-row {
  display: flex; gap: 5px; flex-wrap: wrap; align-items: center; margin-bottom: 8px;
}
.cat-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 10px; font-family: var(--font-mono);
  color: var(--text-muted);
  transition: border-color var(--transition-fast);
}
.cat-chip:hover { border-color: var(--cc, var(--primary)); }
.cat-chip-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.cat-chip-del {
  background: none; border: none; color: var(--text-muted);
  font-size: 12px; cursor: pointer; opacity: 0; transition: opacity var(--transition-fast);
  line-height: 1;
}
.cat-chip:hover .cat-chip-del { opacity: 0.5; }
.cat-chip-del:hover { opacity: 1; color: var(--error); }
.cat-chip.add { border-style: dashed; cursor: pointer; }
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
  color: var(--text-primary); font-family: var(--font-mono); font-size: 10px; outline: none;
}

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
.ai-hint { color: var(--text-muted); font-size: 10px; opacity: 0.6; padding: 2px 0 6px; }
.ai-row { margin-top: 2px; }

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
.cat-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
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
.clear-done-btn { background: none; border: none; color: var(--text-muted); font-size: 10px; cursor: pointer; opacity: 0.5; }
.clear-done-btn:hover { opacity: 1; color: var(--error); }

/* ── Empty ── */
.empty-hint { color: var(--text-muted); font-size: 12px; padding: 20px 0; opacity: 0.5; }
.hint-sym { color: var(--text-muted); margin-right: 4px; }
</style>
