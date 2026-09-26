# Tasks

## 1. 数据与迁移

- [x] 1.1 `petStyleStore` 新增 `spritePath`/`frameMap`/`frameRate` 字段（含类型与缺省），`storage.ts` 迁移链注册 v1→v2 迁移，纯函数测试覆盖旧数据升级无损——验证：`node scripts/test-pure.mjs` 全绿（新增迁移用例）
- [x] 1.2 Rust 新增 `save_pet_sprite`/`load_pet_sprite` 命令（base64 读写 `~/.promptpal/pet_sprite.png`，保存侧校验 ≤5MB），注册到 invoke_handler——验证：`cargo check` 通过
- [x] 1.3 组 1 独立 commit（`feat(pet): sprite data layer + schema v2`）并推送——验证：CI 绿

## 2. 精灵渲染与导入 UI

- [x] 2.1 DesktopPet 精灵渲染分支：精灵图层 div（background-image + background-position 切帧）+ 帧定时器（frameRate 可调）+ 按 state 取 frameMap 序列 + 未配置回退 walk + 图片缺失/渲染异常回落 CSS 机器人——验证：`tauri:dev` 手测状态切换播放、删图回落
- [x] 2.2 PetTab 导入 UI：文件选择（Tauri dialog）→ 格式/大小校验（≤5MB，超限拒绝提示）→ 帧宽/帧高/总帧数/三状态帧映射表单 + 实时预览 + 帧率四档 + 精灵模式下隐藏颜色/形状区并显示「恢复默认机器人」——验证：手测合规导入、超限拒绝、越界钳制、互斥显示、一键恢复
- [x] 2.3 组 2 独立 commit（`feat(pet): sprite skin import & render`）并推送——验证：tsc + build + 测试脚本全绿，CI 绿

## 3. 全屏漫游修复

- [x] 3.1 `usePetMovement` 锚点数学：`PET_OFFSET_X/Y` 常量化，行走边界与拖拽钳制改为机器人锚（窗口 x ∈ `[-122, 屏宽-218]`、y ∈ `[-272, 屏高-388]`）——验证：手测机器人可达屏幕左右缘与顶部，脚部贴地不变
- [x] 3.2 目标驱动巡逻：target 边状态 + 直走到底 + 到边 40% 发呆（5–10s）/否则短停（0.5–1.5s）掉头 + 中途掉头 2%→0.3% + 小跳保留 + `updateWorkArea` 挂入 10s 定时器——验证：手测连续两次全屏横穿、到边两种行为、改缩放 10s 内自适应
- [x] 3.3 组 3 独立 commit（`fix(pet): robot-anchored roaming + patrol walk`）并推送——验证：全量检查绿（tsc/build/test/CI）

## 4. 收尾

- [ ] 4.1 版本 1.4.0：package.json、README 徽章、CHANGELOG v1.4.0 条目——验证：三处一致
- [ ] 4.2 全量终验：对照两份 spec 逐条 scenario 过手测清单，全部通过后 `openspec archive`（v13 与 v14 一并归档）
