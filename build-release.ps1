# PromptPal Windows 构建脚本

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PromptPal Windows 构建脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 设置完整的环境变量
$env:PATH = "C:\Users\lyer\.cargo\bin;C:\Users\lyer\.cargo\bin\..;" + $env:PATH
$env:CARGO_HOME = "C:\Users\lyer\.cargo"
$env:RUSTUP_HOME = "C:\Users\lyer\.rustup"
$env:SYSTEMROOT = "C:\Windows"

# 验证 cargo 可用
Write-Host "验证 Rust 环境..." -ForegroundColor Yellow
& "C:\Users\lyer\.cargo\bin\cargo.exe" --version

Write-Host ""
Write-Host "Step 1: 构建前端..." -ForegroundColor Yellow
Set-Location "C:\Users\lyer\AppData\Roaming\TRAE SOLO CN\ModularData\ai-agent\work-mode-projects\6a09d2c1a2819317bb379a64\PromptPal"
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "前端构建失败!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 2: 构建 Tauri 应用..." -ForegroundColor Yellow

# 使用 cargo tauri build
& "C:\Users\lyer\.cargo\bin\cargo.exe" tauri build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Tauri 构建失败!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  构建完成!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

# 显示输出文件
$bundleDir = "C:\Users\lyer\AppData\Roaming\TRAE SOLO CN\ModularData\ai-agent\work-mode-projects\6a09d2c1a2819317bb379a64\PromptPal\src-tauri\target\release\bundle"
if (Test-Path $bundleDir) {
    Write-Host ""
    Write-Host "安装包位置:" -ForegroundColor Cyan
    Get-ChildItem $bundleDir -Recurse -Include "*.msi","*.exe" | ForEach-Object {
        Write-Host "  $($_.FullName)" -ForegroundColor White
    }
}
