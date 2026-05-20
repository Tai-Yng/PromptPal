@echo off
chcp 65001 >nul
echo ========================================
echo   PromptPal Windows 构建脚本
echo ========================================
echo.

REM 设置环境变量
set PATH=%USERPROFILE%\.cargo\bin;%PATH%
set CARGO_HOME=%USERPROFILE%\.cargo
set RUSTUP_HOME=%USERPROFILE%\.rustup

echo [1/2] 构建前端...
cd /d "%~dp0"
call npm run build
if errorlevel 1 (
    echo 前端构建失败!
    pause
    exit /b 1
)

echo.
echo [2/2] 构建 Tauri 应用...
cargo tauri build
if errorlevel 1 (
    echo Tauri 构建失败!
    pause
    exit /b 1
)

echo.
echo ========================================
echo   构建完成!
echo ========================================
echo.
echo 安装包位置:
dir /b "src-tauri\target\release\bundle\msi\*.msi" 2>nul
dir /b "src-tauri\target\release\bundle\nsis\*.exe" 2>nul
echo.
pause
