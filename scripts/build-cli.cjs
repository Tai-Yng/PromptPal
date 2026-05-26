// Copy pal.exe to Tauri release directory (CLI is built separately by `cargo build`)
const { existsSync, copyFileSync, mkdirSync } = require('fs')
const { join, dirname } = require('path')

const src = join(__dirname, '..', 'cli-rs', 'target', 'release', 'pal.exe')
const dest = join(__dirname, '..', 'src-tauri', 'target', 'release', 'pal.exe')

if (existsSync(src)) {
  mkdirSync(dirname(dest), { recursive: true })
  copyFileSync(src, dest)
  console.log('pal.exe copied to bundle')
} else {
  console.warn('pal.exe not found — build CLI first: cd cli-rs && cargo build --release')
}
