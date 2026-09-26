# Design

## Context

v1.4 交付后：精灵渲染走 asset 协议 + dataURL 双通道（已验证）；导入只支持多选散帧 PNG 手动拼条+手填帧区间；实测皮卡丘包（Group-Finity 日文格式，2009 年）证明帧引用普遍非连续（歩く=[1,2,1,3]），现有 start+count 区间模型表达不了；用户实际 CLI 通道是 Rust 版 pal.exe（dialoguer + serde_json，随安装包分发），Node 版 pal.js（inquirer）为次要通道。useCount 在 promptStore 中持续累加但无展示面。动机见 proposal.md。

## Goals / Non-Goals

**Goals:**

- ZIP 一键导入：解包、拼条、XML 语义映射自动配帧，全程用户零手填（可微调）
- CLI 填空：Rust/Node 双端行为一致，语义与 UI 对齐
- 统计视图：零新存储、零图表依赖的轻量展示

**Non-Goals:**

- Shimeji 行为引擎（不解析频率/事件/转移逻辑，只取帧序列）
- 图表库、独立统计存储、历史趋势
- Node CLI 的分发优化（pal.js 保持 npm 通道现状）
- ASCII art 预览等 CLI 花活

## Decisions

### D1 — ZIP 前端解压用 fflate
约 30KB 无依赖 ESM 库，浏览器 dev 与 Tauri webview 同路径运行；否决 Rust 侧解压（zip crate + 新命令 + 文件对话框走 plugin-dialog，链路长且浏览器 dev 无法测）。

### D2 — 帧列表模型与 schema v3
`SpriteFrameRange` 增加可选 `frames: number[]`；渲染端 rangeFor 返回序列数组（frames 存在按列表，否则 start..start+count-1 展开），播放指针按序列索引推进。SCHEMA_VERSION 3，迁移 v2→v3 无操作（可选字段，读取端双兼容）——迁移链第二次实战。归档后旧 start+count 语义不变。

### D3 — 双格式 XML 解析器（新 services/shimejiXml.ts）
遍历 ZIP 文本条目识别动作定义（含 `<ポーズ 画像=` 或 `<Pose Image=`，排除 Mascot.xsd/schema 文件），正则提取动作块 + 帧引用。映射表按优先级：
- walk: `walk|move|歩く|走る|走`
- idle: `stand|idle|look|立つ|座る|座`
- sleep: `sleep|rest|寝|眠`
（英文大小写不敏感；日文子串匹配；首个命中即用，帧序列按引用顺序去重）。
文件名→帧号：`shime(\d+)\.png` 的数字部分（1-based）。乱码 conf 文件名不敏感——按内容识别而非文件名。

### D4 — ZIP 内帧图选取
优先匹配 `shime\d+\.png`（两种格式惯例），全部命中后自然排序；无匹配则回落 zip 内全部 PNG（排除 icon）并提示「按文件序拼条」。conf 找不到时导入成功但映射留空（spec 场景已覆盖）。

### D5 — Rust CLI 手写解析器（不加 regex）
变量识别是定长模式（`[...]`/`{{...}}`），字符扫描 ~40 行：跳过 `--` 开头段（在 token 位置回看），收集名称去重。替换同理。dialoguer::Input 每变量一项 `.with_prompt("变量名 [语法原文]")`，空输入=留空。Node pal.js 侧移植同规则（TS variables.ts 的 JS 直译），两端行为由同一组测试样例约束（scripts/test-pure.mjs 覆盖 TS 版；Rust 侧 cargo run 手测样例对齐）。

### D6 — 统计视图实现
PanelPage nav 加第 5 项 stats；StatsPanel.vue 全 computed 从 promptStore 取数：概览四数字、Top10（useCount 降序 slice(0,10)，0 次排除，bar 宽 = count/max*100%）、分类分布（按 store.categories 分组计数）。纯 div + CSS 宽度，不引库。

## Risks / Trade-offs

- [XML 方言差异（Shimeji-ee 变体/极旧包）] → 双格式关键词覆盖主流；解析失败回落手填，功能不损失
- [frames 列表与 start/count 并存歧义] → frames 优先级恒定高于区间，写入端保证互斥清理
- [fflate 解压 GBK 文件名乱码] → 不依赖文件名找 conf（按内容识别）；PNG 按目录+命名匹配，乱码仅影响日志
- [CLI 输入中文变量名交互体验] → dialoguer/Input 与 inquirer 均支持 UTF-8；Windows 终端代码页问题由用户终端环境决定（与现有 CLI 一致，不新增风险）
- [统计面板大库性能] → computed + slice(10)，千条级无压力

## Migration Plan

三组提交：①数据模型 v3 + XML/ZIP 导入（前端）→ ②CLI 双端填空 → ③统计面板 + 版本 1.5.0。任一组可独立 revert；无破坏性数据变更。

## Open Questions

无——设计假设均已用真实皮卡丘包数据验证（帧引用模式、日文标签、乱码文件名）。
