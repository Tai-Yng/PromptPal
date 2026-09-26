# Design

## Context

三端 hook 机制均已查证（用户机器实测 + 官方源码）：
- **ZCode**：`~/.zcode/cli/config.json`，`hooks.enabled: true` + `hooks.events.<Event>` 数组（用户已有 PostToolUse/Stop 自有条目），事件进程从 stdin 收 JSON（现有 Stop 提示音 hook 即 `[Console]::In.ReadToEnd()` 模式）
- **Claude Code**：`~/.claude/settings.json` 的 `hooks.<Event>` 数组，格式与 ZCode 同风格；用户当前为空
- **Codex**：`~/.codex/config.toml` 的 `[hooks.<Event>]` TOML 数组，`MatcherGroup { matcher?, hooks: [{ type = "command", command, commandWindows?, timeout? }] }`（源码 codex-rs/config/src/hook_config.rs 确认，事件名与 Claude 风格一致）；用户已有 `notify` 配置被 computer-use 插件占用，不可触碰
- 桌宠侧：已有 120ms 全局光标轮询（穿透判定）可复用给眼睛跟随；已有 hop 小跳定位逻辑与天线球/核心发光动画

## Goals / Non-Goals

**Goals:**

- 三端一键接入/卸载，共存防重，用户自有 hook 条目零破坏
- 状态文件协议简单到 hook 一行 PowerShell 即可写
- 桌宠徽章 + 完成庆祝，精灵模式同等支持

**Non-Goals:**

- 权限审批回传（clawd 的 PermissionRequest 气泡——单向状态展示已满足场景）
- HTTP 端口通道、多会话并发跟踪（单状态文件 last-write-wins）
- 眼睛跟随的精灵化（精灵图眼睛是画死的，不跟随）
- error 状态的来源识别（三端 hook 事件无 error 语义，预留协议枚举不接事件）

## Decisions

### D1 — 状态文件协议而非 HTTP
`~/.promptpal/agent_state.json` = `{"agent": string, "state": "working"|"done"|"idle", "ts": number}`。hook 进程一行 PowerShell 写入（`$i = [Console]::In.ReadToEnd() | ConvertFrom-Json; @{agent='zcode';state='working';ts=[DateTimeOffset]::Now.ToUnixTimeMilliseconds()} | ConvertTo-Json | Set-Content ...`）；桌宠 Rust 新命令 `read_agent_state`（读文件返回字符串或空）。否决 HTTP：hook 是一次性进程，文件最可靠；无端口/防火墙/生命周期问题；1s 轮询延迟无感。

### D2 — 三端安装器按各自格式追加
统一标记：hook 条目里带 `# promptpal-agent-link` 特征（JSON 写 `statusMessage: "PromptPal: <event>"`，Codex TOML 写 `statusMessage = "PromptPal: <event>"`——三端 handler 均有 statusMessage 字段可承载标记）。查重/卸载都按标记匹配。
- ZCode：JSON `hooks.events.<E>` 数组 append `{type:'process', command:<powershell>, args:[...], timeoutMs:10000, statusMessage:'PromptPal: <E>'}`
- Claude：`hooks.<E>` 数组同结构（Claude 事件进程 stdin JSON 同 ZCode）
- Codex：TOML `[[hooks.<E>]]` 追加 `{ type = "command", commandWindows = <powershell 行>, timeout = 10, statusMessage = "PromptPal: <E>" }`——TOML 编辑用轻量文本层操作（定位文件末尾 append 分节；解析用 toml 库会丢注释，故 append-only 策略 + 卸载按标记行删除；用户 config.toml 其余内容零触碰）
- 事件订阅三端一致：UserPromptSubmit→working、PostToolUse→working、Stop→done、SessionEnd→idle（SessionEnd 仅 ZCode/Claude 安装；Codex 亦支持该事件名，一并安装）
- 每端生成 4 个事件条目；安装器前端实现（读写经 Rust 白名单命令，见 D3）

### D3 — Rust 白名单文件命令
新增 `read_settings_file(path)` / `write_settings_file(path, content)`：path 必须严格匹配三个白名单（`~/.zcode/cli/config.json`、`~/.claude/settings.json`、`~/.codex/config.toml`，含 canonicalize 校验），否则拒绝——前端 JS 做不了文件 IO，白名单把攻击面压到最小。JSON 编辑用 JSON.parse/stringify 保结构（会重排格式，可接受——ZCode/Claude 的 config 本就是机器管理格式；Codex TOML 走 append-only 文本层，不重写用户文件）。

### D4 — 桌宠状态机扩展
PetState 不加新值（避免与漫游/睡眠互斥矩阵纠缠），新增独立响应式 `agentBadge: ref<'working'|'done'|null>`：1s 轮询 `read_agent_state` → ts 超时 90s 或 state=idle → null；done 触发一次性庆祝（小跳+气泡+星星）后徽章转绿停留 10s → null。徽章渲染为头顶绝对定位小圆点（CSS 脉冲动画），精灵模式同位置叠加（复用 focus-indicator 的定位模式）。总开关（settingsStore 新字段 `agentLinkEnabled`，默认 false）关闭时不启动轮询。

### D5 — 眼睛跟随与庆祝
- 眼睛跟随：现有 120ms 穿透轮询已在拿全局光标——把逻辑/窗口内相对坐标经 movement 暴露给组件，瞳孔 div 按 `atan2` 方向偏移（dx,dy 各限幅 ±3px，CSS transform 无重排）；睡眠时眼皮闭合（现有 .eye.sleeping 样式）不跟随；精灵模式跳过
- 庆祝小跳：`celebrate()` 函数 = 复用 hop 定位（窗口 y 上移 15-40px → 180ms 后落回）+ 天线球 3 连闪 + 6 颗星星粒子（CSS keyframes，600ms 自动清理）；复制成功与 agent done 两处调用

### D6 — 设置面板布局
PetTab 底部新增「agent-link」区块：总开关 toggle + 三行代理开关（每行显示安装状态：Not installed / Linked / config missing）；操作即时生效并显示结果消息（复用 sync-msg 样式）。配置文件不存在时显示缺失提示（如未装 Claude Code）。

## Risks / Trade-offs

- [Codex TOML append 与未来版本格式变化] → append-only + 标记行删除不依赖解析器；Codex hook schema 变化时安装器随版本更新
- [hook 进程写文件并发覆盖] → 单文件 last-write-wins，多 agent 同时跑时显示最后更新者——单人场景可接受（spec 已定协议）
- [PowerShell 启动开销（每事件 ~200ms）] → hook 异步执行不阻塞 agent 主流程；timeoutMs=10000 上限
- [JSON stringify 重排用户 config 格式] → ZCode/Claude 的 config 为机器管理格式，注释本就不存在；Codex 走文本层保注释
- [徽章与专注模式气泡重叠] → 状态徽章与 focus-indicator 同位置互斥显示（focus 优先）
- [90s 超时误判（agent 思考超 90s 无事件）] → Claude/Codex 长思考期间 PostToolUse/心跳事件会刷新；阈值 90s 为 grill 默认值，设置面板可调（30–300s）不锁死

## Migration Plan

三组提交：①灵动包（眼睛跟随+庆祝）→ ②状态文件协议+徽章+Rust 命令 → ③三端安装器+设置区+版本 1.6.0。任一组可独立 revert；状态文件是新文件不涉迁移；settingsStore 新字段读取端兜底默认 false，无 schema 版本 bump。

## Open Questions

无——三端 hook 格式均为实测/官方源码确认，语义映射与超时策略沿用设计确认结论。
