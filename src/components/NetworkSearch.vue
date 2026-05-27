<script setup lang="ts">
import { openUrl } from '../services/platform'

const promptSites = [
  { name: 'PromptHero', url: 'https://prompthero.com/', desc: 'AI Prompt Library - Midjourney, SD, ChatGPT', tags: ['image', 'chat'] },
  { name: 'FlowGPT', url: 'https://flowgpt.com/', desc: 'ChatGPT Prompt Community', tags: ['chat', 'community'] },
  { name: 'OpenArt', url: 'https://openart.ai/', desc: 'AI Art Prompts & Gallery', tags: ['image', 'art'] },
  { name: 'Lexica', url: 'https://lexica.art/', desc: 'Stable Diffusion Search Engine', tags: ['image', 'search'] },
  { name: 'PublicPrompts', url: 'https://publicprompts.art/', desc: 'Free Quality Prompt Collection', tags: ['image', 'free'] },
  { name: 'Snoozy AI', url: 'https://snoozy.io/', desc: 'Midjourney Prompt Resources', tags: ['image', 'mj'] },
  { name: 'Learning Prompt', url: 'https://learningprompt.wiki/', desc: 'Chinese Prompt Tutorial', tags: ['cn', 'learn'] },
  { name: 'Awesome ChatGPT', url: 'https://github.com/f/awesome-chatgpt-prompts', desc: 'GitHub Prompt Collection', tags: ['github', 'list'] }
]

const handleOpenSite = async (url: string) => {
  try { await openUrl(url) } catch { window.open(url, '_blank') }
}
</script>

<template>
  <div class="ext-panel">
    <div class="ext-cmd">
      <span class="cmd-path">~/ext</span>
      <span class="cmd-sep">::</span>
      <span class="cmd-label">external prompt resources</span>
    </div>

    <div class="ext-grid">
      <div
        v-for="site in promptSites" :key="site.name"
        class="ext-card"
        @click="handleOpenSite(site.url)"
      >
        <div class="ext-card-header">
          <span class="ext-url-icon">&lt;a&gt;</span>
          <span class="ext-name">{{ site.name }}</span>
        </div>
        <p class="ext-desc">{{ site.desc }}</p>
        <div class="ext-tags">
          <span v-for="tag in site.tags" :key="tag" class="tag">{{ tag }}</span>
        </div>
      </div>
    </div>

    <div class="ext-footer">
      <span class="footer-hint">click to open in browser</span>
    </div>
  </div>
</template>

<style scoped>
.ext-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-family: var(--font-mono);
  overflow-y: auto;
}

.ext-cmd {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 0 10px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--border-light);
  font-size: 11px;
}
.cmd-path { color: var(--terminal-green); font-weight: 600; }
.cmd-sep { color: var(--text-muted); }
.cmd-label { color: var(--text-secondary); font-size: 10px; }

.ext-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
}

.ext-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  cursor: pointer;
  transition: all var(--transition-normal);
}
.ext-card:hover {
  border-color: var(--border-active);
  box-shadow: var(--glow-sm);
  transform: translateY(-1px);
}
.ext-card-header {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 6px;
}
.ext-url-icon {
  font-size: 9px;
  color: var(--primary-light);
  background: rgba(99, 102, 241, 0.1);
  padding: 1px 5px;
  border-radius: 2px;
  border: 1px solid rgba(99, 102, 241, 0.2);
}
.ext-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: 0.3px;
}
.ext-desc {
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin: 0 0 10px 0;
  min-height: 32px;
}
.ext-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.ext-footer {
  margin-top: auto;
  padding-top: 14px;
  text-align: center;
}
.footer-hint {
  font-size: 10px;
  color: var(--text-muted);
}
</style>
