<script setup lang="ts">
import { ref, computed } from 'vue'
import { usePetStyleStore, presetThemes } from '../stores/petStyleStore'

const store = usePetStyleStore()
const activeTab = ref<'themes' | 'colors' | 'sprite'>('themes')
const fileInput = ref<HTMLInputElement | null>(null)

// 颜色配置项
const colorFields = [
  { key: 'primaryColor', label: 'primary', desc: 'Eyes & core' },
  { key: 'secondaryColor', label: 'secondary', desc: 'Antenna ball' },
  { key: 'bodyColor', label: 'body', desc: 'Main body' },
  { key: 'bodyBorderColor', label: 'border', desc: 'Body outline' },
  { key: 'visorColor', label: 'visor', desc: 'Face screen' },
  { key: 'eyeColor', label: 'eye glow', desc: 'Eye highlight' }
] as const

// 处理文件上传
const handleFileUpload = (e: Event) => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (event) => {
    const imageUrl = event.target?.result as string
    // 默认假设是 Petdex/Codex 格式的精灵图
    // 实际使用时可以通过解析 pet.json 获取准确尺寸
    store.importSprite({
      imageUrl,
      frameWidth: 32,
      frameHeight: 32,
      frames: 4
    })
  }
  reader.readAsDataURL(file)
}

// 从 URL 导入
const importFromUrl = ref('')
const handleUrlImport = () => {
  if (!importFromUrl.value) return
  store.importSprite({
    imageUrl: importFromUrl.value,
    frameWidth: 32,
    frameHeight: 32,
    frames: 4
  })
  importFromUrl.value = ''
}
</script>

<template>
  <div class="pet-style-settings">
    <!-- 标签页 -->
    <div class="style-tabs">
      <button
        class="style-tab"
        :class="{ active: activeTab === 'themes' }"
        @click="activeTab = 'themes'"
      >
        🎨 Themes
      </button>
      <button
        class="style-tab"
        :class="{ active: activeTab === 'colors' }"
        @click="activeTab = 'colors'"
      >
        🎨 Colors
      </button>
      <button
        class="style-tab"
        :class="{ active: activeTab === 'sprite' }"
        @click="activeTab = 'sprite'"
      >
        🖼 Sprite
      </button>
    </div>

    <!-- 预设主题 -->
    <div v-if="activeTab === 'themes'" class="tab-content">
      <div class="themes-grid">
        <button
          v-for="theme in presetThemes"
          :key="theme.id"
          class="theme-card"
          :class="{ active: store.currentThemeId === theme.id && !store.useCustomSprite }"
          @click="store.applyTheme(theme.id)"
        >
          <span class="theme-icon">{{ theme.icon }}</span>
          <span class="theme-name">{{ theme.name }}</span>
          <div class="theme-preview">
            <span
              class="color-dot"
              :style="{ background: theme.style.primaryColor }"
            ></span>
            <span
              class="color-dot"
              :style="{ background: theme.style.bodyColor }"
            ></span>
            <span
              class="color-dot"
              :style="{ background: theme.style.secondaryColor }"
            ></span>
          </div>
        </button>
      </div>
    </div>

    <!-- 自定义颜色 -->
    <div v-if="activeTab === 'colors'" class="tab-content">
      <div class="color-list">
        <div
          v-for="field in colorFields"
          :key="field.key"
          class="color-item"
        >
          <div class="color-info">
            <label class="color-label">{{ field.label }}</label>
            <span class="color-desc">{{ field.desc }}</span>
          </div>
          <div class="color-input-wrapper">
            <input
              type="color"
              :value="store.currentStyle[field.key]"
              class="color-picker"
              @input="(e) => store.updateColor(field.key, (e.target as HTMLInputElement).value)"
            />
            <input
              type="text"
              :value="store.currentStyle[field.key]"
              class="color-text"
              @input="(e) => store.updateColor(field.key, (e.target as HTMLInputElement).value)"
            />
          </div>
        </div>
      </div>

      <!-- 形状参数 -->
      <div class="shape-section">
        <h4 class="section-subtitle">Shape</h4>
        <div class="shape-item">
          <label>head size</label>
          <input
            type="range"
            min="0.5"
            max="1.5"
            step="0.1"
            :value="store.currentStyle.headSize"
            @input="(e) => store.updateShape('headSize', parseFloat((e.target as HTMLInputElement).value))"
          />
          <span>{{ store.currentStyle.headSize.toFixed(1) }}x</span>
        </div>
        <div class="shape-item">
          <label>body size</label>
          <input
            type="range"
            min="0.5"
            max="1.5"
            step="0.1"
            :value="store.currentStyle.bodySize"
            @input="(e) => store.updateShape('bodySize', parseFloat((e.target as HTMLInputElement).value))"
          />
          <span>{{ store.currentStyle.bodySize.toFixed(1) }}x</span>
        </div>
        <div class="shape-item">
          <label>antenna</label>
          <input
            type="range"
            min="0.5"
            max="1.5"
            step="0.1"
            :value="store.currentStyle.antennaHeight"
            @input="(e) => store.updateShape('antennaHeight', parseFloat((e.target as HTMLInputElement).value))"
          />
          <span>{{ store.currentStyle.antennaHeight.toFixed(1) }}x</span>
        </div>
      </div>
    </div>

    <!-- 精灵图导入 -->
    <div v-if="activeTab === 'sprite'" class="tab-content">
      <div class="sprite-section">
        <h4 class="section-subtitle">Import from Petdex / Codex</h4>
        <p class="sprite-hint">
          Upload a spritesheet image or paste a URL.<br>
          Supports Petdex and Codex pet formats.
        </p>

        <!-- 文件上传 -->
        <div class="upload-area">
          <input
            ref="fileInput"
            type="file"
            accept="image/*,.webp,.png"
            class="file-input"
            @change="handleFileUpload"
          />
          <button class="upload-btn" @click="fileInput?.click()">
            📁 Choose File
          </button>
        </div>

        <!-- URL 输入 -->
        <div class="url-import">
          <span class="url-label">or paste URL:</span>
          <div class="url-row">
            <input
              v-model="importFromUrl"
              type="text"
              class="url-input"
              placeholder="https://..."
            />
            <button class="url-btn" @click="handleUrlImport">Import</button>
          </div>
        </div>

        <!-- 当前状态 -->
        <div v-if="store.useCustomSprite" class="sprite-status">
          <span class="status-icon">✓</span>
          <span>Custom sprite active</span>
          <button class="clear-btn" @click="store.clearSprite">Clear</button>
        </div>

        <!-- 帮助链接 -->
        <div class="help-links">
          <a href="https://codex-pet.org/zh/" target="_blank" class="help-link">
            Browse Codex Pets →
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pet-style-settings {
  font-family: var(--font-mono);
}

/* 标签页 */
.style-tabs {
  display: flex;
  gap: 4px;
  padding: 0 16px;
  border-bottom: 1px solid var(--border-color);
}

.style-tab {
  padding: 8px 16px;
  border: none;
  background: transparent;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-muted);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.15s ease;
}

.style-tab:hover {
  color: var(--text-secondary);
}

.style-tab.active {
  color: var(--primary-color);
  border-bottom-color: var(--primary-color);
}

/* 内容区 */
.tab-content {
  padding: 16px;
  max-height: 300px;
  overflow-y: auto;
}

/* 主题网格 */
.themes-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.theme-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px;
  border: 1px solid var(--border-color);
  background: transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s ease;
}

.theme-card:hover {
  border-color: var(--text-muted);
}

.theme-card.active {
  border-color: var(--primary-color);
  background: rgba(0, 212, 170, 0.08);
}

.theme-icon {
  font-size: 24px;
}

.theme-name {
  font-size: 11px;
  color: var(--text-secondary);
}

.theme-preview {
  display: flex;
  gap: 4px;
}

.color-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* 颜色列表 */
.color-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.color-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid rgba(30, 58, 95, 0.3);
}

.color-item:last-child {
  border-bottom: none;
}

.color-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.color-label {
  font-size: 12px;
  color: var(--text-primary);
  text-transform: lowercase;
}

.color-desc {
  font-size: 10px;
  color: var(--text-muted);
}

.color-input-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-picker {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  background: transparent;
}

.color-picker::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-picker::-webkit-color-swatch {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
}

.color-text {
  width: 80px;
  padding: 6px 8px;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-primary);
  text-transform: uppercase;
}

/* 形状参数 */
.shape-section {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

.section-subtitle {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 12px;
  text-transform: lowercase;
}

.shape-item {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.shape-item label {
  width: 80px;
  font-size: 11px;
  color: var(--text-muted);
}

.shape-item input[type="range"] {
  flex: 1;
  height: 4px;
  background: var(--border-color);
  border-radius: 2px;
  outline: none;
  -webkit-appearance: none;
}

.shape-item input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  background: var(--primary-color);
  border-radius: 50%;
  cursor: pointer;
}

.shape-item span {
  width: 40px;
  font-size: 11px;
  color: var(--text-secondary);
  text-align: right;
}

/* 精灵图导入 */
.sprite-section {
  text-align: center;
}

.sprite-hint {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.5;
  margin-bottom: 16px;
}

.upload-area {
  margin-bottom: 16px;
}

.file-input {
  display: none;
}

.upload-btn {
  padding: 10px 20px;
  border: 1px solid var(--border-color);
  background: transparent;
  border-radius: var(--radius-md);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.upload-btn:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.url-import {
  margin-bottom: 16px;
}

.url-label {
  display: block;
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.url-row {
  display: flex;
  gap: 8px;
}

.url-input {
  flex: 1;
  padding: 8px 12px;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-primary);
  outline: none;
}

.url-input:focus {
  border-color: var(--primary-color);
}

.url-btn {
  padding: 8px 16px;
  border: 1px solid var(--primary-color);
  background: transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--primary-color);
  cursor: pointer;
  transition: all 0.15s ease;
}

.url-btn:hover {
  background: var(--primary-color);
  color: var(--bg-primary);
}

.sprite-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: var(--radius-sm);
  margin-bottom: 16px;
  font-size: 12px;
  color: var(--success-color);
}

.status-icon {
  font-weight: bold;
}

.clear-btn {
  margin-left: auto;
  padding: 2px 8px;
  border: 1px solid var(--error-color);
  background: transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--error-color);
  cursor: pointer;
}

.clear-btn:hover {
  background: var(--error-color);
  color: white;
}

.help-links {
  margin-top: 20px;
}

.help-link {
  font-size: 12px;
  color: var(--primary-color);
  text-decoration: none;
  opacity: 0.8;
  transition: opacity 0.15s ease;
}

.help-link:hover {
  opacity: 1;
  text-decoration: underline;
}
</style>
