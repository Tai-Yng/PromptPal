$env:Path = "$env:USERPROFILE\.cargo\bin;" + $env:Path
Set-Location "C:\Users\lyer\AppData\Roaming\TRAE SOLO CN\ModularData\ai-agent\work-mode-projects\6a09d2c1a2819317bb379a64\PromptPal"
cargo tauri build
