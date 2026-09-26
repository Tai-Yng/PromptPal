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
const test = async (name, fn) => {
  try {
    await fn()
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
let variablesUrl = null
let xmlUrl = null
let agentUrl = null
try {
  storageUrl = bundle('src/services/storage.ts', 'storage.mjs')
  variablesUrl = bundle('src/services/variables.ts', 'variables.mjs')
  xmlUrl = bundle('src/services/shimejiXml.ts', 'shimejiXml.mjs')
  agentUrl = bundle('src/services/agentState.ts', 'agentState.mjs')
} catch (e) {
  console.error('[FAIL] esbuild bundle:', e?.message || e)
  process.exit(1)
}

// ===== storage.ts =====
console.log('storage.ts:')
{
  globalThis.localStorage = new MemStore()
  const storage = await import(storageUrl)

  await test('saveJson/loadJson 往返', () => {
    storage.saveJson('k1', { a: 1, b: ['x'] })
    assert.deepEqual(storage.loadJson('k1', null), { a: 1, b: ['x'] })
  })

  await test('loadJson 键不存在返回 fallback', () => {
    assert.equal(storage.loadJson('missing', 'fb'), 'fb')
  })

  await test('loadJson 损坏 JSON 返回 fallback 而不抛出', () => {
    globalThis.localStorage.setItem('bad', '{not json')
    assert.equal(storage.loadJson('bad', 'fb'), 'fb')
  })

  await test('loadJson validate 不过返回 fallback', () => {
    globalThis.localStorage.setItem('v', '{"n":"not-a-number"}')
    const got = storage.loadJson('v', 0, raw => typeof raw === 'object' && raw && typeof raw.n === 'number' ? raw.n : null)
    assert.equal(got, 0)
  })

  await test('loadJson validate 通过返回规整值', () => {
    globalThis.localStorage.setItem('v2', '{"n":42}')
    const got = storage.loadJson('v2', 0, raw => typeof raw === 'object' && raw && typeof raw.n === 'number' ? raw.n : null)
    assert.equal(got, 42)
  })

  await test('loadString/saveString 与版本键', () => {
    storage.saveString('s1', 'plain-text')
    assert.equal(storage.loadString('s1'), 'plain-text')
    assert.equal(storage.loadString('nope'), null)
  })

  await test('ensureSchemaVersion 写入当前版本且幂等', () => {
    storage.ensureSchemaVersion()
    assert.equal(storage.loadString('promptpal_schema_version'), '3')
    storage.ensureSchemaVersion()
    assert.equal(storage.loadString('promptpal_schema_version'), '3')
  })

  await test('损坏的版本号被纠正', () => {
    storage.saveString('promptpal_schema_version', 'garbage')
    storage.ensureSchemaVersion()
    assert.equal(storage.loadString('promptpal_schema_version'), '3')
  })

  await test('v1 数据经迁移链升到当前版本且内容无损', () => {
    globalThis.localStorage = new MemStore()
    const oldStyle = JSON.stringify({ style: { primaryColor: '#00D4AA' }, themeId: 'cyan', useCustomSprite: false })
    globalThis.localStorage.setItem('promptpal_pet_style', oldStyle)
    storage.saveString('promptpal_schema_version', '1')
    storage.ensureSchemaVersion()
    assert.equal(storage.loadString('promptpal_schema_version'), '3')
    assert.equal(globalThis.localStorage.getItem('promptpal_pet_style'), oldStyle)
  })

  await test('全新环境直接升到当前版本', () => {
    globalThis.localStorage = new MemStore()
    storage.ensureSchemaVersion()
    assert.equal(storage.loadString('promptpal_schema_version'), '3')
  })
}

// ===== variables.ts =====
console.log('variables.ts:')
{
  globalThis.localStorage = new MemStore()
  const vars = await import(variablesUrl)

  await test('双语法识别且 -- 参数排除', () => {
    const list = vars.parseVariables('画一张 [风格] 的 {{主体}}，--ar 16:9')
    assert.deepEqual(list.map(v => v.name), ['风格', '主体'])
    assert.equal(list[0].syntax, 'bracket')
    assert.equal(list[1].syntax, 'brace')
  })

  await test('同名去重且保持首现顺序', () => {
    const list = vars.parseVariables('{{b}} [a] {{b}} [c] [a]')
    assert.deepEqual(list.map(v => v.name), ['b', 'a', 'c'])
  })

  await test('-- 开头占位符不识别', () => {
    const list = vars.parseVariables('[--ar] [风格]')
    assert.deepEqual(list.map(v => v.name), ['风格'])
  })

  await test('超长(>40)与嵌套括号不识别', () => {
    const long = 'x'.repeat(41)
    assert.deepEqual(vars.parseVariables(`[${long}] {{${long}}}`), [])
    assert.deepEqual(vars.parseVariables('[[嵌套]]'), [])
  })

  await test('substitute 替换已填、留空保留占位符', () => {
    const out = vars.substitute('画一张 [风格] 的 {{主体}}，--ar 16:9', { 主体: '一只猫' })
    assert.equal(out, '画一张 [风格] 的 一只猫，--ar 16:9')
  })

  await test('substitute 空白值视为留空', () => {
    const out = vars.substitute('{{a}}', { a: '   ' })
    assert.equal(out, '{{a}}')
  })

  await test('记忆读写与预填', () => {
    vars.rememberVar('p1', '风格', '油画')
    assert.equal(vars.recallVar('p1', '风格'), '油画')
    assert.equal(vars.recallVar('p1', '不存在'), '')
  })

  await test('跨模块实例记忆持久化（重新求值可读回）', async () => {
    const vars2 = await import(variablesUrl + '?reimport')
    assert.equal(vars2.recallVar('p1', '风格'), '油画')
  })

  await test('记忆 LRU 超限淘汰最旧条目', async () => {
    // 上限 1000：灌满后直接改写时间戳制造确定性顺序
    for (let i = 0; i < 1000; i++) vars.rememberVar('p', `v${i}`, `val${i}`)
    const mem = JSON.parse(globalThis.localStorage.getItem('promptpal_var_memory'))
    const now = Date.now()
    mem['p::v0'].t = now + 5000   // v0 变为最新（模拟刚被触碰）
    mem['p::v1'].t = now - 5000   // v1 变为最旧
    globalThis.localStorage.setItem('promptpal_var_memory', JSON.stringify(mem))
    vars.rememberVar('p', 'v-new', 'x')  // 第 1001 条触发淘汰
    const after = JSON.parse(globalThis.localStorage.getItem('promptpal_var_memory'))
    const keys = Object.keys(after)
    assert.equal(keys.length, 1000)
    assert.ok(!keys.includes('p::v1'), '最旧的 v1 应被淘汰')
    assert.ok(keys.includes('p::v0'), '被标记为最新的 v0 应保留')
    assert.ok(keys.includes('p::v-new'), '最新条目应保留')
  })
}

// ===== shimejiXml.ts =====
console.log('shimejiXml.ts:')
{
  const xml = await import(xmlUrl)

  // 真实皮卡丘包（Group-Finity 日文）样例片段
  const jpXml = `<マスコット>
  <動作 名前="振り向く" 種類="組み込み" クラス="Look" />
  <動作 名前="立つ" 種類="静止"><アニメーション><ポーズ 画像="/shime1.png" 長さ="250" /></アニメーション></動作>
  <動作 名前="歩く" 種類="移動"><アニメーション><ポーズ 画像="/shime1.png" /><ポーズ 画像="/shime2.png" /><ポーズ 画像="/shime1.png" /><ポーズ 画像="/shime3.png" /></アニメーション></動作>
  <動作 名前="寝そべる" 種類="静止"><アニメーション><ポーズ 画像="/shime21.png" /></アニメーション></動作>
  <動作 名前="座って見上げる" 種類="静止"><アニメーション><ポーズ 画像="/shime26.png" /></アニメーション></動作>
  </マスコット>`
  // Shimeji-ee 英文样例
  const enXml = `<Action name="Walk" type="Move"><Animation><Pose Image="shime2.png" /><Pose Image="shime3.png" /></Animation></Action>
  <Action name="Stand" type="Static"><Animation><Pose Image="shime1.png" /></Animation></Action>`

  test('日文格式提取动作帧并去重保序', () => {
    const acts = xml.extractActionFrames(jpXml)
    const walk = acts.find(a => a.name === '歩く')
    assert.deepEqual(walk.frames, [1, 2, 3], '歩く = [1,2,1,3] 去重后 [1,2,3]')
  })

  test('日文语义映射：立つ→idle、歩く→walk、寝そべる→sleep', () => {
    const m = xml.parseShimejiConf(jpXml)
    assert.deepEqual(m.walk, [1, 2, 3])
    assert.deepEqual(m.idle, [1])
    assert.deepEqual(m.sleep, [21])
  })

  test('英文格式识别', () => {
    const m = xml.parseShimejiConf(enXml)
    assert.deepEqual(m.walk, [2, 3])
    assert.deepEqual(m.idle, [1])
  })

  test('内置动作（无帧）不产生映射', () => {
    const m = xml.parseShimejiConf(jpXml)
    // 振り向く 是自闭合内置动作，不应出现
    assert.ok(!xml.extractActionFrames(jpXml).some(a => a.name === '振り向く'))
  })

  test('isActionConf 识别动作文件且排除 XSD', () => {
    assert.equal(xml.isActionConf(jpXml), true)
    assert.equal(xml.isActionConf('<xs:schema xmlns:xs="..."/>'), false)
  })

  test('无命中动作返回空映射', () => {
    assert.deepEqual(xml.parseShimejiConf('<動作 名前="謎の動作"><アニメーション><ポーズ 画像="/shime1.png" /></アニメーション></動作>'), {})
  })
}

// ===== agentState.ts（协议解析纯函数） =====
console.log('agentState.ts:')
{
  const ag = await import(agentUrl)
  const NOW = 1_000_000_000

  test('working/done 正常解析', () => {
    assert.equal(ag.parseAgentBadge(JSON.stringify({ agent: 'zcode', state: 'working', ts: NOW - 500 }), NOW, 90_000), 'working')
    assert.equal(ag.parseAgentBadge(JSON.stringify({ agent: 'claude', state: 'done', ts: NOW - 1000 }), NOW, 90_000), 'done')
  })

  test('超时回落 null', () => {
    assert.equal(ag.parseAgentBadge(JSON.stringify({ agent: 'zcode', state: 'working', ts: NOW - 90_001 }), NOW, 90_000), null)
  })

  test('idle 视为无状态', () => {
    assert.equal(ag.parseAgentBadge(JSON.stringify({ agent: 'zcode', state: 'idle', ts: NOW }), NOW, 90_000), null)
  })

  test('损坏文本/缺字段容忍', () => {
    assert.equal(ag.parseAgentBadge('{broken', NOW, 90_000), null)
    assert.equal(ag.parseAgentBadge('{"state":"working"}', NOW, 90_000), null)
    assert.equal(ag.parseAgentBadge('{"agent":"x","state":"hacked","ts":1}', NOW, 90_000), null)
  })

  test('hookArgs/hookCommandLine 含 agent/state 且指向脚本', () => {
    const sp = 'C:/Users/x/.promptpal/agent-hook.ps1'
    const { command, args } = ag.hookArgs('zcode', 'working', sp)
    assert.equal(command, 'powershell')
    assert.deepEqual(args.slice(-4), ['-Agent', 'zcode', '-State', 'working'])
    assert.ok(args.includes(sp))
    const line = ag.hookCommandLine('claude', 'done', sp)
    assert.ok(line.includes('-Agent claude -State done'))
    assert.ok(line.includes(sp))
    assert.ok(ag.HOOK_SCRIPT.includes('agent_state.json'))
  })
}

// ===== 收尾 =====
rmSync(tmp, { recursive: true, force: true })
if (failures > 0) {
  console.error(`\n${failures} 个断言失败`)
  process.exit(1)
}
console.log('\nALL PASS')
