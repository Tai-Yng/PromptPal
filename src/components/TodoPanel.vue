<script setup lang="ts">
import { ref } from 'vue'
import { useTodoStore } from '../stores/todoStore'
import { useSettingsStore } from '../stores/settingsStore'

const todoStore = useTodoStore()
const settingsStore = useSettingsStore()

const newTaskText = ref('')
const isGenerating = ref(false)
const showAiInput = ref(false)
const aiPrompt = ref('')
const genResult = ref('')

const addTask = () => {
  const text = newTaskText.value.trim()
  if (!text) return
  todoStore.addItem(text)
  newTaskText.value = ''
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') addTask()
}

const clearAllDone = () => {
  if (todoStore.doneItems.length === 0) return
  todoStore.clearDone()
}

const generateTodos = async () => {
  const prompt = aiPrompt.value.trim()
  if (!prompt || !settingsStore.aiConfig.apiKey) return

  isGenerating.value = true
  genResult.value = ''

  try {
    const systemPrompt = `You are a task planning assistant. The user describes a goal. Break it down into 3-7 concrete, actionable todo items. Keep each item under 60 characters. Output ONLY the items, one per line, no numbering, no bullets, no extra text. Each line = one todo.`

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
        max_tokens: 500
      })
    })

    if (!response.ok) {
      const err = await response.text()
      genResult.value = `[ERR] ${err.slice(0, 100)}`
      return
    }

    const data = await response.json()
    const raw = data.choices?.[0]?.message?.content || ''
    genResult.value = raw

    // 解析为行，过滤空行
    const lines = raw.split('\n')
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0)

    if (lines.length > 0) {
      todoStore.addItems(lines, `AI: ${aiPrompt.value}`)
      aiPrompt.value = ''
      showAiInput.value = false
    }
  } catch (err: any) {
    genResult.value = `[ERR] ${err.message}`
  } finally {
    isGenerating.value = false
  }
}
</script>

<template>
  <div class="todo-panel">
    <!-- 手动添加 -->
    <div class="todo-input-row">
      <span class="prompt-sym">&gt;</span>
      <input
        v-model="newTaskText"
        class="todo-input"
        placeholder="add task..."
        @keydown="handleKeydown"
        :disabled="isGenerating"
      />
      <button class="add-btn" @click="addTask" :disabled="isGenerating">+</button>
    </div>

    <!-- AI 生成入口 -->
    <div class="ai-toggle-row">
      <button class="ai-toggle-btn" @click="showAiInput = !showAiInput">
        <span class="ai-sym">{{ showAiInput ? '-' : '+' }}</span>
        generate with AI
      </button>
    </div>

    <!-- AI 输入区 -->
    <div v-if="showAiInput" class="ai-section">
      <div class="todo-input-row ai-row">
        <span class="prompt-sym dim">&gt;</span>
        <input
          v-model="aiPrompt"
          class="todo-input"
          placeholder="e.g. 本周中考科学复习计划"
          @keydown.enter="generateTodos"
          :disabled="isGenerating"
        />
        <button
          class="add-btn gen"
          @click="generateTodos"
          :disabled="isGenerating || !aiPrompt.trim()"
        >
          {{ isGenerating ? '...' : 'go' }}
        </button>
      </div>
      <div v-if="isGenerating" class="gen-status">generating...</div>
      <div v-if="genResult && !isGenerating" class="gen-result">{{ genResult }}</div>
    </div>

    <div class="divider"></div>

    <!-- 任务列表 -->
    <div class="todo-list">
      <!-- 活跃任务 -->
      <div
        v-for="item in todoStore.activeItems"
        :key="item.id"
        class="todo-item"
      >
        <button
          class="check-btn"
          :title="'mark done'"
          @click="todoStore.toggleItem(item.id)"
        >☐</button>
        <span class="todo-text" @click="todoStore.toggleItem(item.id)">
          {{ item.text }}
          <span v-if="item.source" class="todo-source">{{ item.source }}</span>
        </span>
        <button class="del-btn" title="delete" @click="todoStore.deleteItem(item.id)">×</button>
      </div>

      <!-- 已完成 -->
      <template v-if="todoStore.doneItems.length > 0">
        <div class="done-header">
          <span class="done-dash">── done ──</span>
          <button class="clear-done-btn" @click="clearAllDone">clear all</button>
        </div>
        <div
          v-for="item in todoStore.doneItems"
          :key="item.id"
          class="todo-item done"
        >
          <button
            class="check-btn done"
            title="undo"
            @click="todoStore.toggleItem(item.id)"
          >☑</button>
          <span class="todo-text" @click="todoStore.toggleItem(item.id)">
            {{ item.text }}
            <span v-if="item.source" class="todo-source">{{ item.source }}</span>
          </span>
          <button class="del-btn" title="delete" @click="todoStore.deleteItem(item.id)">×</button>
        </div>
      </template>

      <div v-if="todoStore.items.length === 0" class="empty-hint">
        <span class="hint-sym">&gt;</span> nothing here yet. add a task or generate with AI.
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

/* ── input row ── */
.todo-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
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
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 13px;
  outline: none;
}
.todo-input::placeholder { color: var(--text-muted); }
.todo-input:disabled { opacity: 0.4; }

.add-btn {
  width: 28px; height: 28px;
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--primary);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 16px;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all var(--transition-normal);
}
.add-btn:hover { border-color: var(--primary); background: rgba(99, 102, 241, 0.1); }
.add-btn.gen { width: 36px; font-size: 11px; text-transform: uppercase; }
.add-btn:disabled { opacity: 0.3; cursor: default; }

/* ── AI toggle ── */
.ai-toggle-row { margin-top: 8px; }
.ai-toggle-btn {
  background: none; border: none;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
  cursor: pointer;
  display: flex; align-items: center; gap: 4px;
  transition: color var(--transition-normal);
}
.ai-toggle-btn:hover { color: var(--primary); }
.ai-sym { font-size: 12px; }

.ai-section { margin-top: 6px; }
.ai-row { margin-bottom: 4px; }
.gen-status {
  color: var(--accent);
  font-size: 11px;
  padding: 4px 0;
}
.gen-result {
  color: var(--text-muted);
  font-size: 11px;
  white-space: pre-wrap;
  padding: 6px 0;
  opacity: 0.7;
}

/* ── divider ── */
.divider {
  height: 1px;
  background: var(--border-light);
  margin: 14px 0;
}

/* ── list ── */
.todo-list {
  flex: 1;
  overflow-y: auto;
}

.todo-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 4px;
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast);
}
.todo-item:hover { background: var(--bg-secondary); }

.todo-item.done { opacity: 0.45; }

.check-btn {
  background: none; border: none;
  color: var(--primary);
  font-size: 14px;
  cursor: pointer;
  padding: 0 2px;
  flex-shrink: 0;
  transition: color var(--transition-fast);
}
.check-btn:hover { color: var(--primary-light); }
.check-btn.done { color: var(--text-muted); }

.todo-text {
  flex: 1;
  font-size: 13px;
  cursor: default;
}
.todo-item.done .todo-text {
  text-decoration: line-through;
  color: var(--text-muted);
}

.todo-source {
  color: var(--text-muted);
  font-size: 10px;
  opacity: 0.6;
  margin-left: 8px;
}

.del-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 16px;
  cursor: pointer;
  padding: 0 4px;
  opacity: 0;
  transition: all var(--transition-fast);
}
.todo-item:hover .del-btn { opacity: 0.6; }
.del-btn:hover { color: var(--error); opacity: 1; }

/* ── done separator ── */
.done-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 4px 4px;
  border-top: 1px solid var(--border-light);
  margin-top: 6px;
}
.done-dash {
  color: var(--text-muted);
  font-size: 11px;
  opacity: 0.6;
}
.clear-done-btn {
  background: none; border: none;
  color: var(--text-muted);
  font-size: 10px;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity var(--transition-fast);
}
.clear-done-btn:hover { opacity: 1; color: var(--error); }

/* ── empty ── */
.empty-hint {
  color: var(--text-muted);
  font-size: 12px;
  padding: 20px 0;
  opacity: 0.5;
}
.hint-sym { color: var(--text-muted); margin-right: 4px; }
</style>
