# pet-sprite-skin Specification

## Purpose
让用户用自己的精灵图替换默认 CSS 机器人形象，按状态配置帧动画并随时一键回退；导入有格式与大小护栏，渲染有故障兜底，升级不破坏既有配置。

## Requirements

### Requirement: 精灵图导入
系统 SHALL 允许用户选择本地 PNG 或 WebP 图片作为桌宠造型，且文件大小 MUST ≤ 5MB；通过 Tauri 命令持久化到 `~/.promptpal/pet_sprite.png`。格式不符或超限时系统 SHALL 拒绝导入并给出明确提示。非 Tauri 环境（浏览器开发模式）SHALL 降级为 data URL 保存。

#### Scenario: 合规导入成功
- **WHEN** 用户选择一张 3MB 的 PNG 并确认导入
- **THEN** 图片写入 `~/.promptpal/pet_sprite.png`，桌宠切换为精灵渲染模式

#### Scenario: 超限拒绝
- **WHEN** 用户选择一张 6MB 的图片
- **THEN** 导入被拒绝并提示大小超限，现有造型不变

### Requirement: 状态帧映射
用户 SHALL 能为 walk、idle、sleep 三个状态分别配置「起始帧 + 帧数」，配置过程中界面 SHALL 实时预览播放效果；越界帧号（起始帧+帧数超出总帧数）SHALL 自动钳制到合法范围；未配置的状态 SHALL 复用 walk 帧序列。播放帧率 SHALL 可选 4/8/12/16 fps，默认 8。

#### Scenario: 配置并预览
- **WHEN** 用户将 walk 配置为起始帧 1、帧数 4
- **THEN** 预览按当前帧率循环播放第 1–4 帧

#### Scenario: 越界钳制
- **WHEN** 用户填入起始帧 7、帧数 4 而总帧数为 8
- **THEN** 配置被钳制为合法范围（如帧数调整为 2），预览与实际播放不越界

#### Scenario: 未配置回退
- **WHEN** 用户只配置了 walk，未配置 sleep
- **THEN** 睡眠状态播放 walk 帧序列，不出现空白或报错

### Requirement: 精灵渲染与回退
启用精灵造型后，桌宠 SHALL 以 `background-position` 切帧方式按当前状态播放对应帧序列；图片缺失、文件损坏或渲染异常时系统 SHALL 自动回落到默认 CSS 机器人，不影响桌宠其他功能。

#### Scenario: 状态切换播放
- **WHEN** 桌宠从行走进入睡眠
- **THEN** 精灵图层切换到 sleep 帧序列按配置帧率播放

#### Scenario: 图片缺失回落
- **WHEN** `pet_sprite.png` 被手动删除后应用重启
- **THEN** 桌宠自动回落 CSS 机器人渲染，无报错弹窗

### Requirement: 设置互斥与恢复
精灵模式启用时，PetTab 的颜色与形状设置区 SHALL 隐藏，并显示精灵状态提示与「恢复默认机器人」操作；恢复后系统 SHALL 清除全部精灵配置并回到 CSS 渲染（主题/颜色设置恢复可用）。

#### Scenario: 互斥显示
- **WHEN** 精灵模式启用
- **THEN** 颜色/形状区不可见，显示精灵提示与恢复按钮

#### Scenario: 一键恢复
- **WHEN** 用户点击「恢复默认机器人」
- **THEN** 精灵配置全部清除，CSS 机器人恢复，颜色/形状区重新可见

### Requirement: 配置升级无损
schema v2 迁移 SHALL 为旧版本配置补充新增字段（spritePath/frameMap/frameRate）的缺省值；升级后用户的主题、颜色、形状配置 MUST 保持不变，缺省状态即 CSS 模式。

#### Scenario: 旧数据升级无损
- **WHEN** v1.3 的配置数据在 v1.4 首次加载
- **THEN** 主题/颜色/形状原样保留，桌宠以 CSS 模式运行，schema 版本标记为 2

### Requirement: ZIP 整包导入
导入界面 SHALL 接受 Shimeji 形象包 ZIP 文件：前端解压后取 `img/` 目录下符合 `shime<数字>.png` 命名的帧图拼条（无该命名时回落全部 PNG 并提示）；conf 目录下的动作定义 XML SHALL 被自动解析（兼容 Shimeji-ee 英文与 Group-Finity 日文两种标签格式）。无 conf XML 时 SHALL 回落到现有手填流程并提示。

#### Scenario: 皮卡丘包一键导入
- **WHEN** 用户导入包含日文 conf XML 与 46 帧 shime*.png 的 ZIP
- **THEN** 帧图拼条成功，walk/idle/sleep 自动填入解析出的帧序列，预览可见

#### Scenario: 无 conf 回落
- **WHEN** 用户导入仅含 PNG 无动作 XML 的 ZIP
- **THEN** 拼条成功但帧映射留空，提示手动配置

### Requirement: 动作语义映射
XML 解析 SHALL 按动作名关键词映射到应用状态：walk ← Walk/歩く/走る 类，idle ← Stand/立つ/座る 类，sleep ← Sleep/寝そべる/寝る 类；每个状态取第一个匹配动作的帧序列（按首次出现顺序去重）；未命中的状态保持未配置（渲染回退 walk 序列）。自动映射结果 SHALL 可被用户手动修改。

#### Scenario: 日文包映射
- **WHEN** 解析到動作「歩く」帧序列 [1,2,1,3]、「立つ」[1]、「寝そべる」[21]
- **THEN** walk=[1,2,1,3]、idle=[1]、sleep=[21]

#### Scenario: 未命中回退
- **WHEN** XML 中无任何 sleep 类动作
- **THEN** sleep 状态保持未配置，渲染时回退 walk 序列

### Requirement: 帧列表数据模型
帧映射值 SHALL 支持可选帧列表（如 [1,2,1,3]），存在时渲染端按列表顺序循环播放并优先于 start+count 区间；旧 start+count 配置 MUST 继续有效；schema v3 迁移 SHALL 对旧数据无损。

#### Scenario: 非连续播放
- **WHEN** walk 配置为帧列表 [1,2,1,3]
- **THEN** 播放顺序为第 1、2、1、3 帧循环

#### Scenario: 旧配置兼容
- **WHEN** v1.4 的 start+count 配置在 v1.5 加载
- **THEN** 播放行为与升级前一致
