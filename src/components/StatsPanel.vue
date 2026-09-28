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
        <div class="stat-card" v-for="card in [
          { num: totalPrompts, key: 'prompts', sym: '◈' },
          { num: totalUses, key: 'total uses', sym: '⚡' },
          { num: usedPrompts, key: 'used > 0', sym: '▶' },
          { num: favCount, key: 'favorites', sym: '★' }
        ]" :key="card.key">
          <span class="stat-sym">{{ card.sym }}</span>
          <span class="stat-num">{{ card.num }}</span>
          <span class="stat-key">{{ card.key }}</span>
        </div>
      </div>

      <!-- Top 10 -->
      <div class="section-cmd"><span class="sec-path">-- top 10 by usage --</span></div>
      <div v-if="top10.length === 0" class="stats-hint">no usage recorded yet — copy something!</div>
      <div v-else class="rank-list">
        <div v-for="(p, i) in top10" :key="p.id" class="rank-row" :class="{ top3: i < 3 }">
          <span class="rank-idx" :class="'medal-' + (i + 1)">{{ i + 1 }}</span>
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
  padding: 4px 4px 20px;
}
.stats-cmd {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 0 12px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--border-light);
  font-size: 11px;
}
.cmd-path { color: var(--terminal-green); font-weight: 600; }
.cmd-sep { color: var(--text-muted); }
.cmd-label { color: var(--text-secondary); font-size: 10px; }

.stats-empty {
  font-size: 12px;
  color: var(--text-muted);
  padding: 48px 0;
  text-align: center;
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-md);
}
.empty-mark { color: var(--warning); }
.stats-hint {
  font-size: 11px;
  color: var(--text-muted);
  padding: 6px 0 14px;
  font-style: italic;
}

/* ── 概览卡片 ── */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}
.stat-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 14px 16px 12px;
  background: linear-gradient(160deg, var(--bg-secondary) 0%, var(--bg-primary) 100%);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: border-color var(--transition-normal), transform var(--transition-normal);
}
.stat-card::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--primary), transparent);
  opacity: 0.7;
}
.stat-card:hover {
  border-color: var(--border-active);
  transform: translateY(-2px);
}
.stat-sym {
  font-size: 11px;
  color: var(--primary-light);
  opacity: 0.8;
}
.stat-num {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  text-shadow: 0 0 18px rgba(99, 102, 241, 0.35);
  line-height: 1.2;
}
.stat-key {
  font-size: 10px;
  color: var(--text-muted);
  letter-spacing: 1px;
  text-transform: uppercase;
}

/* ── 分节 ── */
.section-cmd {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0 14px;
}
.sec-path {
  font-size: 10px;
  color: var(--terminal-green);
  opacity: 0.8;
  letter-spacing: 0.5px;
}
.section-cmd::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, var(--border-light), transparent);
}

/* ── 榜单 ── */
.rank-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-bottom: 26px;
}
.rank-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast);
}
.rank-row:hover { background: rgba(99, 102, 241, 0.06); }
.rank-idx {
  font-size: 11px;
  color: var(--text-muted);
  min-width: 20px;
  text-align: center;
  flex-shrink: 0;
  font-weight: 600;
}
.rank-idx.medal-1 { color: #FFD700; text-shadow: 0 0 8px rgba(255, 215, 0, 0.5); }
.rank-idx.medal-2 { color: #C0C0C0; text-shadow: 0 0 6px rgba(192, 192, 192, 0.4); }
.rank-idx.medal-3 { color: #CD7F32; text-shadow: 0 0 6px rgba(205, 127, 50, 0.4); }
.rank-row.top3 .rank-title { color: var(--primary-light); }
.rank-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 6px currentColor;
  margin-left: 4px;
}
.rank-title {
  font-size: 12px;
  color: var(--text-primary);
  min-width: 150px;
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
  letter-spacing: 0.3px;
}
.rank-bar-track {
  flex: 1;
  height: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  overflow: hidden;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3);
}
.rank-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--primary) 0%, var(--primary-light) 70%, #C7D2FE 100%);
  border-radius: 6px;
  box-shadow: 0 0 10px rgba(99, 102, 241, 0.4);
  transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1);
  position: relative;
}
.rank-bar::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%);
  animation: bar-shine 2.5s ease-in-out infinite;
}
@keyframes bar-shine {
  0% { transform: translateX(-100%); }
  60%, 100% { transform: translateX(200%); }
}
.rank-bar.cat { box-shadow: 0 0 8px currentColor; }
.rank-count {
  font-size: 11px;
  color: var(--primary-light);
  min-width: 40px;
  text-align: right;
  flex-shrink: 0;
  font-weight: 600;
}
</style>
