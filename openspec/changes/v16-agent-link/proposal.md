# Proposal

## Why

PromptPal 桌宠目前只反映自身事件（行走/睡眠/复制），与用户真实的 AI 工作流脱节。同类头部项目 clawd-on-desk（6.3k★）验证了"桌宠感知 AI 编码代理状态"是高价值场景：用户跑 ZCode / Claude Code / Codex 时桌宠能实时显示工作状态、完成时庆祝，桌面存在感从装饰变成仪表。同时桌宠互动性不足（眼睛不看人、复制无反馈）。用户已确认做"桌宠灵动包 + AI 代理状态联动"两包，联动范围 ZCode、Claude Code、Codex 三端（三端 hook 配置格式已逐一查证）。

## What Changes

- **桌宠灵动包**：
  - 眼睛跟随鼠标：复用现有 120ms 全局光标轮询，CSS 机器人瞳孔朝光标方向偏移（限幅 3px），睡眠时闭合不跟随；精灵模式不受影响
  - 庆祝小跳：复制成功与 agent 任务完成时——原地小跳 + 天线球闪光 + 星星粒子（纯 CSS 600ms），复用现有 hop 定位逻辑
- **AI 代理状态联动（agent-state-link）**：
  - **状态文件协议**：hook 进程把 `{agent, state, ts}` 写入 `~/.promptpal/agent_state.json`；桌宠 1s 轮询；90s 无更新自动回落 idle；不建 HTTP 端口（hook 是一次性进程，写文件零依赖零防火墙弹窗）
  - **三端 hook 安装器**（Settings 新增 agents 区，一键接入/移除，追加前查重防重复，不动用户已有条目）：
    - ZCode：`~/.zcode/cli/config.json` → `hooks.events.{UserPromptSubmit,PostToolUse,Stop}` 追加 process 条目（JSON，现有 hooks.enabled=true 与已有条目不动）
    - Claude Code：`~/.claude/settings.json` → `hooks.{...}` 同风格 JSON
    - Codex：`~/.codex/config.toml` → `[hooks.PostToolUse]`/`[hooks.Stop]` 等 TOML 数组（`type = "command"`，Windows 用 `commandWindows` 字段；不触碰已占用的 `notify` 配置）
  - **状态映射**：UserPromptSubmit/SessionStart→working、PostToolUse→working（刷新时间戳）、Stop→done、SessionEnd→idle
  - **桌宠表现**：巡逻照常，头顶状态徽章（working 蓝/亮、done 绿、error 红，脉冲动画；精灵模式同样显示角标）；done 时触发庆祝小跳 + 气泡「✓ Agent done」；设置面板总开关（默认关）
- 版本 1.6.0（package.json / README 徽章 / CHANGELOG）

## Capabilities

### New Capabilities

- `agent-state-link`: 桌宠感知外部 AI 代理工作状态的行为——三端 hook 安装/卸载、状态文件协议、轮询与超时回落、状态徽章与完成庆祝

### Modified Capabilities

- `pet-sprite-skin`: 精灵模式 SHALL 同样显示 agent 状态角标（新增一条 requirement；其余行为不变）

## Impact

- **前端**：`composables/usePetMovement.ts`（眼睛跟随的目标位置暴露）、`DesktopPet.vue`（瞳孔 transform、庆祝小跳、状态徽章图层、1s 状态轮询）、`settings/` 新 `AgentsSection`（三端安装开关）、新 `services/agentState.ts`（状态文件读写协议 + 超时逻辑）、`pet.css`（徽章/粒子样式）
- **设置面板**：PetTab 或独立 agents 区新增三个接入开关 + 状态说明
- **Rust**：无改动（状态文件读写走 Node fs？不——前端无 fs 权限，需 Rust 命令 `read_agent_state`（读文件返回字符串或空）+ hook 端直接写文件无 Rust 参与；安装器在前端直接改 JSON/TOML 文件需要 Rust fs 命令：`read_text_file`/`write_text_file`（限制在三个配置路径白名单内））
- **hook 命令**：PowerShell 单行（与用户现有 Stop 提示音 hook 同款模式：stdin → 状态文件），安装器生成
- **不变**：漫游数学、精灵渲染、变量填空、同步链路
