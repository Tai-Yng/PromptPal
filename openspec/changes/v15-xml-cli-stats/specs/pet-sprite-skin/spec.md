# Spec Delta — pet-sprite-skin（扩展）

## ADDED Requirements

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
