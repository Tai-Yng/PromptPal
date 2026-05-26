#!/usr/bin/env node
const { select, Separator } = require('@inquirer/prompts')
const { execSync } = require('child_process')
const { existsSync, readFileSync } = require('fs')
const { join, dirname } = require('path')
const { homedir } = require('os')

// 读取数据文件
function loadPrompts() {
  const paths = [
    join(homedir(), '.promptpal', 'promptpal_data.json'),
    join(process.cwd(), 'promptpal_data.json'),
  ]
  for (const p of paths) {
    if (existsSync(p)) {
      const raw = readFileSync(p, 'utf-8')
      const data = JSON.parse(raw)
      // data.prompts 可能是 JSON 字符串或已解析的数组
      let prompts = data.prompts
      if (typeof prompts === 'string') {
        try { prompts = JSON.parse(prompts) } catch { return [] }
      }
      if (Array.isArray(prompts)) return prompts
    }
  }
  return []
}

// Windows 剪贴板写入
function clipboardWrite(text) {
  if (process.platform === 'win32') {
    try {
      execSync('clip', { input: text, encoding: 'utf-8' })
      return true
    } catch { return false }
  }
  // Linux/macOS fallback
  try {
    execSync('pbcopy', { input: text, encoding: 'utf-8' })
    return true
  } catch {
    try {
      execSync('xclip -selection clipboard', { input: text, encoding: 'utf-8' })
      return true
    } catch { return false }
  }
}

async function main() {
  const prompts = loadPrompts()
  if (prompts.length === 0) {
    console.log('\n  [--] No prompts found.')
    console.log('  Run PromptPal and create some prompts first.\n')
    process.exit(1)
  }

  const categories = [...new Set(prompts.map(p => p.category))]
  const categoryLabels = {
    chat: 'Chat', code: 'Code', image: 'Image',
    writing: 'Writing', other: 'Other'
  }

  // 构建选项：按分类分组
  const choices = []
  for (const cat of categories) {
    choices.push(new Separator(`--- ${categoryLabels[cat] || cat} ---`))
    const catPrompts = prompts.filter(p => p.category === cat)
    for (const p of catPrompts) {
      const star = p.favorite ? ' *' : ''
      const title = p.title.length > 35 ? p.title.slice(0, 35) + '...' : p.title
      const count = p.useCount > 0 ? ` (${p.useCount})` : ''
      choices.push({
        name: `${title}${star}${count}`,
        value: p
      })
    }
  }

  try {
    const selected = await select({
      message: 'Select a prompt (enter to copy)',
      choices,
      pageSize: 15,
    })

    const ok = clipboardWrite(selected.content)
    if (ok) {
      console.log(`\n  [OK] "${selected.title}" copied to clipboard\n`)
    } else {
      console.log('\n' + selected.content + '\n')
    }
  } catch {
    // user cancelled (Ctrl+C)
    process.exit(0)
  }
}

main()
