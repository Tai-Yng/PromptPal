using namespace System.Diagnostics
using namespace System.Text

$psi = [ProcessStartInfo]::new()
$psi.FileName = "C:\Users\lyer\.cargo\bin\cargo-tauri.exe"
$psi.Arguments = "build"
$psi.WorkingDirectory = "C:\Users\lyer\AppData\Roaming\TRAE SOLO CN\ModularData\ai-agent\work-mode-projects\6a09d2c1a2819317bb379a64\PromptPal"
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.StandardOutputEncoding = [Encoding]::UTF8
$psi.StandardErrorEncoding = [Encoding]::UTF8

# 清除并重建 PATH
$psi.Environment["PATH"] = "C:\Users\lyer\.cargo\bin;C:\Windows\system32;C:\Windows;C:\Windows\System32\Wbem;C:\Windows\System32\WindowsPowerShell\v1.0"
$psi.Environment["USERPROFILE"] = $env:USERPROFILE
$psi.Environment["HOME"] = $env:USERPROFILE
$psi.Environment["CARGO_HOME"] = "$env:USERPROFILE\.cargo"
$psi.Environment["RUSTUP_HOME"] = "$env:USERPROFILE\.rustup"

Write-Host "Starting tauri build..."
$proc = [Process]::Start($psi)

# 异步读取输出
$stdoutTask = $proc.StandardOutput.ReadToEndAsync()
$stderrTask = $proc.StandardError.ReadToEndAsync()
$proc.WaitForExit()

$stdout = $stdoutTask.Result
$stderr = $stderrTask.Result

if ($stdout) { Write-Host $stdout }
if ($stderr) { Write-Host "STDERR: $stderr" }
Write-Host "Exit code: $($proc.ExitCode)"
