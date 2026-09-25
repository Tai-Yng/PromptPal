#!/usr/bin/env node
// 轻量纯函数测试 — 不引入测试框架
// 用法：node scripts/test-pure.mjs
// 原理：用 esbuild（已是项目依赖）把 TS 模块打包为 ESM，配内存 localStorage 后断言。
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const tmp = mkdtempSync(join(tmpdir(), 'promptpal-test-'))
let failures = 0
const test = (name, fn) => {
  try {
    fn()
    console.log(`  [OK] ${name}`)
  } catch (e) {
    failures++
    console.error(`  [FAIL] ${name}\n         ${e?.message || e}`)
  }
}

// 内存 localStorage 模拟
class MemStore {
  constructor() { this.map = new Map() }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null }
  setItem(k, v) { this.map.set(k, String(v)) }
  removeItem(k) { this.map.delete(k) }
  clear() { this.map.clear() }
}

// ===== 打包 TS 模块 =====
const bundle = (entry, out) => {
  execSync(
    `npx --no-install esbuild ${entry} --bundle --format=esm --outfile=${join(tmp, out)}`,
    { stdio: 'pipe' }
  )
  return pathToFileURL(join(tmp, out)).href
}

let storageUrl = null
try {
  storageUrl = bundle('src/services/storage.ts', 'storage.mjs')
} catch (e) {
  console.error('[FAIL] esbuild bundle storage.ts:', e?.message || e)
  process.exit(1)
}

// ===== storage.ts =====
console.log('storage.ts:')
{
  globalThis.localStorage = new MemStore()
  const storage = await import(storageUrl)

  test('saveJson/loadJson 往返', () => {
    storage.saveJson('k1', { a: 1, b: ['x'] })
    assert.deepEqual(storage.loadJson('k1', null), { a: 1, b: ['x'] })
  })

  test('loadJson 键不存在返回 fallback', () => {
    assert.equal(storage.loadJson('missing', 'fb'), 'fb')
  })

  test('loadJson 损坏 JSON 返回 fallback 而不抛出', () => {
    globalThis.localStorage.setItem('bad', '{not json')
    assert.equal(storage.loadJson('bad', 'fb'), 'fb')
  })

  test('loadJson validate 不过返回 fallback', () => {
    globalThis.localStorage.setItem('v', '{"n":"not-a-number"}')
    const got = storage.loadJson('v', 0, raw => typeof raw === 'object' && raw && typeof raw.n === 'number' ? raw.n : null)
    assert.equal(got, 0)
  })

  test('loadJson validate 通过返回规整值', () => {
    globalThis.localStorage.setItem('v2', '{"n":42}')
    const got = storage.loadJson('v2', 0, raw => typeof raw === 'object' && raw && typeof raw.n === 'number' ? raw.n : null)
    assert.equal(got, 42)
  })

  test('loadString/saveString 与版本键', () => {
    storage.saveString('s1', 'plain-text')
    assert.equal(storage.loadString('s1'), 'plain-text')
    assert.equal(storage.loadString('nope'), null)
  })

  test('ensureSchemaVersion 写入当前版本且幂等', () => {
    storage.ensureSchemaVersion()
    assert.equal(storage.loadString('promptpal_schema_version'), '1')
    storage.ensureSchemaVersion()
    assert.equal(storage.loadString('promptpal_schema_version'), '1')
  })

  test('损坏的版本号被纠正', () => {
    storage.saveString('promptpal_schema_version', 'garbage')
    storage.ensureSchemaVersion()
    assert.equal(storage.loadString('promptpal_schema_version'), '1')
  })
}

// ===== 收尾 =====
rmSync(tmp, { recursive: true, force: true })
if (failures > 0) {
  console.error(`\n${failures} 个断言失败`)
  process.exit(1)
}
console.log('\nALL PASS')
