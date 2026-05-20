using namespace System.Diagnostics
$psi = [ProcessStartInfo]::new()
$psi.FileName = "C:\Users\lyer\.cargo\bin\cargo-tauri.exe"
$psi.Arguments = "build --verbose"
$psi.WorkingDirectory = "C:\Users\lyer\AppData\Roaming\TRAE SOLO CN\ModularData\ai-agent\work-mode-projects\6a09d2c1a2819317bb379a64\PromptPal"
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true

# 设置完整环境变量
$psi.Environment["PATH"] = "C:\Users\lyer\.cargo\bin;" + $env:Path
$psi.Environment["USERPROFILE"] = $env:USERPROFILE
$psi.Environment["HOME"] = $env:USERPROFILE
$psi.Environment["CARGO_HOME"] = "$env:USERPROFILE\.cargo"
$psi.Environment["RUSTUP_HOME"] = "$env:USERPROFILE\.rustup"

$proc = [Process]::Start($psi)
$stdout = $proc.StandardOutput.ReadToEnd()
$stderr = $proc.StandardError.ReadToEnd()
$proc.WaitForExit()

Write-Host $stdout
if ($stderr) { Write-Host $stderr }
Write-Host "Exit code: $($proc.ExitCode)"
