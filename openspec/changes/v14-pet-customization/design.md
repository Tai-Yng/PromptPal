# Design

## Context

桌宠渲染几何（实测确认）：机器人 80×100 经 flex（`align-items: flex-end; justify-content: center`）绘制在 340×380 透明窗口的底部中央，水平偏移 130px、垂直偏移 280px。现有移动算法以窗口为锚（窗口 x ∈ `[8, 屏宽-348]`），导致机器人可见范围左右各损失 138px；拖拽钳制同理。行走为随机游走：每 120ms 一跳，2% 中途掉头 + 6% 随机停 + 到边 40% 停，统计上几乎不横穿全屏。`workArea` 仅在启动时计算一次。v1.3 已建立：schema 迁移函数链（尚为空）、`usePetMovement` 组合式函数、`currentMonitor()` 物理转逻辑的修正。动机见 proposal.md。

## Goals / Non-Goals

**Goals:**

- 精灵图替换 CSS 机器人：导入→配置→渲染→回退全链路可用
- 机器人可达全屏水平域，行走可预期地横穿
- schema v2 迁移链实战，旧配置零损失

**Non-Goals:**

- Shimeji conf XML 行为解析（路线 B，本轮不做）
- 垂直自由漫游/爬墙（保持地面行走形态）
- 速度语义调整（Q5-b 用户决策保留悠然 pace）
- 可视化帧网格编辑器（Q1-a 选了手动填数字，留作迭代）
- 多精灵图/多形象库管理（单形象，恢复即回默认）

## Decisions

### D1 — 路线 A：单张精灵图导入
导入一张 PNG/WebP（≤5MB）+ 帧参数即可成型。否决 B（XML 行为包兼容，工作量 3–5 倍）与 C（内置形象库，需美术资源且不算自定义）。

### D2 — 帧映射手动填数字 + 钳制 + 回退（Q1-a）
三状态各填「起始帧 + 帧数」（1-based），实时预览；`起始帧+帧数-1 > 总帧数` 时自动钳制（保起始帧、缩帧数）；未配置状态复用 walk 序列；帧率 4/8/12/16（Q2-b）。非法输入永远不产生越界渲染。

### D3 — 图片存文件，不进 localStorage（Q3-b）
新 Rust 命令 `save_pet_sprite`（base64 入参 → 校验大小 ≤5MB → 写 `~/.promptpal/pet_sprite.png`）与 `load_pet_sprite`（返回 base64 或空）。理由：5MB 图的 base64 约 6.7MB 字符串，localStorage 5MB 配额必然爆；文件系统无此限制。非 Tauri（浏览器 dev）降级为 data URL 存 localStorage，仅开发用。

### D4 — 渲染方案：background-position + JS 定时切帧
一个精灵图层 `<div>`：`background-image: url(...)`，`width/height = 帧宽/帧高`，JS 定时器按帧率递增 `background-position`。否决 canvas 重绘（多一套绘制栈）与多 `<img>` 切换（闪烁）。图层由 `petStyleStore.useCustomSprite && spritePath` 激活，与 CSS 机器人互斥渲染（D5）；帧定时器挂在 DesktopPet，随 state 取 frameMap 序列，组件卸载清理。CSS 机器人全部主题/颜色逻辑保留不动。

### D5 — 设置互斥（Q4-a）
精灵模式下 PetTab 隐藏颜色/形状区，显示提示 + 「恢复默认机器人」（清 spritePath/frameMap/frameRate/useCustomSprite）。防止"改颜色没反应"的困惑。

### D6 — schema v2 迁移
`promptpal_pet_style` 新增可选字段 `spritePath`、`frameMap`、`frameRate`；`storage.ts` 迁移链注册首个迁移函数（v1→v2：无操作补默认，仅升版本号——新字段读取端兜底缺省）。旧配置零损失。

### D7 — 机器人锚定数学
以机器人为锚重写边界：机器人 x ∈ `[8, 屏宽-88]` → 窗口 x ∈ `[-122, 屏宽-218]`（允许出屏，透明区无内容）；地面不变（窗口 y = 屏高-388，机器人脚贴底-8）；拖拽钳制同套公式（窗口 y ∈ `[-272, 屏高-388]` 使机器人可达屏顶）。`windowX/windowY` 语义不变，仅边界常量改由锚点推导（`PET_OFFSET_X = 130`、`PET_OFFSET_Y = 280` 常量化）。

### D8 — 目标驱动巡逻（Q6-c）
状态扩展：`target`（左/右边）。行走直奔目标边（步进判定 `距目标 ≤ 步长` 即到达）；到边 `rand < 0.4` → 发呆 5–10s，否则短停 0.5–1.5s 后掉头设新目标；中途掉头概率 2% → 0.3%；小跳 1.5% 保留；速度语义不变。暂停/拖拽/睡眠期间巡逻挂起（现有互斥逻辑沿用）。

### D9 — 工作区周期刷新
`updateWorkArea` 挂入现有 10s `checkSleep` 定时器同批执行，每 10s 重算逻辑工作区；分辨率/缩放变化一个周期内生效。

## Risks / Trade-offs

- [精灵帧映射配错导致观感异常] → 实时预览 + 越界钳制 + 未配置回退 walk + 渲染异常自动回落 CSS
- [窗口移出屏幕部分拦截鼠标点击] → Windows 下 Tauri 透明窗口空白区通常可穿透；手测验证，必要时对该区域 `set_ignore_cursor_events`
- [旧配置无新字段] → v2 迁移只增不改，读取端全兜底
- [巡逻速度慢（~21px/s @0.3 档）] → Q5-b 用户知情保留；速度滑杆仍在，可自行调高
- [大图内存（5MB WebP 解码）] → 单实例单图层，解码一次常驻，可接受
- [浏览器 dev 模式精灵行为与 Tauri 不一致] → data URL 降级仅开发用，spec 场景以 Tauri 为准

## Migration Plan

单 change 分三组提交：①数据与迁移（schema v2 + Rust 命令）→ ②精灵渲染与导入 UI → ③漫游修复 + 版本 1.4.0。任一组可独立 revert；无破坏性数据变更（迁移只增字段），回滚不需要触碰用户文件。

## Open Questions

无——grill-me 一轮六问（Q1–Q6）全部落定，技术默认项（越界钳制、walk 回退、非 Tauri 降级、渲染回落）已记入对应决策。
