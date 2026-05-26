use tauri::Manager;
use tauri::PhysicalPosition;
use tauri::WebviewWindowBuilder;
use std::sync::atomic::{AtomicU64, Ordering};
use tauri_plugin_global_shortcut::GlobalShortcutExt;
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::menu::{Menu, MenuItem};

/// 退出应用
#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    app.exit(0);
}

/// 获取当前活跃窗口标题（Windows only）
#[tauri::command]
fn get_active_window_title() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowTextW};
        let hwnd = unsafe { GetForegroundWindow() };
        if hwnd.is_invalid() {
            return Ok(String::new());
        }
        let mut buffer = [0u16; 512];
        let len = unsafe { GetWindowTextW(hwnd, &mut buffer) };
        if len > 0 {
            Ok(String::from_utf16_lossy(&buffer[..len as usize]))
        } else {
            Ok(String::new())
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(String::new())
    }
}

/// 同步数据：保存 JSON 到本地文件
#[tauri::command]
fn sync_save(data: String) -> Result<String, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let dir = home.join(".promptpal");
    std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create dir: {}", e))?;
    let path = dir.join("promptpal_data.json");
    std::fs::write(&path, &data).map_err(|e| format!("Failed to write: {}", e))?;
    Ok(path.to_string_lossy().to_string())
}

/// 同步数据：从本地文件加载 JSON
#[tauri::command]
fn sync_load() -> Result<String, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let path = home.join(".promptpal").join("promptpal_data.json");
    if path.exists() {
        std::fs::read_to_string(&path).map_err(|e| format!("Failed to read: {}", e))
    } else {
        Ok(String::new())
    }
}

/// Gitee API: 检查连接
#[tauri::command]
fn gitee_verify(token: String, owner: String, repo: String) -> Result<String, String> {
    let url = format!("https://gitee.com/api/v5/repos/{}/{}", owner, repo);
    let resp = ureq::get(&url)
        .set("Authorization", &format!("token {}", token))
        .call()
        .map_err(|e| format!("http error: {}", e))?;
    let status = resp.status();
    if status == 200 {
        let body = resp.into_string().unwrap_or_default();
        let full_name = serde_json::from_str::<serde_json::Value>(&body)
            .ok()
            .and_then(|v| v["full_name"].as_str().map(|s| s.to_string()))
            .unwrap_or_else(|| format!("{}/{}", owner, repo));
        Ok(format!("[OK] connected to {}", full_name))
    } else if status == 404 {
        Err("repo not found — check owner/repo spelling".into())
    } else if status == 401 {
        Err("bad token".into())
    } else {
        Err(format!("http status {}", status))
    }
}

/// Gitee API: 推送到仓库
#[tauri::command]
fn gitee_push(token: String, owner: String, repo: String, path: String, content: String) -> Result<String, String> {
    let base = format!("https://gitee.com/api/v5/repos/{}/{}/contents/{}", owner, repo, path);
    let body = serde_json::json!({
        "content": content,
        "message": "sync from PromptPal",
    });

    // 先查文件是否存在（获取 sha）
    let mut sha = String::new();
    let check_url = &base;
    if let Ok(resp) = ureq::get(check_url)
        .set("Authorization", &format!("token {}", token))
        .call() {
        if resp.status() == 200 {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&resp.into_string().unwrap_or_default()) {
                sha = json["sha"].as_str().unwrap_or("").to_string();
            }
        }
    }

    let agent = ureq::Agent::new();
    let req = if sha.is_empty() {
        agent.post(&base)
    } else {
        agent.put(&base)
    };

    let mut body_val = body.clone();
    if !sha.is_empty() {
        body_val["sha"] = serde_json::Value::String(sha);
    }

    let resp = req
        .set("Content-Type", "application/json")
        .set("Authorization", &format!("token {}", token))
        .send_string(&serde_json::to_string(&body_val).unwrap_or_default())
        .map_err(|e| format!("http error: {}", e))?;

    if resp.status() == 200 || resp.status() == 201 {
        Ok(format!("[OK] pushed to {}/{}/{}", owner, repo, path))
    } else {
        let status = resp.status();
        let err = resp.into_string().unwrap_or_default();
        Err(format!("{}: {}", status, err))
    }
}

/// Gitee API: 从仓库拉取
#[tauri::command]
fn gitee_pull(token: String, owner: String, repo: String, path: String) -> Result<String, String> {
    let url = format!("https://gitee.com/api/v5/repos/{}/{}/contents/{}", owner, repo, path);
    let resp = ureq::get(&url)
        .set("Authorization", &format!("token {}", token))
        .call()
        .map_err(|e| format!("http error: {}", e))?;
    let status = resp.status();
    if status == 200 {
        let json_str = resp.into_string().unwrap_or_default();
        Ok(json_str)
    } else if status == 404 {
        Err("file not found in repo — push first".into())
    } else {
        Err(format!("http status {}", status))
    }
}

/// 显示面板窗口
#[tauri::command]
fn show_panel(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("panel") {
        let _ = window.show();
        let _ = window.set_focus();
        Ok(())
    } else {
        Err("Panel window not found".into())
    }
}

/// 隐藏面板窗口
#[tauri::command]
fn hide_panel(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("panel") {
        let _ = window.hide();
        Ok(())
    } else {
        Err("Panel window not found".into())
    }
}

/// 创建或显示快速注入窗口
fn create_quick_inject(app: &tauri::AppHandle) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window("quick-inject") {
        let _ = existing.close();
    }

    let _webview = WebviewWindowBuilder::new(
        app,
        "quick-inject",
        tauri::WebviewUrl::App("index.html".into()),
    )
    .title("PromptPal")
    .inner_size(380.0, 440.0)
    .resizable(false)
    .decorations(true)
    .center()
    .always_on_top(true)
    .skip_taskbar(true)
    .build()
    .map_err(|e| format!("Failed to create quick-inject window: {}", e))?;

    Ok(())
}

/// 快捷注入复制后关闭窗口
#[tauri::command]
fn quick_inject_done(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("quick-inject") {
        let _ = window.close();
    }
    Ok(())
}

/// 显示浮动右键菜单窗口
static CTX_MENU_COUNTER: AtomicU64 = AtomicU64::new(0);

#[tauri::command]
fn show_context_menu(app: tauri::AppHandle, x: i32, y: i32) -> Result<(), String> {
    let counter = CTX_MENU_COUNTER.fetch_add(1, Ordering::SeqCst);
    let label = format!("context-menu-{}-{}", counter, std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis());

    let _webview = WebviewWindowBuilder::new(
        &app,
        &label,
        tauri::WebviewUrl::App("index.html".into()),
    )
    .title("")
    .position((x - 10) as f64, (y - 10) as f64)
    .inner_size(220.0, 190.0)
    .resizable(false)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .build()
    .map_err(|e| format!("Failed to create context menu window: {}", e))?;

    Ok(())
}

/// 首次启动时将安装目录加入用户 PATH（使 pal 命令全局可用）
#[cfg(target_os = "windows")]
fn register_pal_path() {
    use std::process::Command;
    // 获取当前 exe 所在目录
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(dir) = exe_path.parent() {
            let dir_str = dir.to_string_lossy().to_string();
            // 用 PowerShell 操作注册表，安全可靠
            let script = format!(
                r#"
$dir = '{}'
$regPath = 'HKCU:\Environment'
$current = [Environment]::GetEnvironmentVariable('Path', 'User') ?? ''
$entries = $current -split ';' | Where-Object {{ $_ -ne '' }}
if ($entries -notcontains $dir) {{
    $new = $current + ';' + $dir
    [Environment]::SetEnvironmentVariable('Path', $new, 'User')
}}
"#,
                dir_str.replace('\'', "''")
            );
            let _ = Command::new("powershell")
                .args(["-NoProfile", "-Command", &script])
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .status();
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
    .plugin(tauri_plugin_clipboard_manager::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())
    .invoke_handler(tauri::generate_handler![
        show_panel,
        hide_panel,
        get_active_window_title,
        quick_inject_done,
        show_context_menu,
        sync_save,
        sync_load,
        gitee_verify,
        gitee_push,
        gitee_pull,
        exit_app
    ])
    .setup(|app| {
        // 日志
        app.handle().plugin(
            tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;

        // 注册全局热键 Alt+Space → 打开快速注入窗口
        let handle = app.handle().clone();
        app.handle().global_shortcut().on_shortcut("Ctrl+Alt+P", move |_app, _shortcut, event| {
            if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                let _ = create_quick_inject(&handle);
            }
        })?;

        // Pet 窗口定位到右下角
        if let Some(pet_win) = app.get_webview_window("pet") {
            if let Ok(monitor) = pet_win.current_monitor() {
                if let Some(monitor) = monitor {
                    let size = monitor.size();
                    let ww = 340i32;
                    let wh = 380i32;
                    let margin = 20i32;
                    let x = size.width as i32 - ww - margin;
                    let y = size.height as i32 - wh - margin;
                    let _ = pet_win.set_position(PhysicalPosition::new(x, y));
                }
            }
        }

        // 首次启动：注册安装目录到 PATH（使 pal 命令全局可用）
        #[cfg(target_os = "windows")]
        register_pal_path();

        // 面板窗口关闭时隐藏而不是退出
        if let Some(panel_win) = app.get_webview_window("panel") {
            let panel_win_clone = panel_win.clone();
            panel_win.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = panel_win_clone.hide();
                }
            });
        }

        // 系统托盘
        let show_item = MenuItem::with_id(app, "show", "Show Panel", true, None::<&str>)?;
        let exit_item = MenuItem::with_id(app, "exit", "Exit PromptPal", true, None::<&str>)?;
        let menu = Menu::with_items(app, &[&show_item, &exit_item])?;

        let _tray = TrayIconBuilder::new()
            .icon(app.default_window_icon().unwrap().clone())
            .tooltip("PromptPal")
            .menu(&menu)
            .on_menu_event(|app, event| {
                match event.id.as_ref() {
                    "show" => {
                        if let Some(panel) = app.get_webview_window("panel") {
                            let _ = panel.show();
                            let _ = panel.set_focus();
                        }
                    }
                    "exit" => {
                        app.exit(0);
                    }
                    _ => {}
                }
            })
            .on_tray_icon_event(|tray, event| {
                if let TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } = event
                {
                    let app = tray.app_handle();
                    if let Some(panel) = app.get_webview_window("panel") {
                        let _ = panel.show();
                        let _ = panel.set_focus();
                    }
                }
            })
            .build(app)?;

        Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
