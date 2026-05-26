# PromptPal

> AI Prompt management tool with a desktop pet companion — DeepSeek terminal aesthetics.

![Version](https://img.shields.io/badge/Version-1.0.0-6E40C9)
![Vue](https://img.shields.io/badge/Vue-3.x-4FC08D)
![Tauri](https://img.shields.io/badge/Tauri-2.x-FFC131)
![Rust](https://img.shields.io/badge/Rust-1.77-dea584)

## Overview

PromptPal is a Windows desktop application that helps you manage, generate, and quickly inject AI prompts — all from a tiny robot pet living on your desktop. It features a **DeepSeek CMD terminal dark theme** with monospace fonts, blue-purple accent colors, and `>` prompt indicators.

## Features

### Desktop Pet
- Tech-style robot pet with antenna, visor, and glowing eyes
- 8 built-in color themes (Cyan Tech, Crimson Bot, Violet Core, etc.)
- Customizable colors, body shapes, and proportions
- Idle wandering with randomized pauses, direction changes, and hops
- Context-aware: detects the active window and suggests relevant prompts

### Prompt Management
- Create, edit, and delete custom prompts
- Category tags for organization
- Card preview: click to expand, double-click to copy
- Local storage via browser localStorage

### AI Generation
- Generate new prompts via AI API (DeepSeek / OpenAI / Claude / Custom)
- Configure provider, model, and API key in Settings
- Streaming token-by-token output

### Quick Inject (`Ctrl+Alt+P`)
- Global hotkey pops up a floating prompt picker
- Arrow keys navigate, Enter to copy to clipboard
- Works system-wide in any application

### Data Sync
- **Gitee cloud sync**: push/pull your prompt library to a Gitee repository
- **Local import/export**: JSON file backup via browser download
- Requires a Gitee personal access token with `projects` scope

## Screenshots

*[add screenshots here]*

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vue 3 + TypeScript + Pinia |
| Build | Vite 8 |
| Desktop | Tauri 2.x (Rust backend) |
| AI APIs | DeepSeek / OpenAI / Claude (configurable) |
| Styling | CSS custom properties, JetBrains Mono, terminal aesthetics |
| Sync | Gitee API v5 (via Rust `ureq`) |

## Project Structure

```
PromptPal/
├── public/                  # Static assets
├── src/
│   ├── components/
│   │   ├── DesktopPet.vue   # Animated robot pet
│   │   ├── PanelPage.vue    # Main panel host
│   │   ├── PromptPanel.vue  # Prompt list & categories
│   │   ├── PromptCard.vue   # Expandable prompt card
│   │   ├── PromptEditor.vue # Prompt create/edit form
│   │   ├── AIGeneratePanel.vue  # AI prompt generation
│   │   ├── QuickInject.vue  # Ctrl+Alt+P floating injector
│   │   ├── SettingsPanel.vue    # Config (AI, Pet, Sync)
│   │   ├── NetworkSearch.vue    # Web prompt search
│   │   ├── ContextMenu.vue      # Right-click context menu
│   │   └── HoloMenu.vue         # Holographic menu overlay
│   ├── stores/
│   │   ├── promptStore.ts   # Prompt CRUD state
│   │   ├── settingsStore.ts # AI & pet config
│   │   └── petStyleStore.ts # Pet theme/style state
│   ├── services/
│   │   └── platform.ts      # Platform detection & Tauri bridge
│   ├── App.vue
│   ├── main.ts
│   └── style.css            # Global CSS tokens & terminal theme
├── src-tauri/
│   ├── src/lib.rs           # Tauri commands (Gitee API, hotkey, etc.)
│   ├── Cargo.toml
│   └── capabilities/        # Tauri permission manifests
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Getting Started

### Prerequisites
- Node.js 18+
- Rust (via [rustup](https://rustup.rs/))

### Development

```bash
npm install
npm run tauri dev
```

### Production Build

```bash
npm run tauri build
# Output: src-tauri/target/release/bundle/nsis/PromptPal_1.0.0_x64-setup.exe
```

## AI Providers & Models

| Provider | Available Models |
|----------|-----------------|
| DeepSeek | `deepseek-chat`, `deepseek-reasoner`, `deepseek-coder`, `deepseek-v4`, `deepseek-v3` |
| OpenAI | `gpt-4.1`, `gpt-4o`, `gpt-4o-mini`, `o4-mini`, `o3-mini`, `gpt-4-turbo` |
| Claude | `claude-sonnet-4`, `claude-3.5-sonnet`, `claude-3.5-haiku`, `claude-3-opus` |
| Custom | Any OpenAI-compatible endpoint |

## Known Limitations

- Custom sprite import for the desktop pet is not yet supported.
- Network search for prompts from external platforms is experimental.
- Claude provider uses a different API format; generation may require adjustments.

## License

MIT

---

**PromptPal** — manage prompts like a terminal wizard.
