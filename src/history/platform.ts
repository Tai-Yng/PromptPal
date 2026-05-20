// 平台适配层 - 统一浏览器和 Tauri 环境的 API 差异

// 检测是否在 Tauri 环境中运行
export const isTauri = () => {
  return !!(window as any).__TAURI_INTERNALS__
}

// ===== 剪贴板 =====
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (isTauri()) {
      const { writeText } = await import('@tauri-apps/plugin-clipboard-manager')
      await writeText(text)
      return true
    } else {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch (e) {
    console.error('Failed to copy to clipboard:', e)
    return false
  }
}

export async function readFromClipboard(): Promise<string> {
  try {
    if (isTauri()) {
      const { readText } = await import('@tauri-apps/plugin-clipboard-manager')
      return await readText()
    } else {
      return await navigator.clipboard.readText()
    }
  } catch (e) {
    console.error('Failed to read clipboard:', e)
    return ''
  }
}

// ===== 窗口控制 =====
export async function minimizeWindow(): Promise<void> {
  if (isTauri()) {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().minimize()
  }
}

export async function closeWindow(): Promise<void> {
  if (isTauri()) {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().close()
  }
}

export async function hideWindow(): Promise<void> {
  if (isTauri()) {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().hide()
  }
}

export async function showWindow(): Promise<void> {
  if (isTauri()) {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().show()
  }
}

export async function setAlwaysOnTop(always: boolean): Promise<void> {
  if (isTauri()) {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().setAlwaysOnTop(always)
  }
}

export async function startWindowDrag(): Promise<void> {
  if (isTauri()) {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().startDragging()
  }
}

// ===== 系统托盘 =====
export async function setTrayTooltip(_text: string): Promise<void> {
  // Tauri 端通过 Rust 代码处理
}

// ===== 外部链接 =====
export async function openExternal(url: string): Promise<void> {
  if (isTauri()) {
    const { open } = await import('@tauri-apps/plugin-shell')
    await open(url)
  } else {
    window.open(url, '_blank')
  }
}
