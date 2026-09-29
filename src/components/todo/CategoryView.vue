<script setup lang="ts">
import { computed } from 'vue'
import { useTodoStore } from '../../stores/todoStore'

const props = defineProps<{ categoryId: string }>()

const todoStore = useTodoStore()

// 分类视图：只显示未完成任务
const categoryItems = computed(() =>
  todoStore.items.filter(i => i.category === props.categoryId && !i.done)
)
</script>

<template>
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
