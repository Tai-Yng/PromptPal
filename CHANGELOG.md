# Changelog

All notable changes to PromptPal will be documented in this file.

---

## v1.4.0 (2026-09-25)

### Added
- **Custom pet skin**: import a single-row sprite sheet (PNG/WebP ≤ 5MB, Shimeji community packs work) to replace the CSS robot; per-state frame mapping (walk/idle/sleep start+count) with live checkerboard preview, fps selectable 4/8/12/16; sheet persisted to `~/.promptpal/pet_sprite.png` via new Rust commands; colors/shapes settings hide while a skin is active with one-click restore; missing/broken sheet auto-falls back to the CSS robot
- **Schema v2**: first exercise of the storage migration chain (optional pet_style fields, lossless upgrade)

### Fixed
- **Pet roaming**: movement now anchors on the visible robot instead of its 340×380 window — the 138px dead zones on both screen sides and the unreachable top 280px are gone (window may partially leave the screen)
- **Patrol walk**: replaced the drunk-walk random turning (2%/tick) with target-edge patrol that reliably crosses the full screen; at the edge 40% long idle (5–10s) else a short pause then turn; hop behavior kept; work area refreshes every 10s to follow resolution/scale changes

---

## v1.3.0 (2026-09-25)

### Added
- **Template variable fill-in**: `[placeholder]` and `{{variable}}` syntax auto-detected on copy; terminal-style fill dialog with live preview, per-prompt value memory (LRU cap 1000), and a persistent "copy original" escape hatch
- **Quick inject enhancements**: favorites-first / usage-count sorting, category color dots, search resets selection
- **Gitee auto-sync**: 60s debounced auto-push after data changes (only when configured + enabled), startup pull with newer-remote confirmation banner, silent pull on empty library, exit flush (≤3s, never blocks quitting)
- **Rolling backup**: timestamped `promptpal_data.backup-*.json` before every push, keep last 5
- **CI**: GitHub Actions — type check, build, pure-function tests on push/PR
- Unified storage layer (`loadJson`/`saveJson` + schema version chain) shared by all stores

### Fixed
- Claude API: system prompt now sent as top-level field (Messages API rejected `role:'system'`); SSE delta parsing operator precedence; connection test uses provider-correct auth headers
- Corrupted localStorage no longer crashes startup; imports validated and deduplicated by id
- Pet window: `currentMonitor()` was silently failing (wrong ground position on non-1920×1080 monitors); `setPosition` now uses `LogicalPosition` instances
- Manual Gitee pull / file import now refresh the prompt list immediately

### Changed
- SettingsPanel split into `settings/AiTab` / `PetTab` / `SyncTab` (1145 → ~120-line container)
- DesktopPet split into `usePetMovement` / `useContextSuggest` / `useFocusSync` composables (1026 → 225 lines)
- Network search wired to the real f/awesome-chatgpt-prompts dataset (jsDelivr → GitHub raw → cache → offline fallback)

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
