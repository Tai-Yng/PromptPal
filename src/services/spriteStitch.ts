// 精灵帧拼条：把 Shimeji 式的散帧 PNG 序列横向拼成单条 sprite sheet
// - 自然排序（shime2 排在 shime10 前）
// - 帧尺寸取最大宽高；每帧水平居中、底部对齐（贴合地面行走的渲染假设）
// - ZIP 整包入口：fflate 解包 → img 帧图拼条 → conf 动作 XML 语义映射
import { unzipSync, strFromU8 } from 'fflate'
import { parseShimejiConf, isActionConf } from './shimejiXml'
export interface StitchInput { name: string; dataUrl: string }
export interface StitchResult {
  dataUrl: string
  frameWidth: number
  frameHeight: number
  frames: number
  // ZIP+conf 自动映射出的三状态帧序列（有 conf 时返回）
  autoMapping?: { walk?: number[]; idle?: number[]; sleep?: number[] }
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

const SHIME_NAME = /(?:^|\/)shime(\d+)\.png$/i

// ZIP 整包导入：解包 → img 帧图拼条 + conf 动作 XML 语义映射
// - 帧图：优先 /img/ 下 shime<数字>.png；无命中回落全部 PNG（排除 icon）
// - 映射：遍历文本条目找动作定义 XML（按内容识别，不依赖文件名——旧包文件名常为乱码）
export async function stitchFromZip(zipData: ArrayBuffer): Promise<StitchResult> {
  const entries = unzipSync(new Uint8Array(zipData))
  const paths = Object.keys(entries)

  // conf 动作 XML → 三状态映射
  let autoMapping: StitchResult['autoMapping'] | undefined
  for (const p of paths) {
    if (!/\.xml$/i.test(p) || p.endsWith('Mascot.xsd')) continue
    try {
      const text = strFromU8(entries[p])
      if (!isActionConf(text)) continue
      const m = parseShimejiConf(text)
      if (m.walk || m.idle || m.sleep) {
        autoMapping = m
        break
      }
    } catch { /* 编码异常的条目跳过 */ }
  }

  // 帧图筛选：img 目录优先，shime 命名优先
  const pngs = paths.filter(p => /\.png$/i.test(p))
  let framePaths = pngs.filter(p => /img\//i.test(p) && SHIME_NAME.test(p))
  if (framePaths.length === 0) {
    framePaths = pngs.filter(p => SHIME_NAME.test(p))
  }
  if (framePaths.length === 0) {
    // 极少数包不用 shime 命名：回落全部 PNG（排除 icon），按文件序拼条
    framePaths = pngs.filter(p => !/icon/i.test(p))
  }
  if (framePaths.length === 0) throw new Error('no PNG frames found in zip')

  const inputs: StitchInput[] = framePaths.map(p => ({
    name: p.split('/').pop() || p,
    dataUrl: toDataUrl(entries[p])
  }))
  const result = await stitchFrames(inputs)
  if (autoMapping) result.autoMapping = autoMapping
  return result
}

function toDataUrl(bytes: Uint8Array): string {
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return 'data:image/png;base64,' + btoa(bin)
}
