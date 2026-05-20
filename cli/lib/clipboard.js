// 剪贴板模块
import clipboardy from 'clipboardy';

// 复制到剪贴板
export async function copyToClipboard(text) {
  try {
    await clipboardy.write(text);
    return true;
  } catch (e) {
    console.error('Failed to copy to clipboard:', e.message);
    return false;
  }
}

// 从剪贴板读取
export async function readFromClipboard() {
  try {
    return await clipboardy.read();
  } catch (e) {
    return null;
  }
}
