# Spec Delta — pet-sprite-skin

## ADDED Requirements

### Requirement: 精灵模式状态角标
精灵造型启用时，agent 状态（working/done/error）SHALL 以彩色角标叠加显示于精灵图层；角标的出现与颜色规则 MUST 与 CSS 机器人的徽章一致，且 MUST NOT 改变精灵帧的选取与播放。

#### Scenario: 精灵模式显示角标
- **WHEN** 精灵造型启用且代理状态为 working
- **THEN** 精灵图层上方出现蓝色脉冲角标，精灵帧播放不受影响

#### Scenario: 无状态无角标
- **WHEN** 代理无状态或总开关关闭
- **THEN** 精灵图层无角标
