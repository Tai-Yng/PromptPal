<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTodoStore } from '../stores/todoStore'
import { useSettingsStore } from '../stores/settingsStore'
import PlanView from './todo/PlanView.vue'
import CategoryView from './todo/CategoryView.vue'

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
      <PlanView v-if="isPlanView" />
      <CategoryView v-else :category-id="viewMode" />
    </div>
  </div>
</template>

<style src="./todo/todo-shared.css"></style>
