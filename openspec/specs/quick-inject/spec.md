# quick-inject Specification

## Purpose
让全局快捷注入窗口（Ctrl+Alt+P）在提示词库增长后仍能快速定位目标，并把变量填空纳入复制流程，保持键盘优先的交互闭环。

## Requirements

### Requirement: 搜索过滤
注入窗口 SHALL 提供打开时自动聚焦的搜索框，输入即时按 title、content、tags 不区分大小写过滤列表；清空输入 SHALL 恢复完整列表。

#### Scenario: 即输即滤
- **WHEN** 用户在搜索框输入 `sql`
- **THEN** 列表仅剩 title、content 或 tags 含 `sql`（不区分大小写）的提示词

#### Scenario: 自动聚焦
- **WHEN** 注入窗口打开
- **THEN** 焦点位于搜索框，可直接输入

### Requirement: 排序与标识
列表 SHALL 按「收藏优先、useCount 降序」排序；每个列表项 SHALL 显示其分类对应的色点标识。

#### Scenario: 排序稳定
- **WHEN** 列表同时含收藏与非收藏、高低使用次数的提示词
- **THEN** 收藏项排前，同组内 useCount 高者排前

### Requirement: 键盘复制流程
回车选中：内容含变量时 SHALL 进入填空流程（确认或「复制原文」）后复制并关闭窗口；无变量时 SHALL 直接复制并关闭窗口。Esc SHALL 关闭窗口且不复制。复制成功后该提示词的 useCount SHALL 递增。

#### Scenario: 带变量注入
- **WHEN** 用户回车选中一条含变量的提示词并完成填空确认
- **THEN** 替换后的文本写入剪贴板，窗口关闭，useCount 递增

#### Scenario: 无变量注入
- **WHEN** 用户回车选中一条无变量提示词
- **THEN** 原文写入剪贴板，窗口立即关闭

#### Scenario: Esc 取消
- **WHEN** 用户按 Esc
- **THEN** 窗口关闭，剪贴板不变，useCount 不变

### Requirement: 状态隔离
注入窗口的搜索词与选中状态 MUST NOT 影响主面板的列表状态；窗口关闭后下次打开 SHALL 为初始状态。

#### Scenario: 重开归零
- **WHEN** 用户搜索后关闭窗口再次打开
- **THEN** 搜索框为空，列表为完整列表
