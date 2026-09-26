<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useSettingsStore } from '../../stores/settingsStore'
import { usePetStyleStore, presetThemes, type SpriteFrameMap, type SpriteFrameRate } from '../../stores/petStyleStore'
import { isTauri } from '../../services/platform'
import { stitchFrames, stitchFromZip } from '../../services/spriteStitch'
import { installAgent, uninstallAgent, agentStatus, type AgentId, type LinkStatus } from '../../services/agentInstaller'

// ===== AI 代理接入（v1.6） =====
const agentRows = ref<Array<{ id: AgentId; label: string }>>([
  { id: 'zcode', label: 'ZCode' },
  { id: 'claude', label: 'Claude Code' },
  { id: 'codex', label: 'Codex' }
])
const agentStates = ref<Record<string, LinkStatus>>({})
const agentBusy = ref('')
const agentMsg = ref('')

const statusLabel = (st: LinkStatus) => ({
  linked: 'linked',
  partial: 'partial',
  'not-installed': 'not installed',
  missing: 'config missing'
}[st])

const refreshAgentStatus = async () => {
  if (!isTauri()) return
  for (const row of agentRows.value) {
    agentStates.value[row.id] = await agentStatus(row.id)
  }
}

const toggleAgent = async (id: AgentId) => {
  if (agentBusy.value) return
  agentBusy.value = id
  agentMsg.value = '...'
  try {
    const current = agentStates.value[id]
    if (current === 'linked') {
      await uninstallAgent(id)
      agentMsg.value = `[OK] ${id} unlinked`
    } else {
      await installAgent(id)
      agentMsg.value = `[OK] ${id} linked`
    }
  } catch (e: any) {
    agentMsg.value = `[ERR] ${String(e).slice(0, 80)}`
  } finally {
    agentBusy.value = ''
    await refreshAgentStatus()
  }
}

watch(() => store.petConfig.agentLink, (on) => {
  if (on) void refreshAgentStatus()
}, { immediate: true })

const store = useSettingsStore()
const petStore = usePetStyleStore()
const showSaved = ref(false)

// ===== 精灵造型导入（v1.4） =====
const MAX_SPRITE_BYTES = 5 * 1024 * 1024
const fileInputRef = ref<HTMLInputElement | null>(null)
const importing = ref(false)
const importError = ref('')
const pending = ref<{ dataUrl: string; base64: string; path: string } | null>(null)
// ZIP+XML 自动映射的帧列表（enable 时优先于手填区间写入）
const autoWalk = ref<number[] | undefined>(undefined)
const autoIdle = ref<number[] | undefined>(undefined)
const autoSleep = ref<number[] | undefined>(undefined)

const fw = ref(32)
const fh = ref(32)
const frames = ref(4)
const walkStart = ref(1)
const walkCount = ref(4)
const idleEnabled = ref(false)
const idleStart = ref(1)
const idleCount = ref(1)
const sleepEnabled = ref(false)
const sleepStart = ref(1)
const sleepCount = ref(1)
const rate = ref<SpriteFrameRate>(8)

const pickFile = () => fileInputRef.value?.click()

// 多选导入：散帧 PNG（Shimeji img/ 目录全选）→ 自动横向拼条 + 预填参数
// 导入分流：ZIP 整包（自动映射）/ 多选散帧 PNG（手填）
const handleFile = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files || [])
  input.value = ''
  if (files.length === 0) return
  importError.value = ''
  if (files.length === 1 && /\.zip$/i.test(files[0].name)) {
    await importZip(files[0])
    return
  }
  await importFrames(files)
}

const importZip = async (file: File) => {
  if (file.size > 50 * 1024 * 1024) {
    importError.value = `[ERR] zip ${(file.size / 1024 / 1024).toFixed(0)}MB > 50MB`
    return
  }
  importing.value = true
  try {
    const buf = await file.arrayBuffer()
    const stitched = await stitchFromZip(buf)
    const outBytes = Math.ceil(stitched.dataUrl.length * 0.75)
    if (outBytes > MAX_SPRITE_BYTES) {
      importError.value = `[ERR] stitched sheet ${(outBytes / 1024 / 1024).toFixed(1)}MB > 5MB — use fewer frames`
      return
    }
    const base64 = stitched.dataUrl.split(',')[1] || ''
    let path = ''
    if (isTauri()) {
      path = await invoke<string>('save_pet_sprite', { data: base64 })
    }
    pending.value = { dataUrl: stitched.dataUrl, base64, path }
    fw.value = stitched.frameWidth
    fh.value = stitched.frameHeight
    frames.value = stitched.frames
    // XML 自动映射命中：预填帧列表（用户可改）；未命中回落 walk 全帧
    const am = stitched.autoMapping
    walkStart.value = am?.walk?.[0] ?? 1
    walkCount.value = am?.walk ? am.walk[am.walk.length - 1] - am.walk[0] + 1 : stitched.frames
    autoWalk.value = am?.walk
    autoIdle.value = am?.idle
    autoSleep.value = am?.sleep
    idleEnabled.value = !!am?.idle
    sleepEnabled.value = !!am?.sleep
    if (am?.idle) { idleStart.value = Math.min(...am.idle); idleCount.value = Math.max(...am.idle) - Math.min(...am.idle) + 1 }
    if (am?.sleep) { sleepStart.value = Math.min(...am.sleep); sleepCount.value = Math.max(...am.sleep) - Math.min(...am.sleep) + 1 }
    if (!am) importError.value = ''
  } catch (err: any) {
    importError.value = `[ERR] ${String(err).slice(0, 80)}`
  } finally {
    importing.value = false
  }
}

const importFrames = async (files: File[]) => {
  for (const f of files) {
    if (!['image/png', 'image/webp'].includes(f.type)) {
      importError.value = `[ERR] ${f.name}: only PNG / WebP`
      return
    }
    if (f.size > MAX_SPRITE_BYTES) {
      importError.value = `[ERR] ${f.name}: ${(f.size / 1024 / 1024).toFixed(1)}MB > 5MB`
      return
    }
  }
  try {
    const dataUrls = await Promise.all(files.map(f => new Promise<string>((res, rej) => {
      const r = new FileReader()
      r.onload = () => res(r.result as string)
      r.onerror = () => rej(new Error('read failed'))
      r.readAsDataURL(f)
    })))
    const inputs = files.map((f, i) => ({ name: f.name, dataUrl: dataUrls[i] }))
    const stitched = files.length === 1
      ? await (async () => {
          // 单图：视作已是 sprite sheet，直接用
          const img = await new Promise<HTMLImageElement>((res, rej) => {
            const im = new Image()
            im.onload = () => res(im)
            im.onerror = () => rej(new Error('decode failed'))
            im.src = dataUrls[0]
          })
          return { dataUrl: dataUrls[0], frameWidth: img.width, frameHeight: img.height, frames: 1 }
        })()
      : await stitchFrames(inputs)

    // 拼条结果过 5MB 关（save_pet_sprite 的上限）
    const outBytes = Math.ceil(stitched.dataUrl.length * 0.75)
    if (outBytes > MAX_SPRITE_BYTES) {
      importError.value = `[ERR] stitched sheet ${(outBytes / 1024 / 1024).toFixed(1)}MB > 5MB — import fewer frames`
      return
    }

    const base64 = stitched.dataUrl.split(',')[1] || ''
    let path = ''
    if (isTauri()) {
      path = await invoke<string>('save_pet_sprite', { data: base64 })
    }
    pending.value = { dataUrl: stitched.dataUrl, base64, path }
    // 预填：帧尺寸/总帧数来自拼条，walk 预填全帧，用户可调
    fw.value = stitched.frameWidth
    fh.value = stitched.frameHeight
    frames.value = stitched.frames
    walkStart.value = 1
    walkCount.value = stitched.frames
    autoWalk.value = undefined
    autoIdle.value = undefined
    autoSleep.value = undefined
    idleEnabled.value = false
    sleepEnabled.value = false
  } catch (err: any) {
    importError.value = `[ERR] ${String(err).slice(0, 80)}`
  } finally {
    importing.value = false
  }
}

const cancelPending = () => { pending.value = null; importError.value = '' }

// 1-based 帧号钳制：保起始帧、缩帧数
const clampRange = (start: number, count: number) => {
  const total = Math.max(1, Math.floor(frames.value) || 1)
  const s = Math.min(Math.max(1, Math.floor(start) || 1), total)
  const c = Math.min(Math.max(1, Math.floor(count) || 1), total - s + 1)
  return { start: s, count: c }
}

const buildFrameMap = (): SpriteFrameMap => {
  // 自动映射的帧列表优先（ZIP+XML 来源）；手填区间兜底
  const map: SpriteFrameMap = {
    walk: autoWalk.value && autoWalk.value.length > 0
      ? { start: autoWalk.value[0], count: 1, frames: [...autoWalk.value] }
      : clampRange(walkStart.value, walkCount.value)
  }
  if (idleEnabled.value) {
    map.idle = autoIdle.value && autoIdle.value.length > 0
      ? { start: autoIdle.value[0], count: 1, frames: [...autoIdle.value] }
      : clampRange(idleStart.value, idleCount.value)
  }
  if (sleepEnabled.value) {
    map.sleep = autoSleep.value && autoSleep.value.length > 0
      ? { start: autoSleep.value[0], count: 1, frames: [...autoSleep.value] }
      : clampRange(sleepStart.value, sleepCount.value)
  }
  return map
}

const applySprite = () => {
  if (!pending.value) return
  petStore.setSprite({
    path: pending.value.path || undefined,
    dataUrl: pending.value.path ? undefined : pending.value.dataUrl,
    frameWidth: Math.max(1, Math.floor(fw.value) || 1),
    frameHeight: Math.max(1, Math.floor(fh.value) || 1),
    frames: Math.max(1, Math.floor(frames.value) || 1),
    frameMap: buildFrameMap(),
    frameRate: rate.value
  })
  pending.value = null
}

const restoreRobot = () => petStore.clearSprite()

// 实时预览：按 walk 序列 + 当前帧率切帧
const previewFrame = ref(1)
let previewTimer: number | null = null
const startPreview = () => {
  if (previewTimer) { clearInterval(previewTimer); previewTimer = null }
  if (!pending.value) return
  const { start, count } = clampRange(walkStart.value, walkCount.value)
  previewFrame.value = start
  previewTimer = window.setInterval(() => {
    const r = clampRange(walkStart.value, walkCount.value)
    previewFrame.value = previewFrame.value >= r.start + r.count - 1 ? r.start : previewFrame.value + 1
  }, 1000 / rate.value)
}
watch([pending, fw, walkStart, walkCount, rate], startPreview)
onUnmounted(() => { if (previewTimer) clearInterval(previewTimer) })

const previewStyle = computed(() => pending.value ? ({
  width: `${Math.max(1, Math.floor(fw.value) || 1)}px`,
  height: `${Math.max(1, Math.floor(fh.value) || 1)}px`,
  backgroundImage: `url("${pending.value.dataUrl}")`,
  backgroundRepeat: 'no-repeat' as const,
  backgroundPosition: `-${(previewFrame.value - 1) * Math.max(1, Math.floor(fw.value) || 1)}px 0`
}) : {})
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

    <!-- Agent Link -->
    <div class="cfg-row">
      <span class="cfg-key">agents</span>
      <span class="cfg-op">=</span>
      <div class="cfg-value agent-block">
        <button
          class="toggle-char"
          :class="{ active: store.petConfig.agentLink }"
          @click="store.updatePetConfig({ agentLink: !store.petConfig.agentLink })"
        >
          {{ store.petConfig.agentLink ? '[x]' : '[ ]' }}
        </button>
        <span class="cfg-hint">pet reflects AI agent state (zcode / claude / codex)</span>
        <div v-if="store.petConfig.agentLink" class="agent-rows">
          <div v-for="row in agentRows" :key="row.id" class="agent-row">
            <span class="agent-name">{{ row.label }}</span>
            <span class="agent-status" :class="agentStates[row.id]">{{ statusLabel(agentStates[row.id] || 'not-installed') }}</span>
            <button
              class="sprite-btn sm"
              :disabled="agentBusy === row.id || agentStates[row.id] === 'missing'"
              @click="toggleAgent(row.id)"
            >
              {{ agentStates[row.id] === 'linked' ? 'unlink' : 'link' }}
            </button>
          </div>
          <div v-if="agentMsg" class="sprite-err ok">{{ agentMsg }}</div>
        </div>
      </div>
    </div>

    <!-- Sprite Skin -->
    <div class="cfg-row sprite-row">
      <span class="cfg-key">skin</span>
      <span class="cfg-op">=</span>
      <div class="cfg-value sprite-block">
        <input
          ref="fileInputRef"
          type="file"
          accept="image/png,image/webp,.zip"
          multiple
          style="display: none"
          @change="handleFile"
        />

        <!-- 已启用精灵 -->
        <template v-if="petStore.useCustomSprite">
          <div class="sprite-active">
            <span class="sprite-ok">[SPRITE]</span> custom skin active
          </div>
          <button class="sprite-btn" @click="restoreRobot">
            <span class="btn-sym">$</span> restore default robot
          </button>
        </template>

        <!-- 未启用：导入 + 配置表单 -->
        <template v-else>
          <button class="sprite-btn" :disabled="importing" @click="pickFile">
            <span class="btn-sym">$</span> {{ importing ? 'stitching...' : 'import ZIP pack (auto frame mapping) or multi-select PNGs' }}
          </button>
          <div v-if="importError" class="sprite-err">{{ importError }}</div>

          <div v-if="pending" class="sprite-form">
            <div class="sprite-preview-row">
              <div class="sprite-preview" :style="previewStyle"></div>
              <span class="preview-hint">walk preview · single-row sheet<br/>frames from Shimeji packs work (check license)</span>
            </div>

            <div class="sprite-grid">
              <label class="sg-item">frame_w <input v-model.number="fw" type="number" min="1" class="sprite-input" /></label>
              <label class="sg-item">frame_h <input v-model.number="fh" type="number" min="1" class="sprite-input" /></label>
              <label class="sg-item">frames <input v-model.number="frames" type="number" min="1" class="sprite-input" /></label>
              <label class="sg-item">fps
                <select v-model.number="rate" class="sprite-select">
                  <option :value="4">4</option>
                  <option :value="8">8</option>
                  <option :value="12">12</option>
                  <option :value="16">16</option>
                </select>
              </label>
            </div>

            <div class="sprite-grid">
              <label class="sg-item">walk <input v-model.number="walkStart" type="number" min="1" class="sprite-input sm" /> → <input v-model.number="walkCount" type="number" min="1" class="sprite-input sm" /></label>
              <label class="sg-item"><input v-model="idleEnabled" type="checkbox" class="sprite-check" /> idle <input v-model.number="idleStart" type="number" min="1" :disabled="!idleEnabled" class="sprite-input sm" /> → <input v-model.number="idleCount" type="number" min="1" :disabled="!idleEnabled" class="sprite-input sm" /></label>
              <label class="sg-item"><input v-model="sleepEnabled" type="checkbox" class="sprite-check" /> sleep <input v-model.number="sleepStart" type="number" min="1" :disabled="!sleepEnabled" class="sprite-input sm" /> → <input v-model.number="sleepCount" type="number" min="1" :disabled="!sleepEnabled" class="sprite-input sm" /></label>
            </div>

            <div class="sprite-actions">
              <button class="sprite-btn primary" @click="applySprite"><span class="btn-sym">$</span> enable skin</button>
              <button class="sprite-btn" @click="cancelPending">cancel</button>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Colors -->
    <div v-if="!petStore.useCustomSprite" class="cfg-row">
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
    <div v-if="!petStore.useCustomSprite" class="cfg-row">
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
