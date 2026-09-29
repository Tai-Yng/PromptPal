<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTodoStore } from '../../stores/todoStore'

const todoStore = useTodoStore()

// 拖拽排序（基于ID，解决active列表索引与完整planItems不对齐的问题）
const dragItemId = ref<string | null>(null)
const onDragStart = (e: DragEvent, item: { id: string }) => {
  dragItemId.value = item.id
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}
const onDragOver = (e: DragEvent) => {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
}
const onDrop = (e: DragEvent, targetItem: { id: string }) => {
  e.preventDefault()
  if (dragItemId.value && dragItemId.value !== targetItem.id) {
    todoStore.reorderPlan(dragItemId.value, targetItem.id)
  }
  dragItemId.value = null
}
const onDragEnd = () => { dragItemId.value = null }

const planActiveItems = computed(() => todoStore.planActive)
const planDoneItems = computed(() => todoStore.planDone)

const clearPlanDone = () => {
  if (planDoneItems.value.length > 0) todoStore.clearPlanDone()
}
</script>

<template>
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
