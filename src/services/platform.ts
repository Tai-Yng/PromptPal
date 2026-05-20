// 平台适配层 - 统一浏览器和 Tauri 环境的 API 差异

// 检测是否在 Tauri 环境中运行
export const isTauri = () => {
  return !!(window as any).__TAURI_INTERNALS__
}

// ===== 剪贴板 =====
export async function copyToClipboard(text: string): Promise<boolean> {
  // 方案1: navigator.clipboard (需要HTTPS或localhost)
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {}

  // 方案2: execCommand 降级
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {}

  return false
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
