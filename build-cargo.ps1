using namespace System.Diagnostics
using namespace System.Text

$psi = [ProcessStartInfo]::new()
$psi.FileName = "C:\Users\lyer\.cargo\bin\cargo.exe"
$psi.Arguments = "build --release"
$psi.WorkingDirectory = "C:\Users\lyer\AppData\Roaming\TRAE SOLO CN\ModularData\ai-agent\work-mode-projects\6a09d2c1a2819317bb379a64\PromptPal\src-tauri"
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.StandardOutputEncoding = [Encoding]::UTF8
$psi.StandardErrorEncoding = [Encoding]::UTF8

$psi.Environment["PATH"] = "C:\Users\lyer\.cargo\bin;C:\Windows\system32;C:\Windows;C:\Windows\System32\Wbem;C:\Windows\System32\WindowsPowerShell\v1.0"
$psi.Environment["USERPROFILE"] = $env:USERPROFILE
$psi.Environment["HOME"] = $env:USERPROFILE
$psi.Environment["CARGO_HOME"] = "$env:USERPROFILE\.cargo"
$psi.Environment["RUSTUP_HOME"] = "$env:USERPROFILE\.rustup"

Write-Host "Starting cargo build..."
$proc = [Process]::Start($psi)

# 逐行读取输出
$output = [StringBuilder]::new()
while (!$proc.StandardOutput.EndOfStream) {
    $line = $proc.StandardOutput.ReadLine()
    $output.AppendLine($line) | Out-Null
    if ($line -match "error") { Write-Host $line }
}
while (!$proc.StandardError.EndOfStream) {
    $line = $proc.StandardError.ReadLine()
    $output.AppendLine($line) | Out-Null
    if ($line -match "error") { Write-Host "ERR: $line" }
}
$proc.WaitForExit()

# 保存完整输出
$output.ToString() | Out-File "$env:TEMP\cargo-build-full.log" -Encoding UTF8
Write-Host "Exit code: $($proc.ExitCode)"
Write-Host "Full log: $env:TEMP\cargo-build-full.log"
