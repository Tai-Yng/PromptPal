# Spec Delta — agent-state-link

## Purpose

让桌宠实时感知外部 AI 编码代理（ZCode / Claude Code / Codex）的工作状态并可视呈现，完成时主动庆祝提示；接入全程一键化、可卸载、不破坏用户既有 hook 配置。

## ADDED Requirements

### Requirement: Hook 一键安装与卸载
设置面板 SHALL 提供 ZCode、Claude Code、Codex 三个代理的接入开关。开启时安装器 SHALL 向对应配置文件追加带特征标记的 hook 条目（ZCode/Claude 写 JSON 的 hooks.events 数组，Codex 写 config.toml 的 `[hooks.*]` TOML 数组），追加前 MUST 检测标记防止重复；已存在的用户自有条目 MUST 原样保留；关闭时 SHALL 仅移除带标记的条目并保持文件其余内容不变。

#### Scenario: ZCode 接入共存
- **WHEN** 用户开启「接入 ZCode」，其 config.json 的 hooks.events.Stop 已有自有条目
- **THEN** 新 hook 条目被追加到数组，自有条目不变，hooks.enabled 保持 true

#### Scenario: Codex TOML 追加
- **WHEN** 用户开启「接入 Codex」
- **THEN** config.toml 增加 `[hooks.PostToolUse]`/`[hooks.Stop]` 数组条目，既有 `notify` 配置不受影响

#### Scenario: 重复开启防重
- **WHEN** 接入开关已开启时再次开启
- **THEN** 配置中不产生重复条目

#### Scenario: 卸载干净
- **WHEN** 用户关闭某代理接入开关
- **THEN** 仅带标记的条目被移除，其余配置内容不变

### Requirement: 状态文件协议
Hook 进程 SHALL 把 `{agent, state, ts}` 写入 `~/.promptpal/agent_state.json`（state ∈ working/done/idle，ts 为毫秒时间戳）；桌宠 SHALL 以不超过 1 秒的周期轮询该文件；距最后更新超过 90 秒后桌宠 SHALL 回落 idle 状态。协议解析 SHALL 容忍文件损坏（损坏视为无状态）。

#### Scenario: 状态更新生效
- **WHEN** hook 写入 `{agent:"zcode", state:"working", ts:<now>}`
- **THEN** 1 秒内桌宠显示 working 徽章

#### Scenario: 超时回落
- **WHEN** 状态文件 90 秒无更新
- **THEN** 桌宠回落 idle，徽章消失

#### Scenario: 损坏容忍
- **WHEN** 状态文件内容损坏
- **THEN** 桌宠按无状态处理，不报错

### Requirement: 状态徽章与庆祝
代理 working 时桌宠 SHALL 显示蓝色脉冲徽章；done 时 SHALL 显示绿色徽章、触发庆祝小跳与「✓ Agent done」气泡；徽章在巡逻/睡眠之外的所有状态下随头顶显示。总开关关闭时 MUST 无任何轮询与徽章。

#### Scenario: 完成庆祝
- **WHEN** 代理状态变为 done
- **THEN** 桌宠庆祝小跳并显示完成气泡，徽章转绿

#### Scenario: 总开关关闭
- **WHEN** 设置面板总开关关闭
- **THEN** 不轮询状态文件、不显示徽章，桌宠行为与 v1.5 一致
