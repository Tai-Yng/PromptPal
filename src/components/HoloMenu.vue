<script setup lang="ts">
import { computed } from 'vue'

interface Shortcut {
  id: string
  icon: string
  label: string
  type: 'app' | 'hotkey' | 'command'
  action: string
}

const props = defineProps<{
  show: boolean
  shortcuts: Shortcut[]
}>()

const emit = defineEmits<{
  (e: 'execute', action: string, type: string): void
  (e: 'close'): void
}>()

// 限制最多显示8个，围绕成一圈
const displayShortcuts = computed(() => props.shortcuts.slice(0, 8))

// 圆形布局 - 围绕桌宠
const getIconStyle = (index: number) => {
  const total = displayShortcuts.value.length || 4
  // 从上方开始，顺时针排列
  const startAngle = -90 // 从正上方开始
  const angleStep = 360 / total
  const angle = startAngle + index * angleStep
  const rad = (angle * Math.PI) / 180
  
  // 半径 - 围绕桌宠的距离
  const r = 55
  const x = r * Math.cos(rad)
  const y = r * Math.sin(rad)
  
  return {
    transform: `translate(${x}px, ${y}px)`,
    animationDelay: `${index * 50}ms`
  }
}

const handleIconClick = (shortcut: Shortcut) => {
  emit('execute', shortcut.action, shortcut.type)
}
</script>

<template>
  <Transition name="holo">
    <div v-if="show" class="holo-menu" @mouseleave="emit('close')">
      <!-- 能量环 -->
      <div class="energy-ring"></div>
      <div class="energy-ring-inner"></div>
      
      <!-- 图标容器 - 绝对居中在桌宠位置 -->
      <div class="icons-orbit">
        <button
          v-for="(shortcut, index) in displayShortcuts"
          :key="shortcut.id"
          class="orbit-icon"
          :style="getIconStyle(index)"
          :title="shortcut.label"
          @click.stop="handleIconClick(shortcut)"
        >
          <span class="icon-emoji">{{ shortcut.icon }}</span>
          <span class="icon-label">{{ shortcut.label }}</span>
        </button>
        
        <!-- 默认空状态 -->
        <template v-if="displayShortcuts.length === 0">
          <button
            v-for="i in 4"
            :key="'empty-' + i"
            class="orbit-icon empty"
            :style="getIconStyle(i - 1)"
            @click.stop="emit('close')"
          >
            <span class="icon-emoji">⚙️</span>
            <span class="icon-label">设置</span>
          </button>
        </template>
      </div>

      <!-- 中心光晕 -->
      <div class="center-glow">
        <div class="glow-core"></div>
        <div class="glow-pulse"></div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* 菜单容器 - 以桌宠为中心 */
.holo-menu {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 160px;
  height: 160px;
  pointer-events: auto;
  z-index: 9999;
}

/* 能量环 */
.energy-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 110px;
  height: 110px;
  border: 1px solid rgba(0, 212, 170, 0.3);
  border-radius: 50%;
  animation: ring-rotate 8s linear infinite;
}

.energy-ring-inner {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 90px;
  height: 90px;
  border: 1px dashed rgba(0, 245, 200, 0.2);
  border-radius: 50%;
  animation: ring-rotate-reverse 6s linear infinite;
}

@keyframes ring-rotate {
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to { transform: translate(-50%, -50%) rotate(360deg); }
}

@keyframes ring-rotate-reverse {
  from { transform: translate(-50%, -50%) rotate(360deg); }
  to { transform: translate(-50%, -50%) rotate(0deg); }
}

/* 图标轨道容器 */
.icons-orbit {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 0;
  height: 0;
}

/* 轨道上的图标 */
.orbit-icon {
  position: absolute;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: linear-gradient(145deg, rgba(0, 212, 170, 0.3), rgba(0, 150, 120, 0.2));
  border: 2px solid rgba(0, 245, 200, 0.8);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  animation: icon-orbit-in 0.3s ease-out backwards;
  box-shadow: 
    0 0 15px rgba(0, 212, 170, 0.5),
    inset 0 0 10px rgba(0, 245, 200, 0.15);
  transition: all 0.2s ease;
  margin-left: -19px; /* 居中偏移 */
  margin-top: -19px;
}

.orbit-icon:hover {
  transform: scale(1.3) !important;
  background: linear-gradient(145deg, rgba(0, 245, 200, 0.5), rgba(0, 200, 160, 0.35));
  border-color: rgba(0, 255, 220, 1);
  box-shadow: 
    0 0 25px rgba(0, 245, 200, 0.8),
    0 0 50px rgba(0, 212, 170, 0.5);
  z-index: 10;
}

.orbit-icon:active {
  transform: scale(1.1) !important;
}

@keyframes icon-orbit-in {
  0% {
    opacity: 0;
    transform: scale(0) rotate(-180deg);
  }
  70% {
    transform: scale(1.1);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.icon-emoji {
  font-size: 15px;
  line-height: 1;
  filter: drop-shadow(0 0 3px rgba(0, 245, 200, 0.6));
}

.icon-label {
  font-size: 7px;
  color: rgba(0, 245, 200, 0.95);
  white-space: nowrap;
  max-width: 34px;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 0 4px rgba(0, 0, 0, 0.5);
}

/* 中心光晕 */
.center-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 20px;
  height: 20px;
  pointer-events: none;
}

.glow-core {
  width: 100%;
  height: 100%;
  background: radial-gradient(circle at 30% 30%, #00F5C8, #00D4AA);
  border-radius: 50%;
  box-shadow: 0 0 20px rgba(0, 245, 200, 0.9);
  animation: core-pulse 1s ease-in-out infinite;
}

.glow-pulse {
  position: absolute;
  inset: -8px;
  border: 2px solid rgba(0, 245, 200, 0.4);
  border-radius: 50%;
  animation: pulse-expand 1.5s ease-out infinite;
}

@keyframes core-pulse {
  0%, 100% { 
    transform: scale(1);
    box-shadow: 0 0 15px rgba(0, 245, 200, 0.8);
  }
  50% { 
    transform: scale(1.2);
    box-shadow: 0 0 25px rgba(0, 245, 200, 1);
  }
}

@keyframes pulse-expand {
  0% { 
    transform: scale(1);
    opacity: 0.6;
  }
  100% { 
    transform: scale(3);
    opacity: 0;
  }
}

/* 过渡动画 */
.holo-enter-active {
  animation: menu-appear 0.25s ease-out;
}

.holo-leave-active {
  animation: menu-disappear 0.2s ease-in;
}

@keyframes menu-appear {
  0% { 
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.5);
  }
  100% { 
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

@keyframes menu-disappear {
  0% { 
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  100% { 
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.7);
  }
}
</style>
