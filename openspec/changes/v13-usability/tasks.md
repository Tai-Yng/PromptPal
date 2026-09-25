# Tasks

## 1. 阶段一：地基重构（行为零变化）

- [x] 1.1 新建 `src/services/storage.ts`：`loadJson`/`saveJson` + `promptpal_schema_version` 迁移链骨架（v1 起步），并新建 `scripts/test-pure.mjs` 跑 storage 纯函数断言——验证：`node scripts/test-pure.mjs` 全绿
- [x] 1.2 四个 store（prompt/settings/todo/petStyle）接入 storage.ts，移除各自散落的 JSON.parse 与 localStorage 直读写——验证：`npx tsc --noEmit` 零错误，手测增删改查与重启恢复正常
- [x] 1.3 SettingsPanel 按现有 tab 拆出 `settings/AiTab.vue`、`settings/PetTab.vue`、`settings/SyncTab.vue`，容器保留 tab 切换/Escape 关闭/测连接——验证：build 通过，手测三 tab 各功能与拆分前一致
- [x] 1.4 DesktopPet 抽出 `composables/usePetMovement.ts` 等内聚块，主文件降到 ≤500 行，onUnmounted 清理跟随搬移——验证：build 通过，手测游走/拖拽/右键菜单/睡眠/上下文感知与拆分前一致
- [x] 1.5 阶段一 commit（`refactor`）并推送——验证：`git log` 含独立 refactor commit，本地 build 绿

## 2. 阶段二：模板变量填空

- [x] 2.1 新建 `src/services/variables.ts`：`parseVariables`（双语法、1–40 字、无嵌套、排除 `--` 参数、顺序去重）与 `substitute`（留空保留占位符），并补 `scripts/test-pure.mjs` 断言（双语法/去重/留空/`--` 排除/误报样例）——验证：`node scripts/test-pure.mjs` 全绿
- [x] 2.2 新建 `VariableFillDialog.vue`：terminal 风格填空浮层（输入框预填记忆值、实时预览替换结果、确认复制、常驻「复制原文」）——验证：组件渲染与交互手测通过
- [x] 2.3 变量记忆：`promptpal_var_memory` 经 storage.ts 持久化，1000 条 LRU 上限——验证：纯函数断言覆盖超限淘汰最旧条目
- [x] 2.4 主面板复制入口（PromptCard 双击等）接入：无变量直通零回归、有变量弹填空——验证：手测无变量不弹窗、填空复制、误报「复制原文」、留空保留占位符四场景
- [x] 2.5 阶段二 commit（`feat`）并推送——验证：本地 tsc+build+测试脚本全绿

## 3. 阶段三：快捷注入增强

- [x] 3.1 QuickInject 顶部自动聚焦搜索框，即输即滤 title/content/tags（独立轻量过滤，不写主面板 store）——验证：手测即输即滤、清空恢复、关窗重开归零
- [x] 3.2 列表改为收藏优先→useCount 降序，列表项加分类色点——验证：手测排序与色点展示
- [x] 3.3 回车复制流程接入变量填空：有变量走填空后复制关窗、无变量直接复制关窗，useCount 递增，Esc 关窗不复制——验证：手测全部四条路径
- [x] 3.4 阶段三 commit（`feat`）并推送——验证：本地 tsc+build+测试脚本全绿

## 4. 阶段四：Gitee 自动同步与数据安全

- [ ] 4.1 Rust 新增备份命令：推送前复制 `promptpal_data.json` 为 `promptpal_data.backup-<ts>.json`，保留最近 5 份滚动清理——验证：`cargo build` 通过，手测备份生成与第 6 次时最旧被清
- [ ] 4.2 前端自动推送：autoExport 落盘成功后 60s 防抖推送（仅启用且已配置），连续 3 次失败同步区告警、成功解除——验证：手测改动后自动推送生效、断网复现告警
- [ ] 4.3 启动拉取：按导出 JSON 的 `exportedAt` 对比——本地为空静默拉取、远端较新弹确认、否则不打扰——验证：手测三场景
- [ ] 4.4 退出兜底推送：退出前尽力推送未推送改动，最长 3s，失败不阻塞退出——验证：手测改完即退远端收到、断网时正常退出
- [ ] 4.5 手动推送/拉取/连接验证回归——验证：手测三入口行为与升级前一致
- [ ] 4.6 阶段四 commit（`feat`）并推送——验证：本地 tsc+build+测试脚本全绿

## 5. 收尾：CI、版本与终验

- [ ] 5.1 新建 `.github/workflows/ci.yml`：Node 22，`npm ci` → `tsc --noEmit` → `vite build` → `node scripts/test-pure.mjs`，push(main) 与 PR 触发——验证：GitHub Actions 首跑全绿
- [ ] 5.2 版本对齐 1.3.0：package.json、README 徽章、CHANGELOG 补 v1.3.0 条目——验证：三处版本一致
- [ ] 5.3 全量终验：对照三份 spec 逐条 scenario 过手测清单，全部通过后执行 `openspec archive`
