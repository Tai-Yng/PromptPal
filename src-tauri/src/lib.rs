use tauri::Manager;
use tauri::PhysicalPosition;
use tauri::WebviewWindowBuilder;
use std::sync::atomic::{AtomicU64, Ordering};

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
    .plugin(tauri_plugin_clipboard_manager::init())
    .plugin(tauri_plugin_shell::init())
    .invoke_handler(tauri::generate_handler![show_panel, hide_panel, show_context_menu])
    .setup(|app| {
        // 日志
        app.handle().plugin(
            tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;

        // Pet 窗口定位到右下角
        if let Some(pet_win) = app.get_webview_window("pet") {
            if let Ok(monitor) = pet_win.current_monitor() {
                if let Some(monitor) = monitor {
                    let size = monitor.size();
                    let ww = 120i32;
                    let wh = 200i32;
                    let margin = 20i32;
                    let x = size.width as i32 - ww - margin;
                    let y = size.height as i32 - wh - margin;
                    let _ = pet_win.set_position(PhysicalPosition::new(x, y));
                }
            }
        }

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
        let _tray = tauri::tray::TrayIconBuilder::new()
            .icon(app.default_window_icon().unwrap().clone())
            .tooltip("PromptPal")
            .on_tray_icon_event(|tray, event| {
                if let tauri::tray::TrayIconEvent::Click {
                    button: tauri::tray::MouseButton::Left,
                    button_state: tauri::tray::MouseButtonState::Up,
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
