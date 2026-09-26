# Spec Delta — cli-variable-fill

## Purpose

让终端 CLI（Rust pal.exe 与 Node pal.js 双端）选中带变量的提示词时获得与主面板一致的填空体验，补齐 UI 与 CLI 的能力差。

## ADDED Requirements

### Requirement: CLI 交互填空
CLI 选中提示词后：内容含变量时 SHALL 逐项提示输入（显示变量名与语法原文），用户输入后回车确认；留空（直接回车）的变量 SHALL 保留占位符原文；全部处理完成后复制替换后的文本并给出确认输出。无变量提示词的行为 MUST 与现状一致。

#### Scenario: Rust 端填空复制
- **WHEN** 用户在 pal.exe 中选中内容为「画一张 [风格] 的图」的提示词并输入「水彩」
- **THEN** 剪贴板内容为「画一张 水彩 的图」

#### Scenario: 留空保留
- **WHEN** 某变量直接回车跳过
- **THEN** 该占位符原文保留在复制结果中

### Requirement: 解析规则一致
CLI 的变量识别规则 MUST 与主面板一致：`[名称]` 与 `{{名称}}` 双语法、名称 1–40 字符、排除 `--` 开头参数、同名去重按首现顺序。Rust 与 Node 两端对同一输入 MUST 产生相同的变量列表与替换结果。

#### Scenario: 双端一致
- **WHEN** 同一条含 `--ar 16:9` 与 `[风格]` 的提示词分别在两端处理
- **THEN** 两端均识别出仅 `[风格]` 一个变量，替换结果相同
