# PromptPal 🐱✨

> 你的桌面 Prompt 助手 - 可爱的桌宠形态 Prompt 管理工具

![PromptPal](https://img.shields.io/badge/Version-1.0.0-pink)
![Vue](https://img.shields.io/badge/Vue-3.x-green)
![Tauri](https://img.shields.io/badge/Tauri-Ready-blue)

## 📖 项目简介

PromptPal 是一款 Windows 桌面应用，以可爱的桌宠形式帮助您管理和使用 Prompt。支持本地存储、网络热门 Prompt 搜索，一键复制粘贴。

## ✨ 功能特性

### 🐱 桌宠模式
- 可爱的猫咪桌宠，在桌面右下角待命
- 支持拖拽移动位置
- 点击弹出 Prompt 管理面板
- 悬停显示提示气泡
- 随机表情变化（开心、困倦等）

### 📝 Prompt 管理
- **本地存储**: 自定义添加、编辑、删除 Prompt
- **分类管理**: 对话AI、图像生成、编程助手、写作助手等
- **标签系统**: 为 Prompt 添加标签，方便搜索
- **收藏功能**: 标记常用 Prompt
- **使用统计**: 记录 Prompt 使用频率
- **导入/导出**: JSON 格式数据备份

### 🌐 网络搜索
- **PromptHero**: 搜索热门 AI 艺术 Prompt
- **OpenArt**: AI 绘画 Prompt 社区
- **FlowGPT**: Prompt 分享平台
- 一键导入网络 Prompt 到本地

### 🎨 可爱动漫风 UI
- 粉色主题配色
- 圆角卡片设计
- 流畅动画效果
- 毛玻璃效果

## 🛠️ 技术栈

| 技术 | 用途 |
|------|------|
| Vue 3 + TypeScript | 前端框架 |
| Pinia | 状态管理 |
| Vite | 构建工具 |
| Tauri (Rust) | 桌面应用框架 |
| CSS3 | 动画与样式 |

## 📁 项目结构

```
PromptPal/
├── src/
│   ├── components/          # Vue 组件
│   │   ├── DesktopPet.vue   # 桌宠组件
│   │   ├── PromptPanel.vue  # Prompt 面板
│   │   ├── PromptCard.vue   # Prompt 卡片
│   │   ├── PromptEditor.vue # Prompt 编辑器
│   │   └── NetworkSearch.vue# 网络搜索
│   ├── stores/              # Pinia 状态管理
│   │   └── promptStore.ts   # Prompt 状态
│   ├── types/               # TypeScript 类型
│   │   └── index.ts
│   ├── App.vue              # 根组件
│   ├── main.ts              # 入口文件
│   └── style.css            # 全局样式
├── index.html
├── vite.config.ts
├── package.json
└── README.md
```

## 🚀 快速开始

### 前置要求

- Node.js 18+
- npm 或 yarn
- Rust (用于 Tauri 桌面应用)

### 安装 Rust

1. 访问 https://rustup.rs/
2. 下载并运行 `rustup-init.exe`
3. 选择默认安装选项
4. 重启终端使环境变量生效

### 运行开发服务器

```bash
# 进入项目目录
cd PromptPal

# 安装依赖
npm install

# 启动前端开发服务器
npm run dev
```

### 构建 Tauri 应用

```bash
# 安装 Tauri CLI
npm install -D @tauri-apps/cli

# 初始化 Tauri
npm run tauri init

# 开发模式运行
npm run tauri dev

# 构建生产版本
npm run tauri build
```

## 📋 使用说明

### 基本操作

1. **打开面板**: 点击桌宠猫咪
2. **复制 Prompt**: 点击 Prompt 卡片内容区域
3. **添加 Prompt**: 点击右下角 `+` 按钮
4. **编辑 Prompt**: 点击卡片上的 ✏️ 图标
5. **收藏 Prompt**: 点击卡片上的 ☆ 图标
6. **删除 Prompt**: 点击卡片上的 🗑️ 图标

### 搜索 Prompt

1. 切换到「网络」标签页
2. 输入关键词搜索
3. 选择来源平台筛选
4. 点击「导入」保存到本地

## 🎯 后续计划

- [ ] Live2D 动态模型支持
- [ ] 侧边栏模式
- [ ] 全局快捷键
- [ ] 拖拽粘贴功能
- [ ] AI 智能推荐
- [ ] 多主题支持

## 📄 许可证

MIT License

---

**PromptPal** - 让 Prompt 管理变得可爱又高效！ 🐱✨
