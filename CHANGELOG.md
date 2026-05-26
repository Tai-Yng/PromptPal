# Changelog

All notable changes to PromptPal will be documented in this file.

---

## v1.1.0 (2026-05-26)

### Added
- **Native CLI tool** (`pal.exe`) bundled with installer — no Node.js required
- Auto PATH registration on first launch (PowerShell `SetEnvironmentVariable`)
- `pal` command: interactive arrow-key prompt selector with category grouping
- Clipboard via temporary file + PowerShell `Set-Clipboard` (UTF-8 safe)
- Auto-export to `~/.promptpal/promptpal_data.json` on every prompt change (2s debounce)

### Fixed
- Pet config (walkSpeed, sleepTimeout, colors, shapes) now applies immediately without restart
- Sleep timer reads from `settingsStore.petConfig.sleepTimeout` dynamically
- Walk speed reads from `settingsStore.petConfig.walkSpeed` dynamically
- App exit: tray right-click menu (Show Panel / Exit PromptPal), pet right-click (Exit), Settings button

### Changed
- README and docs fully rewritten for accuracy
- AI models updated: DeepSeek (V3, V4, Reasoner), OpenAI (GPT-4.1, 4o, o4-mini), Claude (Sonnet 4)
- Removed unused files: `src/history/` (111 files, 12MB), `HoloMenu.vue`, `PetStyleSettings.vue`
- Removed custom sprite import UI (not yet implemented)

---

## v1.0.0 (2026-05-26)

### Added
- DeepSeek CMD terminal dark theme (JetBrains Mono, blue-purple accents, `>` prompts)
- Desktop pet: CSS-drawn robot with antenna, visor, glowing eyes
- 8 preset themes (Cyan Tech, Crimson Bot, Emerald Unit, Violet Core, Amber Droid, Rose Companion, Golden Bot, Arctic Unit)
- Customizable colors, body shapes, and proportions via CSS variables
- Pet behaviors: auto-walk, random pauses (6%), direction changes (2%), hops (1.5%), speed jitter
- Context-aware window detection (ChatGPT, VS Code, Midjourney, Obsidian, etc.) with bubble suggestions
- Drag-to-reposition pet with position persistence
- Prompt management: create, edit, delete, favorite, category tagging
- Card preview (click to expand/collapse, double-click to copy)
- Usage count tracking
- AI generation (DeepSeek / OpenAI / Claude / Custom) with streaming output
- Quick inject: `Ctrl+Alt+P` global hotkey, arrow-navigate, Enter to copy
- Settings panel: AI config, pet config, sync config
- Gitee cloud sync (push/pull/verify via Rust `ureq`, POST for new files, PUT for updates)
- Local JSON import/export (Blob download + FileReader)
- Local file sync (`~/.promptpal/promptpal_data.json`)
- Tauri 2.x (Rust backend) with system tray, transparent windows, global shortcuts
- Windows NSIS and MSI installer packages
- System tray with left-click to show/hide panel

### Fixed
- PromptCard content truncation (`overflow: hidden` → `visible`)
- Removed flashing cursor animation from cards
- Gitee sync: CORS solved via Rust backend proxy
- Gitee sync: POST/PUT logic corrected for new vs existing files
- Settings: v-model binding fix for Gitee form fields

### Changed
- Full UI redesign from pink anime-style to DeepSeek terminal aesthetics
- Desktop pet: all hardcoded colors replaced with CSS custom properties
- Pet window positioned at bottom-right corner
- Panel window close → hide instead of quit
- `@tauri-apps/plugin-dialog` / `plugin-fs` removed (replaced with browser-native file API)

---

## v0.x (Pre-release, 2026-05-17)

### Added
- Initial Vue 3 + Tauri scaffold
- Basic pet rendering
- LocalStorage-based prompt storage
- Inline AI generation integration
- Experimented with CMD terminal styling
