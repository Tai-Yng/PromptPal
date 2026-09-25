# Proposal

## Why

PromptPal 第一轮已完成 bug 修复与真实数据源接入（commit 8a1ca52），但日常使用仍有三类摩擦：带 `[占位符]` 的提示词复制后需手动改写；提示词数量增长后 Ctrl+Alt+P 注入窗难以定位目标；Gitee 同步纯手动，数据安全依赖用户记得推送。同时 SettingsPanel（1145 行）与 DesktopPet（1026 行）两个巨型组件及分散的 localStorage 读写已成为继续演进的阻力——先整理地基，再在其上叠加功能，是返工量最小的路径。

## What Changes

- 统一本地存储层：新增 `src/services/storage.ts`（`loadJson`/`saveJson` + 异常兜底 + 类型校验），引入 `promptpal_schema_version` 与迁移函数链；四个 store（prompt/settings/todo/petStyle）全部接入。数据文件 `~/.promptpal/promptpal_data.json` 结构不变，CLI 与既有备份完全兼容
- 组件拆分（纯机械搬移，行为零变化）：SettingsPanel 按现有 tab 拆为 `settings/AiTab.vue`、`settings/PetTab.vue`、`settings/SyncTab.vue`；DesktopPet 抽出 `composables/usePetMovement.ts` 等内聚块
- 新增模板变量填空：`[占位符]` 与 `{{变量}}` 双语法动态解析（不加数据字段）；复制入口检测到变量时弹出填空浮层，固定提供「复制原文」退路；留空变量保留占位符原文；按 promptId+变量名记忆上次填值
- QuickInject 增强：顶部自动聚焦搜索框（即输即滤 title/content/tags）、分类色点、收藏优先→useCount 降序排序；回车 = 有变量走填空、无变量直接复制关窗
- Gitee 自动同步：改动后防抖 60s 推送（已启用且已配置时）；启动时远端较新才询问拉取（本地为空静默拉取）；退出前尽力推送一次（最多等 3s，失败不阻塞）；推送前时间戳备份本地数据文件并保留最近 5 份滚动清理；连续 3 次推送失败在同步区显示警告；冲突策略 last-write-wins
- 新增 GitHub Actions CI：仅前端（`tsc --noEmit` + `vite build` + 轻量测试脚本），push 与 PR 触发
- 四阶段完成后统一版本 1.3.0：package.json（现 1.0.0）、README 徽章（现 1.2.0）、CHANGELOG 同步对齐

## Capabilities

### New Capabilities

- `template-variables`: 从提示词内容动态解析变量占位符并在复制时填空替换的行为——语法识别、填空交互、记忆、误报退路、留空语义
- `quick-inject`: 全局快捷注入窗口的搜索过滤、排序与复制流程行为
- `gitee-auto-sync`: 提示词库到 Gitee 的自动推送、启动拉取、备份滚动与失败告警行为

### Modified Capabilities

（无——项目首次建立规格，无既有能力；存储层统一与组件拆分为纯内部重构，不改变任何 spec 级行为，故不设规格，仅在 design/tasks 中管理）

## Impact

- **前端 TS/Vue**：`src/services/` 新增 storage.ts、variables.ts；`src/stores/` 四个 store 改造接入；`src/components/SettingsPanel.vue` 拆分、`DesktopPet.vue` 拆分、`QuickInject.vue` 增强、新增 `VariableFillDialog.vue` 与 `settings/` 子组件
- **Rust**：`src-tauri/src/lib.rs` 新增一个备份复制命令
- **CI**：新增 `.github/workflows/ci.yml`
- **不直接修改**：`cli/bin/pal.js`（变量支持留待下轮，本轮仅依赖其数据格式不变）、Tauri 窗口布局与全局热键、AI 生成链路（buildChatRequest 已就绪）
