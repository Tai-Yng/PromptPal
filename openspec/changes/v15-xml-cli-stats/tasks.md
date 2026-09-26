# Tasks

## 1. 帧列表模型 + ZIP/XML 导入

- [x] 1.1 schema v3：`SpriteFrameRange.frames?` 帧列表字段，`storage.ts` 迁移链 v2→v3，渲染端 rangeFor 按序列播放（frames 优先于区间），纯函数测试覆盖 v2 数据无损——验证：`node scripts/test-pure.mjs` 全绿
- [x] 1.2 新建 `services/shimejiXml.ts`：双格式动作提取 + 关键词语义映射 + 帧号解析，并补纯函数断言（日文样例取自真实包）——验证：测试脚本全绿
- [x] 1.3 安装 fflate，`spriteStitch.ts` 增加 ZIP 入口（解包→img 帧图筛选→拼条→conf XML 映射），PetTab 导入按钮支持选 ZIP，自动预填三状态帧列表（可改）——验证：`npx tsc --noEmit` + build 通过
- [x] 1.4 用真实皮卡丘 ZIP 端到端手测：导入→自动映射正确（walk=[1,2,1,3] 类）→预览→enable 渲染——验证：tauri:dev 手测通过
- [x] 1.5 组 1 commit（`feat(pet): shimeji zip import with xml mapping`）并推送——验证：CI 绿

## 2. CLI 变量填空（Rust + Node）

- [x] 2.1 Rust `cli-rs/src/main.rs`：手写变量扫描器（双语法/`--` 排除/去重）+ dialoguer Input 循环填空 + 替换复制，`cargo build --release` 通过——验证：手测样例（含 `--ar 16:9 [风格]`）输出与 UI 一致
- [x] 2.2 Node `cli/bin/pal.js`：同步变量填空（inquirer input 循环），规则与 Rust 端一致——验证：`node cli/bin/pal.js` 手测同一样例
- [x] 2.3 组 2 commit（`feat(cli): variable fill-in on both runtimes`）并推送——验证：CI 绿

## 3. 统计面板

- [x] 3.1 新建 `StatsPanel.vue`（概览四数字 + Top10 bar + 分类分布 bar + 空状态），PanelPage nav 加 stats 视图——验证：build 通过，手测数字与库数据一致
- [x] 3.2 组 3 commit（`feat(panel): usage stats view`）并推送——验证：CI 绿

## 4. 收尾

- [ ] 4.1 版本 1.5.0：package.json、README 徽章、CHANGELOG——验证：三处一致
- [ ] 4.2 全量终验：对照三份 spec 场景手测，通过后 `openspec archive`
