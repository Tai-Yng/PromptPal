<script setup lang="ts">
import { ref } from 'vue'
import { useSettingsStore } from '../../stores/settingsStore'
import { usePetStyleStore, presetThemes } from '../../stores/petStyleStore'

const store = useSettingsStore()
const petStore = usePetStyleStore()
const showSaved = ref(false)
</script>

<template>
  <div class="config-section">
    <div class="section-label">
      <span class="sec-path">~/config/pet</span>
    </div>

    <!-- Theme -->
    <div class="cfg-row">
      <span class="cfg-key">theme</span>
      <span class="cfg-op">=</span>
      <div class="cfg-value theme-grid">
        <button
          v-for="t in presetThemes" :key="t.id"
          class="theme-btn"
          :class="{ active: petStore.currentThemeId === t.id }"
          @click="petStore.applyTheme(t.id)"
        >
          <span class="theme-dot" :style="{ background: t.style.primaryColor, boxShadow: `0 0 6px ${t.style.primaryColor}` }"></span>
          {{ t.name }}
        </button>
      </div>
    </div>

    <!-- Colors -->
    <div class="cfg-row">
      <span class="cfg-key">colors</span>
      <span class="cfg-op">=</span>
      <div class="cfg-value color-grid">
        <div class="color-item" v-for="c in [
          {k:'primaryColor',l:'eye'},
          {k:'secondaryColor',l:'ant'},
          {k:'bodyColor',l:'body'},
          {k:'bodyBorderColor',l:'bd'},
          {k:'visorColor',l:'vis'},
          {k:'eyeColor',l:'glw'}
        ]" :key="c.k">
          <span class="color-label">{{ c.l }}</span>
          <input
            type="color"
            :value="(petStore.currentStyle as any)[c.k]"
            class="color-pick"
            @input="petStore.updateColor(c.k as any, ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>
    </div>

    <!-- Shapes -->
    <div class="cfg-row">
      <span class="cfg-key">shape</span>
      <span class="cfg-op">=</span>
      <div class="cfg-value shape-group">
        <div class="shape-item" v-for="s in [
          {k:'headSize',l:'head'},
          {k:'bodySize',l:'body'},
          {k:'antennaHeight',l:'ant'}
        ]" :key="s.k">
          <span class="shape-label">{{ s.l }}</span>
          <input
            type="range"
            min="0.5" max="1.5" step="0.1"
            :value="petStore.currentStyle[s.k as keyof typeof petStore.currentStyle]"
            class="shape-slider"
            @input="petStore.updateShape(s.k as any, parseFloat(($event.target as HTMLInputElement).value))"
          />
          <span class="shape-val">{{ (petStore.currentStyle[s.k as keyof typeof petStore.currentStyle] as number).toFixed(1) }}</span>
        </div>
      </div>
    </div>

    <!-- Context Aware -->
    <div class="cfg-row">
      <span class="cfg-key">smart</span>
      <span class="cfg-op">=</span>
      <button
        class="toggle-char"
        :class="{ active: store.petConfig.contextAware }"
        @click="store.updatePetConfig({ contextAware: !store.petConfig.contextAware })"
      >
        {{ store.petConfig.contextAware ? '[x]' : '[ ]' }}
      </button>
      <span class="cfg-hint">detect apps &amp; suggest prompts</span>
    </div>

    <!-- Sleep timeout -->
    <div class="cfg-row">
      <span class="cfg-key">sleep</span>
      <span class="cfg-op">=</span>
      <div class="cfg-value sleep-opts">
        <button
          v-for="opt in [{l:'60s',v:60},{l:'120s',v:120},{l:'300s',v:300},{l:'600s',v:600},{l:'off',v:0}]"
          :key="opt.v"
          class="opt-btn"
          :class="{ active: store.petConfig.sleepTimeout === opt.v }"
          @click="store.updatePetConfig({ sleepTimeout: opt.v })"
        >
          {{ opt.l }}
        </button>
      </div>
    </div>

    <!-- Walk speed -->
    <div class="cfg-row">
      <span class="cfg-key">speed</span>
      <span class="cfg-op">=</span>
      <div class="cfg-value speed-row">
        <input
          type="range"
          min="0.1" max="1" step="0.1"
          :value="store.petConfig.walkSpeed"
          class="speed-slider"
          @input="store.updatePetConfig({ walkSpeed: parseFloat(($event.target as HTMLInputElement).value) })"
        />
        <span class="speed-val">{{ store.petConfig.walkSpeed.toFixed(1) }}x</span>
      </div>
    </div>

    <!-- Click copy -->
    <div class="cfg-row">
      <span class="cfg-key">copy</span>
      <span class="cfg-op">=</span>
      <button
        class="toggle-char"
        :class="{ active: store.petConfig.dblClickCopy }"
        @click="store.updatePetConfig({ dblClickCopy: !store.petConfig.dblClickCopy })"
      >
        {{ store.petConfig.dblClickCopy ? '[x]' : '[ ]' }}
      </button>
      <span class="cfg-hint">click pet to copy default prompt</span>
    </div>

    <!-- Save & Status -->
    <div class="cfg-row">
      <span class="cfg-key"></span>
      <span class="cfg-op"></span>
      <div class="cfg-value save-row">
        <button class="save-btn" @click="petStore.saveToStorage(); store.saveToStorage(); showSaved = true; setTimeout(() => showSaved = false, 1500)">
          <span class="save-sym">$</span> save config
        </button>
        <Transition name="flash">
          <span v-if="showSaved" class="saved-msg">[OK] saved</span>
        </Transition>
      </div>
    </div>

    <div class="status-msg" :class="{ ok: store.petConfig.contextAware }">
      <span class="status-prefix">[{{ store.petConfig.contextAware ? 'ON' : 'OFF' }}]</span>
      {{ store.petConfig.contextAware ? 'smart mode active' : 'smart mode disabled' }}
    </div>
  </div>
</template>

<style scoped>
/* ── Theme Grid ── */
.theme-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}
.theme-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border: 1px solid var(--border-color);
  background: transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-normal);
}
.theme-btn:hover { border-color: var(--text-muted); color: var(--text-secondary); }
.theme-btn.active {
  border-color: var(--primary);
  color: var(--primary-light);
  background: rgba(99, 102, 241, 0.08);
}
.theme-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* ── Color Grid ── */
.color-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.color-item {
  display: flex;
  align-items: center;
  gap: 4px;
}
.color-label {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--text-muted);
  min-width: 20px;
}
.color-pick {
  width: 28px;
  height: 22px;
  border: 1px solid var(--border-color);
  border-radius: 3px;
  cursor: pointer;
  padding: 1px;
  background: transparent;
}
.color-pick::-webkit-color-swatch-wrapper { padding: 0; }
.color-pick::-webkit-color-swatch { border: none; border-radius: 2px; }

/* ── Shape ── */
.shape-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.shape-item {
  display: flex;
  align-items: center;
  gap: 8px;
}
.shape-label {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-muted);
  min-width: 28px;
}
.shape-slider { flex: 1; accent-color: var(--primary); height: 4px; }
.shape-val {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--primary-light);
  min-width: 22px;
  text-align: right;
}

/* ── Sleep ── */
.sleep-opts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* ── Speed ── */
.speed-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.speed-slider { flex: 1; accent-color: var(--primary); }
.speed-val {
  font-size: 12px;
  color: var(--primary-light);
  min-width: 32px;
  text-align: right;
}
</style>
