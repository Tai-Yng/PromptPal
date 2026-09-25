# Design

## Context

项目为 Vue 3 + Vite + Tauri 2 + Pinia 的 Windows 桌面应用，约 7100 行。第一轮优化（8a1ca52）已修复 Claude API 系列问题、接入真实社区数据源（多级回退）、加固 store 容错。现状约束：数据文件 `~/.promptpal/promptpal_data.json` 被 CLI（`pal`）与既有备份依赖，格式不可破坏；`settingsStore` 已有共享请求构建器 `buildChatRequest`；Rust 侧已有 `sync_save`/`sync_load`/`gitee_push`/`gitee_pull` 命令；导出数据 JSON 已含 `exportedAt` 时间戳字段。动机见 proposal.md。

## Goals / Non-Goals

**Goals:**

- 后续功能演进的地基：统一存储层 + 巨型组件拆分，全程行为零变化
- 三个用户可感知的能力：变量填空、注入增强、自动云同步
- 每阶段独立可验收、可回滚；CI 自动回归兜底

**Non-Goals:**

- CLI `pal` 的变量填空（纯函数留接口，功能下轮）
- QuickInject 自由编辑（380×440 窗口体验局促，grill 定论不加）
- 引入测试框架、UI 自动化测试
- 多设备冲突合并（last-write-wins，单人场景定论）
- Rust/Tauri 层结构性改造（仅新增一个小命令）

## Decisions

### D1 — 阶段顺序：地基先行
存储层统一 + 组件拆分（阶段一）先于三个功能（阶段二~四）。理由：三个功能都挂在 store 与大组件上，先整理地基则新代码写在新结构上，不返工。替代方案"功能优先、重构收尾"因大文件需拆两次被否决（grill 定论，方案 A）。

### D2 — 统一存储层与 schema 版本
新增 `src/services/storage.ts`：`loadJson(key, fallback, validate?)` / `saveJson(key, value)`，统一兜底 JSON.parse 异常与类型校验；引入 `promptpal_schema_version` 键与迁移函数链（本轮 v1 起步，链为空，仅为演进留口）。四个 store 全部接入。
**关键约束**：`sync_save` 导出文件结构不变——CLI 与旧备份零影响。替代方案"给 Prompt 加变量字段"因破坏数据兼容被否决。

### D3 — 组件拆分为纯机械搬移
SettingsPanel（1145 行）按现有 tab 边界拆为 `settings/AiTab.vue`、`settings/PetTab.vue`、`settings/SyncTab.vue`，容器保留 tab 切换/Escape 关闭/测连接入口；DesktopPet（1026 行）抽出 `composables/usePetMovement.ts`（walk/idle/hop 状态机、定时器循环、位置持久化）与右键菜单调用等内聚块，主文件目标 ≤500 行。props/emit 不引入——沿用各组件直接使用 store 的现状模式。定时器与事件监听的 onUnmounted 清理跟随搬移。

### D4 — 变量动态解析，不加数据字段
变量从 content 动态解析：正则识别 `[名称]` 与 `{{名称}}`（1–40 字符、无换行、无嵌套括号），排除 `--` 开头的命令参数段，按首次出现顺序去重。纯函数置于 `src/services/variables.ts`（parseVariables / substitute），Node 断言脚本可测。替代方案"持久化变量定义字段"被否决（spec 变更 + 数据迁移成本，无对应收益）。

### D5 — 填空交互细节（grill 定论）
- 误报退路：填空窗常驻「复制原文」，一键复制未替换文本（Q1-a）
- 留空语义：留空占位符保留原文，不替换空串（Q6-a）
- 记忆：`promptpal_var_memory` 按 promptId+变量名 存上次值，总量上限 1000 条 LRU
- 组件：`VariableFillDialog.vue` 供主面板与 QuickInject 复用；无变量时完全不挂载，零回归

### D6 — QuickInject 增强（grill 定论）
顶部自动聚焦搜索框（title/content/tags 不分大小写即输即滤，独立轻量过滤，不污染主面板 store 状态）；列表加分类色点；排序收藏优先→useCount 降序；回车 = 有变量走填空、无变量直接复制关窗；复制成功递增 useCount；Esc 关窗行为保留。不加自由编辑（Q3）。

### D7 — 自动同步机制
- **推送**：挂在现有 autoExport（2s 防抖落盘）之后，成功落盘且 gitee 启用时再 60s 防抖推送；连续 3 次失败在同步区告警，成功即解除
- **启动拉取判据**：对比远端导出 JSON 的 `exportedAt` 与本地最近落盘时间（数据文件已有该字段，无需新增元数据）；本地为空静默拉取，远端较新弹确认，否则不打扰
- **退出兜底**：托盘/面板退出前尽力推送一次，3s 超时放弃，绝不阻塞退出（Q7-a）
- **备份**：推送前用新 Rust 命令将 `promptpal_data.json` 复制为 `promptpal_data.backup-<ts>.json`，保留最近 5 份滚动清理（Q8-b）
- **冲突**：last-write-wins，单人场景定论

### D8 — CI 范围（grill 定论）
GitHub Actions 仅前端：Node 22，`npm ci` → `tsc --noEmit` → `vite build` → `node scripts/test-pure.mjs`（轻量断言脚本聚合）。Rust 不进 CI（Tauri Windows runner 依赖重、10 分钟起步且易碎）；触发 push(main) 与 PR。

### D9 — 测试策略
不引入测试框架：`variables.ts` 与 storage 迁移链等纯函数用 Node 内置断言写 `scripts/test-pure.mjs`（沿用第一轮 CSV 解析测试的模式），CI 与本地均可跑；UI 行为靠 tsc + build + 每阶段手测清单。

### D10 — 版本对齐
四阶段全部完成后统一 bump 1.3.0：package.json（1.0.0→1.3.0）、README 徽章（1.2.0→1.3.0）、CHANGELOG.md 补 v1.3.0 条目。

## Risks / Trade-offs

- [拆分引入行为回归] → 纯机械搬移纪律 + 每阶段 tsc/build/手测清单（桌宠游走、右键、托盘、三 tab 全走一遍）+ 独立 commit 可单独 revert
- [自动推送把坏数据推上云] → 推送前 5 份滚动备份，可回滚；last-write-wins 下本地仍是 source of truth
- [Gitee 限流/网络抖动] → 60s 防抖天然限频；失败计数告警而非弹窗轰炸；退出兜底 3s 超时
- [变量正则误报] → 40 字限长 + 嵌套排除 + `--` 参数排除 + 「复制原文」一键退路
- [localStorage 容量（记忆 1000 条）] → LRU 上限，单条仅存字符串键值，占用可忽略
- [Tauri webview 外部 fetch] → CSP 已为 null（第一轮 jsDelivr 接入已验证可行），自动同步走 Rust `ureq` 与现有 gitee_push 同链路，不受 webview 限制

## Migration Plan

四阶段顺序实施，每阶段独立 commit（阶段一重构、阶段二变量、阶段三注入、阶段四同步+CI+版本）。任一阶段出问题 `git revert` 该阶段 commit 即可，阶段间无数据迁移（schema 迁移链本轮为空起步）。回滚全程不需要触碰用户数据文件。

## Open Questions

无——两轮 grill-me 已清空决策树 frontier，13 项决策全部落定。
