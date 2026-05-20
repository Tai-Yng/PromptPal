# PromptPal CLI

在终端中快速访问你的 Prompt 集合。

## 安装

```bash
# 进入 CLI 目录
cd cli

# 安装依赖
npm install

# 全局安装（推荐）
npm link

# 或者使用 \Pal 命令
npm link
```

## 使用方法

### 基本用法

```bash
# 交互式选择
Pal

# 或使用反斜杠命令
\Pal
```

### 搜索

```bash
# 直接搜索
Pal react

# 按分类搜索
Pal -c code
```

### 其他命令

```bash
# 随机获取一个 prompt
Pal -r

# 列出所有 prompts
Pal list

# 按分类列出
Pal list -c code

# 添加新 prompt
Pal add "My Prompt" "This is the content..." -c code -t "tag1,tag2"
```

## 交互流程

1. 输入 `Pal` 启动
2. 选择分类（All / Code / Art / Writing / Business / Game / Learning）
3. 选择具体的 Prompt
4. 自动复制到剪贴板
5. 粘贴到你需要的地方！

## 分类说明

| 分类 | 说明 |
|------|------|
| 💻 Code | 编程开发相关 |
| 🎨 Art | AI 绘画提示词 |
| ✍️ Writing | 写作相关 |
| 💼 Business | 商业文档 |
| 🎮 Game | 游戏设计 |
| 📖 Learning | 学习教育 |

## 配置

Prompts 存储在 `~/.promptpal/prompts.json`

你可以手动编辑此文件来管理你的 prompts。

## 与 PromptPal 应用同步

CLI 工具会尝试读取 PromptPal 应用的数据文件，实现数据同步。
