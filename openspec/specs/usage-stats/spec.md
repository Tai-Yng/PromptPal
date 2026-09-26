# usage-stats Specification

## Purpose
把一直在采集的使用数据（useCount）变成可见的统计视图，帮助用户了解自己的提示词使用习惯，不引入图表依赖。

## Requirements

### Requirement: 统计概览
面板 SHALL 新增统计视图，展示：提示词总数、总使用次数（ΣuseCount）、收藏数、有使用记录的提示词数（useCount>0）。数据 SHALL 由当前提示词库实时计算（无独立存储）。

#### Scenario: 概览数字
- **WHEN** 库中有 12 条提示词、累计使用 47 次、收藏 3 条
- **THEN** 概览显示 12 / 47 / 3，以及 useCount>0 的条数

### Requirement: 排行与分布
统计视图 SHALL 展示：Top 10 使用排行（标题+次数，按 useCount 降序，0 次不进榜，横向 bar 表示相对占比）；分类分布（各分类提示词数量与占比 bar）。列表为空时 SHALL 显示空状态提示。

#### Scenario: Top 10 排序
- **WHEN** 多条提示词 useCount 不同
- **THEN** 榜单按 useCount 降序取前 10，bar 长度与最高值成比例

#### Scenario: 空库状态
- **WHEN** 提示词库为空
- **THEN** 显示空状态提示而非空白页
