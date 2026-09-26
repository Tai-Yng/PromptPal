// 精灵帧拼条：把 Shimeji 式的散帧 PNG 序列横向拼成单条 sprite sheet
// - 自然排序（shime2 排在 shime10 前）
// - 帧尺寸取最大宽高；每帧水平居中、底部对齐（贴合地面行走的渲染假设）
// - 运行时依赖 canvas（浏览器/Tauri webview），纯数据转换无 IO
export interface StitchInput { name: string; dataUrl: string }
export interface StitchResult {
  dataUrl: string
  frameWidth: number
  frameHeight: number
  frames: number
}

const naturalCompare = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = () => rej(new Error(`image decode failed: ${dataUrl.slice(0, 40)}...`))
    img.src = dataUrl
  })
}

export async function stitchFrames(inputs: StitchInput[]): Promise<StitchResult> {
  const sorted = [...inputs].sort((a, b) => naturalCompare(a.name, b.name))
  if (sorted.length === 0) throw new Error('no frames selected')
  const images = await Promise.all(sorted.map(i => loadImage(i.dataUrl)))

  const frameWidth = Math.max(...images.map(img => img.width))
  const frameHeight = Math.max(...images.map(img => img.height))
  const canvas = document.createElement('canvas')
  canvas.width = frameWidth * images.length
  canvas.height = frameHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d unavailable')

  images.forEach((img, i) => {
    const x = i * frameWidth + Math.floor((frameWidth - img.width) / 2)
    const y = frameHeight - img.height
    ctx.drawImage(img, x, y)
  })

  return {
    dataUrl: canvas.toDataURL('image/png'),
    frameWidth,
    frameHeight,
    frames: images.length
  }
}
