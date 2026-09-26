# Proposal

## Why

v1.4 的精灵造型落地后暴露三个顺理成章的补全点：Shimeji 包的帧区间仍需手动从 XML 里查着填（实测皮卡丘包 46 帧、日文 XML，手配门槛高且帧引用普遍非连续，现有 start+count 区间模型表达不了）；终端 CLI（用户实际通道是 Rust 版 pal.exe）选中带变量提示词时只会复制原文，UI 侧的填空能力没有对齐；提示词库的使用数据（useCount）一直在采集却没有任何展示面。

## What Changes

- **Shimeji ZIP 整包导入 + XML 语义映射（pet-sprite-skin 扩展）**：
  - 导入 UI 支持 ZIP：前端解压（fflate，约 30KB 无依赖新增），取 `img/` 下 `shime*.png` 拼条，扫描 conf 中含动作定义的 XML 自动解析三个状态帧序列
  - 解析器双格式兼容：Shimeji-ee 英文（Action/Animation/Pose/Image/name）与 Group-Finity 日文原版（動作/アニメーション/ポーズ/画像/名前）
  - 语义映射：walk←Walk/歩く/走る类，idle←Stand/立つ/座る类，sleep←Sleep/寝そべる/寝る类；每状态取首个匹配动作的帧序列；未命中回退现有手填流程
  - **存储升级**：`SpriteFrameRange` 增加可选 `frames: number[]` 帧列表（非连续引用，如 [1,2,1,3]），存在时优先于 start/count；SCHEMA_VERSION 3（v2→v3 迁移为可选字段补默认，读取端双格式兼容）
- **CLI 变量填空**：Rust 版 `pal.exe`（用户主通道）选中含变量提示词时逐项交互填空（回车留空=保留占位符，与 UI 语义一致）后复制替换文本；Node 版 pal.js 同步实现保持双端一致；变量解析规则与 UI 完全一致（双语法、-- 排除、40 字限长）
- **使用统计面板**：面板新增 stats 视图——总提示词数/总使用次数/收藏数、Top 10 使用排行、分类分布；纯 CSS 终端风横向 bar，不引入图表库，数据全部由现有 store 实时计算
- 版本 1.5.0

## Capabilities

### New Capabilities

- `usage-stats`: 面板统计视图的数据聚合与展示行为（排行、分布、实时性）
- `cli-variable-fill`: 终端 CLI 选中带变量提示词时的交互填空与复制行为（Rust 与 Node 双端一致）

### Modified Capabilities

- `pet-sprite-skin`: 新增 ZIP 整包导入与 XML 语义映射行为（帧列表数据模型扩展）；现有手填流程与渲染行为不变

## Impact

- **前端**：`spriteStitch.ts`（ZIP 解压与 conf 扫描）、新 `services/shimejiXml.ts`（双格式解析器）、`PetTab.vue`（ZIP 导入入口 + 自动映射预填）、`petStyleStore.ts`（frames 字段）、`storage.ts`（v3 迁移）、`PanelPage.vue`（stats nav）、新 `StatsPanel.vue`
- **Rust**：`cli-rs/src/main.rs`（变量解析 + dialoguer Input 循环）
- **Node**：`cli/bin/pal.js`（同步变量填空）
- **依赖**：新增 fflate（前端）；Rust CLI 无新依赖（手写解析器）
- **不变**：渲染端帧切换逻辑的对外行为、自动同步、模板变量 UI
