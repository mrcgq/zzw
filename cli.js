#!/usr/bin/env node
/**
 * cli.js
 * 命令行入口，零依赖，Node.js 18+ 直接运行
 *
 * 用法：
 *   node cli.js --file=文档.txt
 *   node cli.js --file=文档.txt --format=docx
 *   node cli.js --file=文档.txt --keywords=40 --sentences=30
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, basename }          from 'path'
import { ChineseExtractor }           from './core/chinese-extractor.js'
import { formatAsDocx }               from './core/formatter.js'
import { parseFileNode }              from './core/parser.js'

// ── 参数解析 ──────────────────────────
const args = {}
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--')) {
    const [k, ...rest] = arg.slice(2).split('=')
    args[k] = rest.join('=') || true
  }
}

if (!args.file) {
  console.log(`
🔬 核心内容提炼器 - CLI 版

用法：
  node cli.js --file=文档路径 [选项]

选项：
  --format=txt|docx     输出格式，默认 txt
  --keywords=30         提取关键词数量，默认 30
  --sentences=25        提取核心句数量，默认 25

示例：
  node cli.js --file=./report.txt
  node cli.js --file=./report.txt --format=docx
  node cli.js --file=./report.md --keywords=40 --sentences=30
`)
  process.exit(0)
}

// ── 主流程 ────────────────────────────
const filePath = resolve(args.file)
const fileName = basename(filePath)
const format   = args.format    || 'txt'
const keywords = parseInt(args.keywords)  || 30
const sentences= parseInt(args.sentences) || 25

console.log(`\n🔬 核心内容提炼器`)
console.log('─'.repeat(44))
console.log(`  文件：${filePath}`)
console.log(`  格式：${format.toUpperCase()}`)
console.log(`  关键词：${keywords} 个  核心句：${sentences} 句`)
console.log('─'.repeat(44) + '\n')

try {
  // 读取文件
  const text = await parseFileNode(filePath)
  console.log(`✓ 文件读取完成，共 ${text.length.toLocaleString()} 字符\n`)

  // 提取
  const extractor = new ChineseExtractor({ topKeywords: keywords, topSentences: sentences })

  const report = extractor.extract(text, fileName, ({ progress, message }) => {
    const filled = Math.floor(progress / 5)
    const bar    = '█'.repeat(filled) + '░'.repeat(20 - filled)
    process.stdout.write(`\r  [${bar}] ${String(progress).padStart(3)}%  ${message}          `)
    if (progress === 100) process.stdout.write('\n')
  })

  // 输出文件
  const outBase = filePath.replace(/\.[^/.]+$/, '')

  if (format === 'docx') {
    const docxBytes = formatAsDocx(report)
    const outPath   = outBase + '_提炼.docx'
    writeFileSync(outPath, docxBytes)
    console.log(`\n✅ Word 文档已生成：${outPath}`)
  } else {
    const outPath = outBase + '_提炼.txt'
    writeFileSync(outPath, report, 'utf-8')
    console.log(`\n✅ TXT 文件已生成：${outPath}`)
  }

  // 预览
  console.log('\n' + '─'.repeat(44))
  console.log('预览（前800字）：')
  console.log('─'.repeat(44))
  console.log(report.slice(0, 800))
  if (report.length > 800) console.log('\n...(更多内容请查看输出文件)')

} catch (err) {
  console.error(`\n❌ 错误：${err.message}`)
  process.exit(1)
}
