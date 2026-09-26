# Proposal

## Why

桌宠是 PromptPal 的门面，但造型只能调整 CSS 机器人的颜色与比例，用户无法换成自己的形象（社区有大量 Shimeji 式现成精灵图却用不上）；同时漫游算法以 340×380 的窗口为锚，而可见机器人只占窗口底部中央 80×100——左右各 138px 水平死区、顶部 280px 垂直不可达，叠加"醉汉漫步"式随机掉头，实际几乎不会横穿全屏（用户实测确认）。v1.3 打好的地基（schema 迁移链、桌宠组合式函数拆分）让这两项改动成本可控。

## What Changes

- **精灵图造型（pet-sprite-skin）**：
  - 导入 PNG/WebP 且 ≤5MB 的图片作为桌宠造型，经新 Rust 命令持久化到 `~/.promptpal/pet_sprite.png`；超限/格式不符拒绝并提示；非 Tauri 环境降级 data URL
  - 帧映射：walk/idle/sleep 三状态各填「起始帧+帧数」，实时预览；越界帧号自动钳制；未配置状态复用 walk 序列
  - 帧率可调 4/8/12/16 fps，默认 8
  - 渲染层：`background-position` 定时切帧播放当前状态序列；渲染失败/图片缺失自动回落 CSS 机器人
  - 设置互斥：精灵模式下隐藏颜色/形状区，显示提示与「恢复默认机器人」按钮
  - schema v2 迁移：`promptpal_pet_style` 新增 spritePath/frameMap/frameRate 可选字段，迁移函数链首次实战
- **全屏漫游修复（pet-roaming）**：
  - 移动与拖拽边界改为**以 80×100 机器人为锚**：机器人水平可达 `[8, 屏宽-88]`（窗口允许部分出屏），脚部贴地线不变
  - 行走算法改为目标驱动巡逻：选定目标边→连续走到底→到边 40% 概率长时间发呆、否则短暂停顿后掉头；小跳保留
  - 速度语义保持不变（用户决策）
  - 工作区尺寸 10s 周期刷新，跟随分辨率/缩放变化
- 版本 1.4.0（package.json / README 徽章 / CHANGELOG）

## Capabilities

### New Capabilities

- `pet-sprite-skin`: 用户以自定义精灵图替换默认桌宠形象的行为——导入校验与持久化、状态帧映射、帧率、渲染与回退、设置互斥
- `pet-roaming`: 桌宠在屏幕上的移动范围与行走行为——机器人锚定边界、目标驱动巡逻、到边行为、工作区自适应

### Modified Capabilities

（无——v1.3 建立的三项能力均不受影响；桌宠运动属新建立的规格能力）

## Impact

- **前端 TS/Vue**：`src/stores/petStyleStore.ts`（新字段 + v2 迁移）、`src/composables/usePetMovement.ts`（锚点数学 + 巡逻 + 工作区刷新）、`src/components/DesktopPet.vue`（精灵渲染图层分支）、`src/components/settings/PetTab.vue`（导入 UI + 互斥显示）、`src/components/pet.css`（精灵图层样式）
- **Rust**：`src-tauri/src/lib.rs` 新增 `save_pet_sprite` / `load_pet_sprite` 命令（写入与读取 `~/.promptpal/pet_sprite.png`，含大小校验）
- **不变**：`useContextSuggest`/`useFocusSync`（上下文感知与专注同步不感知造型变化）、AI 生成链路、同步链路、CLI
