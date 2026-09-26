<script setup lang="ts">
import { computed } from 'vue'
import { usePromptStore } from '../stores/promptStore'

const store = usePromptStore()

// 概览：全部由当前库实时计算，无独立存储
const totalPrompts = computed(() => store.prompts.length)
const totalUses = computed(() => store.prompts.reduce((s, p) => s + p.useCount, 0))
const favCount = computed(() => store.prompts.filter(p => p.favorite).length)
const usedPrompts = computed(() => store.prompts.filter(p => p.useCount > 0).length)

// Top 10：useCount 降序，0 次不进榜；bar 以榜首为 100%
const top10 = computed(() =>
  [...store.prompts]
    .filter(p => p.useCount > 0)
    .sort((a, b) => b.useCount - a.useCount)
    .slice(0, 10)
)
const topMax = computed(() => top10.value[0]?.useCount ?? 1)
const barWidth = (count: number) => `${Math.max(4, Math.round((count / topMax.value) * 100))}%`

// 分类分布
const catDist = computed(() => {
  const counts = new Map<string, number>()
  for (const p of store.prompts) {
    counts.set(p.category, (counts.get(p.category) || 0) + 1)
  }
  const rows = [...counts.entries()].map(([cat, count]) => ({
    cat,
    count,
    label: catLabel(cat),
    color: catColor(cat)
  }))
  rows.sort((a, b) => b.count - a.count)
  return rows
})
const catMax = computed(() => catDist.value[0]?.count ?? 1)

function catLabel(cat: string): string {
  const known = store.categories.find(c => c.id === cat)
  return known ? `${known.icon} ${known.name}` : cat
}
function catColor(cat: string): string {
  return store.categories.find(c => c.id === cat)?.color || '#6B7280'
}
</script>

<template>
  <div class="stats-page">
    <div class="stats-cmd">
      <span class="cmd-path">~/stats</span>
      <span class="cmd-sep">::</span>
      <span class="cmd-label">usage analytics</span>
    </div>

    <!-- 空库 -->
    <div v-if="totalPrompts === 0" class="stats-empty">
      <span class="empty-mark">[0]</span> no prompts yet — create some in ~/prompts first
    </div>

    <template v-else>
      <!-- 概览四数字 -->
      <div class="stat-grid">
        <div class="stat-card">
          <span class="stat-num">{{ totalPrompts }}</span>
          <span class="stat-key">prompts</span>
        </div>
        <div class="stat-card">
          <span class="stat-num">{{ totalUses }}</span>
          <span class="stat-key">total uses</span>
        </div>
        <div class="stat-card">
          <span class="stat-num">{{ usedPrompts }}</span>
          <span class="stat-key">used &gt; 0</span>
        </div>
        <div class="stat-card">
          <span class="stat-num">{{ favCount }}</span>
          <span class="stat-key">favorites</span>
        </div>
      </div>

      <!-- Top 10 -->
      <div class="section-cmd"><span class="sec-path">-- top 10 by usage --</span></div>
      <div v-if="top10.length === 0" class="stats-hint">no usage recorded yet — copy something!</div>
      <div v-else class="rank-list">
        <div v-for="(p, i) in top10" :key="p.id" class="rank-row">
          <span class="rank-idx">{{ i + 1 }}</span>
          <span class="rank-title" :title="p.title">{{ p.title }}</span>
          <div class="rank-bar-track">
            <div class="rank-bar" :style="{ width: barWidth(p.useCount) }"></div>
          </div>
          <span class="rank-count">{{ p.useCount }}x</span>
        </div>
      </div>

      <!-- 分类分布 -->
      <div class="section-cmd"><span class="sec-path">-- category distribution --</span></div>
      <div class="rank-list">
        <div v-for="row in catDist" :key="row.cat" class="rank-row">
          <span class="rank-dot" :style="{ background: row.color }"></span>
          <span class="rank-title">{{ row.label }}</span>
          <div class="rank-bar-track">
            <div class="rank-bar cat" :style="{ width: `${Math.max(4, Math.round((row.count / catMax) * 100))}%`, background: row.color }"></div>
          </div>
          <span class="rank-count">{{ row.count }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.stats-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  font-family: var(--font-mono);
  padding: 4px;
}
.stats-cmd {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 0 10px;
  margin-bottom: 14px;
  border-bottom: 1px solid var(--border-light);
  font-size: 11px;
}
.cmd-path { color: var(--terminal-green); font-weight: 600; }
.cmd-sep { color: var(--text-muted); }
.cmd-label { color: var(--text-secondary); font-size: 10px; }

.stats-empty {
  font-size: 12px;
  color: var(--text-muted);
  padding: 40px 0;
  text-align: center;
}
.empty-mark { color: var(--warning); }
.stats-hint {
  font-size: 11px;
  color: var(--text-muted);
  padding: 8px 0 14px;
}

/* ── 概览 ── */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 20px;
}
.stat-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}
.stat-num {
  font-size: 22px;
  font-weight: 700;
  color: var(--primary-light);
}
.stat-key {
  font-size: 10px;
  color: var(--text-muted);
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

/* ── 榜单 ── */
.section-cmd {
  margin-bottom: 10px;
  padding-bottom: 4px;
  border-bottom: 1px dashed var(--border-light);
}
.sec-path {
  font-size: 10px;
  color: var(--terminal-green);
  opacity: 0.7;
  letter-spacing: 0.3px;
}
.rank-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 22px;
}
.rank-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.rank-idx {
  font-size: 10px;
  color: var(--text-muted);
  min-width: 16px;
  text-align: right;
  flex-shrink: 0;
}
.rank-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-left: 8px;
}
.rank-title {
  font-size: 11px;
  color: var(--text-primary);
  min-width: 140px;
  max-width: 180px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}
.rank-bar-track {
  flex: 1;
  height: 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.rank-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--primary), var(--primary-light));
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  transition: width var(--transition-normal);
}
.rank-bar.cat { background: inherit; }
.rank-count {
  font-size: 10px;
  color: var(--text-secondary);
  min-width: 36px;
  text-align: right;
  flex-shrink: 0;
}
</style>
