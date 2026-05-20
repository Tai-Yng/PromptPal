# PromptPal Windows 构建指南

## 环境要求

- **Node.js** 18+ 
- **Rust** 1.70+ (已安装)
- **Tauri CLI** 2.x

## 构建步骤

### 1. 安装 Tauri CLI（如果尚未安装）

```bash
cargo install tauri-cli --version "^2"
```

### 2. 安装前端依赖

```bash
cd PromptPal
npm install
```

### 3. 构建应用

```bash
# 完整构建（前端 + Tauri）
cargo tauri build

# 或者分步构建
# 1. 构建前端
npm run build

# 2. 构建 Tauri（需要 cargo 在 PATH 中）
cargo tauri build
```

## 安装包输出位置

构建完成后，安装包位于：

```
src-tauri/target/release/bundle/
├── msi/          # Windows MSI 安装包
│   └── PromptPal_1.0.0_x64_en-US.msi
└── nsis/         # Windows NSIS 安装包
    └── PromptPal_1.0.0_x64-setup.exe
```

## 安装目录自定义

安装时可以选择安装目录：
- **MSI 安装包**：支持标准 Windows 安装流程，可自定义安装路径
- **NSIS 安装包**：支持自定义安装路径

## 开发模式运行

```bash
# 启动开发服务器
cargo tauri dev
```

## 项目结构

```
PromptPal/
├── src/                    # Vue 前端源码
│   ├── components/         # Vue 组件
│   ├── services/           # 服务层
│   ├── stores/             # Pinia 状态管理
│   └── ...
├── src-tauri/              # Tauri Rust 后端
│   ├── src/                # Rust 源码
│   ├── Cargo.toml          # Rust 依赖
│   └── tauri.conf.json     # Tauri 配置
├── cli/                    # CLI 工具
├── docs/                   # 文档
└── dist/                   # 构建输出（前端）
```

## 注意事项

1. **首次构建**需要下载大量依赖，可能需要 10-30 分钟
2. **Release 构建**生成的安装包约 5-10MB
3. **Windows 要求**：Windows 10 1803+ 或 Windows 11
4. **WebView2**：安装包会自动安装 WebView2 运行时（如未安装）

## 故障排除

### cargo tauri 命令未找到
确保 cargo bin 目录在 PATH 中：
```powershell
$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
```

### 构建失败
1. 清理缓存：`cargo clean`
2. 更新依赖：`cargo update`
3. 重新构建：`cargo tauri build`

### 前端构建失败
```bash
rm -rf node_modules
npm install
npm run build
```
