<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTodoStore, type PlanItem } from '../stores/todoStore'
import { useSettingsStore } from '../stores/settingsStore'

const todoStore = useTodoStore()
const settingsStore = useSettingsStore()

// Plan 视图 or 分类视图
type ViewMode = 'plan' | string  // 'plan' | category_id
const viewMode = ref<ViewMode>('plan')

const isPlanView = computed(() => viewMode.value === 'plan')

// 分类视图：只显示未完成任务
const categoryItems = computed(() => {
  if (isPlanView.value) return []
  return todoStore.items.filter(i => i.category === viewMode.value && !i.done)
})

// Plan 视图：显示所有 plan 项
const planActiveItems = computed(() => todoStore.planActive)
const planDoneItems = computed(() => todoStore.planDone)

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

// Add task (分类视图)
const newTaskText = ref('')
const addTask = () => {
  const text = newTaskText.value.trim()
  if (!text) return
  if (isPlanView.value) {
    // plan 视图：直接添加到 plan
    todoStore.addDirectToPlan(text, 'work')
  } else {
    // 分类视图：添加到当前分类
    todoStore.addItem(text, viewMode.value as string)
  }
  newTaskText.value = ''
}
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') addTask()
}

// AI generate
const showAiInput = ref(false)
const aiPrompt = ref('')
const isGenerating = ref(false)

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

const clearPlanDone = () => {
  if (planDoneItems.value.length > 0) todoStore.clearPlanDone()
}

// 拖拽排序（基于ID，解决active列表索引与完整planItems不对齐的问题）
const dragItemId = ref<string | null>(null)
const onDragStart = (e: DragEvent, item: PlanItem) => {
  dragItemId.value = item.id
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}
const onDragOver = (e: DragEvent) => {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
}
const onDrop = (e: DragEvent, targetItem: PlanItem) => {
  e.preventDefault()
  if (dragItemId.value && dragItemId.value !== targetItem.id) {
    todoStore.reorderPlan(dragItemId.value, targetItem.id)
  }
  dragItemId.value = null
}
const onDragEnd = () => { dragItemId.value = null }
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
        <span class="ind-count dim">({{ categoryItems.length }} tasks)</span>
      </template>
    </div>

    <!-- Input -->
    <div class="input-section">
      <div class="todo-input-row">
        <span class="prompt-sym">&gt;</span>
        <input
          v-model="newTaskText" class="todo-input" :placeholder="isPlanView ? 'add to plan...' : 'add task...'"
          @keydown="handleKeydown" :disabled="isGenerating"
        />
        <button class="add-btn" @click="addTask" :disabled="isGenerating">+</button>
      </div>
    </div>

    <!-- AI generate (only in category view) -->
    <div v-if="!isPlanView" class="ai-toggle-row">
      <button class="ai-toggle-btn" @click="showAiInput = !showAiInput">
        <span class="ai-sym">{{ showAiInput ? '-' : '+' }}</span>
        generate with AI
      </button>
    </div>

    <div v-if="showAiInput && !isPlanView" class="ai-section">
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
      <!-- ========== Plan 视图 ========== -->
      <template v-if="isPlanView">
        <!-- GO GO! / STOP 按钮 -->
        <div class="focus-bar">
          <template v-if="!todoStore.focusMode">
            <button
              class="gogo-btn"
              :disabled="planActiveItems.length === 0"
              @click="todoStore.startFocus()"
            >
              <span class="gogo-icon">▶</span> GO GO!
            </button>
            <span v-if="planActiveItems.length === 0" class="gogo-hint">add tasks to plan first</span>
            <span v-else class="gogo-hint">{{ planActiveItems.length }} tasks ready</span>
          </template>
          <template v-else>
            <button class="stop-btn" @click="todoStore.stopFocus()">
              <span class="stop-icon">■</span> STOP
            </button>
            <span class="gogo-hint active">focus mode — hover pet to see task</span>
          </template>
        </div>

        <!-- Active (支持拖拽排序) -->
        <div
          v-for="(item, index) in planActiveItems"
          :key="item.id"
          class="todo-item"
          :class="{ 'drag-over': dragItemId === item.id }"
          draggable="true"
          @dragstart="onDragStart($event, item)"
          @dragover="onDragOver"
          @drop="onDrop($event, item)"
          @dragend="onDragEnd"
        >
          <span class="drag-handle" title="drag to reorder">⠿</span>
          <button
            class="plan-btn on"
            title="remove from plan"
            @click="todoStore.removeFromPlan(item.id)"
          >
            −plan
          </button>
          <span class="cat-dot" :style="{ background: todoStore.getCategoryColor(item.category) }" :title="item.category"></span>
          <button class="check-btn" title="done" @click="todoStore.togglePlanItem(item.id)">☐</button>
          <span class="todo-text" @click="todoStore.togglePlanItem(item.id)">{{ item.text }}</span>
          <span v-if="index === 0 && todoStore.focusMode" class="focus-badge">NOW</span>
        </div>

        <!-- Done -->
        <template v-if="planDoneItems.length > 0">
          <div class="done-header">
            <span class="done-dash">── done ──</span>
            <button class="clear-done-btn" @click="clearPlanDone">clear all</button>
          </div>
          <div v-for="item in planDoneItems" :key="item.id" class="todo-item done">
            <span class="cat-dot" :style="{ background: todoStore.getCategoryColor(item.category) }"></span>
            <button class="check-btn done" title="undo" @click="todoStore.togglePlanItem(item.id)">☑</button>
            <span class="todo-text" @click="todoStore.togglePlanItem(item.id)">{{ item.text }}</span>
            <button class="del-btn" title="delete" @click="todoStore.removeFromPlan(item.id)">×</button>
          </div>
        </template>

        <div v-if="planActiveItems.length === 0 && planDoneItems.length === 0" class="empty-hint">
          <span class="hint-sym">&gt;</span>
          pick tasks from categories to plan your day
        </div>
      </template>

      <!-- ========== 分类视图 ========== -->
      <template v-else>
        <div v-for="item in categoryItems" :key="item.id" class="todo-item">
          <button
            class="plan-btn"
            :class="{ on: todoStore.isInPlan(item.id) }"
            :title="todoStore.isInPlan(item.id) ? 'already in plan' : 'add to plan'"
            :disabled="todoStore.isInPlan(item.id)"
            @click="todoStore.addToPlan(item.id)"
          >
            {{ todoStore.isInPlan(item.id) ? 'in plan' : '+plan' }}
          </button>
          <span class="cat-dot" :style="{ background: todoStore.getCategoryColor(item.category) }"></span>
          <span class="todo-text">{{ item.text }}</span>
          <button class="del-btn" title="delete" @click="todoStore.deleteItem(item.id)">×</button>
        </div>

        <div v-if="categoryItems.length === 0" class="empty-hint">
          <span class="hint-sym">&gt;</span>
          no tasks yet. add some or generate with AI
        </div>
      </template>
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
  background: transparent; border: 1px solid var(--border-color);
  color: var(--text-muted); border-radius: var(--radius-sm);
  font-size: 9px; font-family: var(--font-mono);
  cursor: pointer; padding: 2px 5px; flex-shrink: 0;
  transition: all var(--transition-fast);
  white-space: nowrap;
}
.plan-btn:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); }
.plan-btn.on {
  border-color: var(--primary);
  color: var(--primary);
  background: rgba(99, 102, 241, 0.1);
}
.plan-btn:disabled {
  cursor: default;
  opacity: 0.6;
}
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

/* ── Focus Bar ── */
.focus-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 4px;
  margin-bottom: 4px;
}
.gogo-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 20px;
  background: linear-gradient(135deg, #6366F1, #8B5CF6);
  border: none;
  border-radius: var(--radius-sm);
  color: #fff;
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  letter-spacing: 1px;
  transition: all 0.2s;
  box-shadow: 0 0 12px rgba(99, 102, 241, 0.3);
}
.gogo-btn:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 0 20px rgba(99, 102, 241, 0.5);
}
.gogo-btn:disabled { opacity: 0.3; cursor: not-allowed; box-shadow: none; }
.gogo-icon { font-size: 11px; }
.gogo-hint { font-size: 10px; color: var(--text-muted); opacity: 0.6; }
.gogo-hint.active { color: var(--primary); opacity: 0.8; }

.stop-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 20px;
  background: transparent;
  border: 1px solid #EF4444;
  border-radius: var(--radius-sm);
  color: #EF4444;
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  letter-spacing: 1px;
  transition: all 0.2s;
}
.stop-btn:hover { background: #EF4444; color: #fff; }
.stop-icon { font-size: 10px; }

/* ── Drag ── */
.drag-handle {
  color: var(--text-muted);
  font-size: 12px;
  cursor: grab;
  opacity: 0.3;
  transition: opacity 0.2s;
  flex-shrink: 0;
}
.todo-item:hover .drag-handle { opacity: 0.7; }
.todo-item.drag-over { border-top: 2px solid var(--primary); }

/* ── Focus Badge ── */
.focus-badge {
  font-size: 8px;
  font-weight: 700;
  color: #0a0a0f;
  background: var(--primary);
  padding: 1px 6px;
  border-radius: 8px;
  letter-spacing: 0.5px;
  animation: pulse-badge 1.5s ease-in-out infinite;
}
@keyframes pulse-badge {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
