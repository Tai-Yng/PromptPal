# PromptPal 功能文档

> 科技感终端风桌面 Prompt 管理工具，带有 DeepSeek 风格机器人桌宠
> 更新日期：2026-05-26

---

## 核心功能概览

| 模块 | 功能 | 状态 |
|------|------|------|
| 桌宠系统 | CSS 绘制科技风机器人，自动行走、智能感知、拖拽移动 | ✅ 完成 |
| Prompt 管理 | 本地存储、分类、搜索、收藏、导入导出 | ✅ 完成 |
| AI 生成 | 接入 DeepSeek/OpenAI/Claude API，流式输出 | ✅ 完成 |
| 快捷注入 | Ctrl+Alt+P 全局热键，任意应用内选择粘贴 | ✅ 完成 |
| 数据同步 | Gitee 云端同步、本地 JSON 文件导入导出 | ✅ 完成 |
| CLI 工具 | 终端交互式提示词选择器 (`pal` 命令) | ✅ 完成 |
| 样式自定义 | 8 套预设主题、颜色调整、形状参数 | ✅ 完成 |

---

## 一、桌宠系统

### 1.1 外观
- **风格**：科技风机器人（CSS 绘制），天线 + 面罩 + 发光眼睛 + 核心
- **位置**：桌面右下角
- **尺寸**：120x200 像素窗口

### 1.2 行为

| 行为 | 说明 |
|------|------|
| 自动行走 | 沿屏幕底部水平移动，到边缘自动调头 |
| 随机暂停 | 约 6% 概率暂停，模拟思考状态 |
| 随机跳帧 | 约 1.5% 概率小幅跳跃 |
| 随机调头 | 约 2% 概率中途改变方向 |
| 速度微调 | 行走速度带有正弦波抖动，更自然 |
| 休眠 | 空闲超时后进入睡眠（显示 Zzz），可配置或关闭 |

### 1.3 互动

| 操作 | 效果 |
|------|------|
| 拖拽 | 移动桌宠到任意位置，松开后记忆位置 |
| 单击 | 复制默认提示词到剪贴板（可配置开关） |
| 双击 | 打开 Prompt 管理面板 |
| 右键 | 弹出菜单：Show Panel / Exit |

### 1.4 智能感知
- 每 5 秒检测当前活跃窗口标题
- 匹配预设规则（ChatGPT、VS Code、Midjourney、Obsidian 等）
- 弹出气泡建议匹配的提示词，点击即可复制
- 同一窗口 30 分钟内不重复提示

---

## 二、Prompt 管理系统

### 2.1 本地管理

| 功能 | 说明 |
|------|------|
| 创建 | 输入标题、内容、分类、标签 |
| 编辑 | 点击卡片编辑按钮，修改任意字段 |
| 删除 | 点击删除按钮移除 |
| 收藏 | 星标标记，可在列表筛选 |
| 复制 | 双击卡片内容区域 |
| 分类 | Chat / Code / Image / Writing / Other |

### 2.2 卡片交互

| 操作 | 效果 |
|------|------|
| 点击卡片 | 展开/折叠，查看完整内容 |
| 双击内容 | 复制到剪贴板 |
| 使用计数 | 每次复制自动 +1，按次数排序 |

### 2.3 导入导出
- **导出**：浏览器下载 JSON 文件
- **导入**：选择 JSON 文件恢复数据
- **自动导出**：每次修改提示词后 2 秒自动保存到 `~/.promptpal/promptpal_data.json`

---

## 三、AI 生成功能

### 3.1 支持的 AI 提供商

| 提供商 | 模型示例 |
|--------|----------|
| DeepSeek | deepseek-chat, deepseek-reasoner, deepseek-v4 |
| OpenAI | gpt-4.1, gpt-4o, gpt-4o-mini, o4-mini |
| Claude | claude-sonnet-4, claude-3.5-sonnet |
| Custom | 任意 OpenAI 兼容端点 |

### 3.2 功能模式
- **生成模式**：根据描述生成新 Prompt
- **优化模式**：改进现有 Prompt 质量
- **流式输出**：实时逐字显示生成结果

---

## 四、快捷注入系统

### 全局热键：`Ctrl+Alt+P`
- 系统级快捷键，任意应用中可用
- 弹出 380x440 浮动窗口
- ↑↓ 键选择 Prompt
- Enter 复制到剪贴板
- 自动关闭

---

## 五、CLI 命令行工具

### 使用
```bash
pal
```
- 上下箭头选择提示词
- 分类分组显示（标注收藏 * 和使用次数）
- Enter 复制到剪贴板
- Ctrl+C 退出

### 安装
```bash
cd cli
npm install
npm link
```

### 数据源
读取 `~/.promptpal/promptpal_data.json`（PromptPal 自动导出）

---

## 六、数据同步

### Gitee 云端同步
- 配置 token + owner/repo + 文件路径
- push：上传本地数据到 Gitee 仓库
- pull：从 Gitee 拉取数据到本地
- verify：测试连接
- Token 需要 `projects` 权限

### 本地文件
- export：下载 JSON 备份
- import：从 JSON 恢复

---

## 七、样式自定义系统

### 7.1 预设主题（8套）

| 主题 | 主色调 |
|------|--------|
| Cyan Tech | 青色 #00D4AA |
| Crimson Bot | 红色 #EF4444 |
| Emerald Unit | 绿色 #22C55E |
| Violet Core | 紫色 #A855F7 |
| Amber Droid | 橙色 #F97316 |
| Rose Companion | 粉色 #EC4899 |
| Golden Bot | 金色 #EAB308 |
| Arctic Unit | 白色 #E2E8F0 |

### 7.2 颜色自定义
- primaryColor — 主色（眼睛、核心）
- secondaryColor — 次色（天线球）
- bodyColor — 身体颜色
- bodyBorderColor — 身体边框
- visorColor — 面罩颜色
- eyeColor — 眼睛发光色

### 7.3 形状参数（0.5x–1.5x）
- headSize — 头部大小
- bodySize — 身体大小
- antennaHeight — 天线高度

---

## 八、技术架构

### 技术栈
| 层 | 技术 |
|----|------|
| 前端 | Vue 3 + TypeScript + Pinia |
| 构建 | Vite 8 |
| 桌面 | Tauri 2.x (Rust) |
| 热键 | tauri-plugin-global-shortcut |
| API | DeepSeek / OpenAI / Claude |
| 同步 | Gitee API v5 (ureq) |
| CLI | Node.js + @inquirer/prompts |
| 样式 | CSS 变量 + DeepSeek CMD 终端暗色主题 |

### 数据持久化（localStorage）
- `promptpal_prompts` — Prompt 数据
- `promptpal_categories` — 分类数据
- `promptpal_ai_config` — AI 配置
- `promptpal_pet_config` — 桌宠配置
- `promptpal_pet_style` — 样式配置
- `promptpal_gitee_config` — Gitee 同步配置

---

## 九、使用指南

### 快速开始
1. 启动后桌宠出现在桌面右下角
2. 双击桌宠 → 打开管理面板
3. Settings → AI Config → 填入 API Key
4. 开始创建和管理 Prompt
5. 任意应用中 Ctrl+Alt+P 快速选取
6. 终端中 `pal` 命令选取

### 退出方式
- 系统托盘右键 → Exit PromptPal
- 桌宠右键 → Exit
- Settings 底部 → x exit PromptPal

---

## 更新日志

### v1.0.0 (2026-05-26)
- DeepSeek CMD 终端风 UI 全面改造
- 桌宠颜色/形状即时生效
- 退出功能（托盘/右键/Settings 三入口）
- Gitee 云端同步（push/pull）
- Ctrl+Alt+P 全局快捷注入
- CLI 工具 `pal` 命令
- AI 模型列表扩展（DeepSeek V3/V4, GPT-4.1 等）
- 配置修改即时生效（速度/睡眠）
- 自动导出到 JSON 文件

#PromptPal #Tauri #Vue3 #TypeScript #Rust
