/**
 * chinese-extractor.js v2.0
 * 双模式：结构骨架模式 + 统计模式
 * 零依赖 / 完全离线
 */

export class ChineseExtractor {

  constructor(config = {}) {
    this.topKeywords    = config.topKeywords    || 30
    this.topSentences   = config.topSentences   || 25
    this.minSentenceLen = config.minSentenceLen || 10
    this.renderMode     = config.renderMode     || 'auto'
  }

  // ══════════════════════════════════════
  // 主入口
  // ══════════════════════════════════════

  extract(text, fileName = 'document.txt', onProgress = null) {
    const notify = onProgress || (() => {})

    notify({ progress: 5,  message: '正在清洗文本...' })
    const cleaned = this.cleanText(text)

    notify({ progress: 15, message: '正在检测文档类型...' })
    const docType = this.detectDocumentType(cleaned)

    let report

    if (this.renderMode === 'structure' ||
        (this.renderMode === 'auto' && docType.hasStrongStructure)) {
      notify({ progress: 25, message: '检测到强结构文档，启用骨架模式...' })
      report = this.extractByStructure(cleaned, fileName, notify)
    } else {
      notify({ progress: 25, message: '检测到普通文档，启用统计模式...' })
      report = this.extractByStatistics(cleaned, fileName, notify)
    }

    notify({ progress: 100, message: '完成' })
    return report
  }

  // ══════════════════════════════════════
  // 文档类型检测
  // ══════════════════════════════════════

  detectDocumentType(text) {
    const lines = text.split('\n')
    let score = 0

    const markdownHeaders  = lines.filter(l => /^#{1,6}\s/.test(l)).length
    const numberedLaws     = lines.filter(l => /Law-\d+|SP-[A-Z]+-\d+/.test(l)).length
    const treeStructure    = lines.filter(l => /[└├]─/.test(l)).length
    const definitionBlocks = lines.filter(l => /一句话定义|核心约束|合格标准|违反信号/.test(l)).length
    const emojiHeaders     = lines.filter(l => /^[⚡🔮⚛️🌐🛡️🎮📊🎯🔧🧱🔄]/.test(l)).length
    const bulletPoints     = lines.filter(l => /^[•·\-\*■▶]\s/.test(l)).length
    const chineseOrdered   = lines.filter(l => /^第[一二三四五六七八九十\d]+[章节部分]/.test(l)).length

    score += markdownHeaders  > 5  ? 30 : 0
    score += numberedLaws     > 3  ? 25 : 0
    score += treeStructure    > 10 ? 20 : 0
    score += definitionBlocks > 3  ? 15 : 0
    score += emojiHeaders     > 3  ? 10 : 0
    score += bulletPoints     > 10 ? 10 : 0
    score += chineseOrdered   > 3  ? 15 : 0

    return { hasStrongStructure: score >= 30, structureScore: score }
  }

  // ══════════════════════════════════════
  // 模式一：结构骨架提取
  // ══════════════════════════════════════

  extractByStructure(text, fileName, notify) {
    notify({ progress: 35, message: '正在解析文档骨架...' })
    const skeleton = this.parseSkeleton(text)

    notify({ progress: 55, message: '正在提取核心定义块...' })
    const definitions = this.extractDefinitionBlocks(text)

    notify({ progress: 70, message: '正在提取关键规则...' })
    const rules = this.extractKeyRules(text)

    notify({ progress: 82, message: '正在提取公式与数值...' })
    const formulas = this.extractFormulasAndNumbers(text)

    notify({ progress: 92, message: '正在生成报告...' })
    return this.renderStructuredReport({ fileName, skeleton, definitions, rules, formulas, text })
  }

  parseSkeleton(text) {
    const lines = text.split('\n')
    const nodes = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      // Markdown 标题
      const mdH = line.match(/^(#{1,6})\s+(.+)/)
      if (mdH) {
        nodes.push({ level: mdH[1].length, text: mdH[2].trim(), type: 'heading' })
        continue
      }

      // 中文章节
      const cnH = line.match(/^第([一二三四五六七八九十百\d]+)[章节部分篇]/)
      if (cnH && line.length < 60) {
        nodes.push({ level: 2, text: line, type: 'cn-heading' })
        continue
      }

      // Law / SP 编号
      const lawH = line.match(/^(Law-\d+|SP-[A-Z]+-\d+|Meta-Law-\d+|BF-\d+|CF-\d+)\s*[·\.\-]/)
      if (lawH) {
        nodes.push({ level: 3, text: line, type: 'law', id: lawH[1] })
        continue
      }

      // Emoji 大标题
      const emojiH = line.match(/^([⚡🔮⚛️🌐🛡️🎮📊🎯🔧🧱🔄⚖️🎛️♟️📡])\s*(.+)/)
      if (emojiH && line.length < 80) {
        nodes.push({ level: 2, text: line, type: 'emoji-heading' })
        continue
      }

      // 【X】格式
      const bracketH = line.match(/^【([一二三四五六七八九十\d]+)】/)
      if (bracketH) {
        nodes.push({ level: 2, text: line, type: 'bracket-heading' })
        continue
      }

      // ■ ▌ 符号标题
      if (line.startsWith('■') || line.startsWith('▌')) {
        nodes.push({ level: 2, text: line, type: 'symbol-heading' })
        continue
      }

      // 永恒X
      if (/^永恒[一二三四五六七八九十]/.test(line) && line.length < 60) {
        nodes.push({ level: 3, text: line, type: 'eternal' })
        continue
      }
    }

    return nodes
  }

  extractDefinitionBlocks(text) {
    const blocks = []
    const lines  = text.split('\n')

    const defTriggers = [
      '一句话定义', '核心约束', '合格标准', '违反信号',
      '破坏后果', '灰色地带', '物理解释', '工程投影',
      '核心公式', '物理规律', '物理红线', '物理定义',
      '最高警告', '物理事实', '工程约束', '量化公式'
    ]

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      const trigger = defTriggers.find(t => line.includes(t))
      if (!trigger) continue

      let ownerTitle = ''
      for (let j = i - 1; j >= Math.max(0, i - 15); j--) {
        const prev = lines[j].trim()
        if (prev && (
          /^#{1,6}\s/.test(prev) ||
          /^Law-\d+/.test(prev) ||
          /^SP-[A-Z]+-\d+/.test(prev) ||
          /^Meta-Law/.test(prev) ||
          /^永恒[一二三四五六七八九十]/.test(prev)
        )) {
          ownerTitle = prev.replace(/^#+\s*/, '')
          break
        }
      }

      const content = []
      for (let j = i; j < Math.min(lines.length, i + 8); j++) {
        const l = lines[j].trim()
        if (!l) break
        if (j > i && defTriggers.some(t => l.includes(t))) break
        content.push(l)
      }

      if (content.length > 0) {
        blocks.push({ trigger, owner: ownerTitle, content: content.join(' | ') })
      }
    }

    return blocks
  }

  extractKeyRules(text) {
    const lines     = text.split('\n')
    const must      = []
    const forbidden = []
    const warning   = []

    for (const raw of lines) {
      const line = raw.trim()
      if (!line || line.length < 8 || line.length > 200) continue

      if (/^[✗❌]/.test(line) || line.startsWith('禁止') || line.startsWith('不允许') || line.startsWith('严禁')) {
        forbidden.push(line)
      } else if (/^[✓□]/.test(line) || line.startsWith('必须') || line.startsWith('强制')) {
        must.push(line)
      } else if (/^(P0-|P1-|RED-0|⚠️|FAIL_)/.test(line)) {
        warning.push(line)
      }
    }

    return {
      must:      must.slice(0, 30),
      forbidden: forbidden.slice(0, 30),
      warning:   warning.slice(0, 20)
    }
  }

  extractFormulasAndNumbers(text) {
    const lines    = text.split('\n')
    const formulas = []
    const numbers  = []

    for (const raw of lines) {
      const line = raw.trim()
      if (!line || line.length > 200) continue

      if (/[=→≥≤]/.test(line) && /[A-Za-z_]/.test(line) &&
          /C_|P_|CBR|JSS|S_|Law-\d+/.test(line) && !/^\/\//.test(line)) {
        formulas.push(line)
      }

      if (/[≥≤<>]\s*[\d.]+/.test(line) && line.length < 150) {
        numbers.push(line)
      }
    }

    return {
      formulas: [...new Set(formulas)].slice(0, 20),
      numbers:  [...new Set(numbers)].slice(0, 15)
    }
  }

  renderStructuredReport({ fileName, skeleton, definitions, rules, formulas, text }) {
    const time = new Date().toLocaleString('zh-CN')
    const L    = []
    const hr1  = '═'.repeat(60)
    const hr2  = '─'.repeat(48)

    L.push(hr1)
    L.push('  核心内容提炼报告（结构骨架模式）')
    L.push(`  文件：${fileName}`)
    L.push(`  时间：${time}`)
    L.push(`  模式：文档骨架识别 + 定义块提取 + 规则提炼`)
    L.push(hr1)
    L.push('')

    const lines = text.split('\n')
    L.push('【一】文档统计')
    L.push(hr2)
    L.push(`  总字符：${text.length.toLocaleString()} 字`)
    L.push(`  总行数：${lines.length.toLocaleString()} 行`)
    L.push(`  骨架节点：${skeleton.length} 个`)
    L.push(`  定义块：${definitions.length} 个`)
    L.push(`  必须项：${rules.must.length} 条`)
    L.push(`  禁止项：${rules.forbidden.length} 条`)
    L.push(`  高危警告：${rules.warning.length} 条`)
    L.push(`  核心公式：${formulas.formulas.length} 条`)
    L.push('')

    if (skeleton.length > 0) {
      L.push('【二】文档骨架（完整层级结构）')
      L.push(hr2)
      for (const node of skeleton) {
        const pad = '  '.repeat(Math.max(0, node.level - 1))
        const sym = node.level === 1 ? '▌ '
                  : node.level === 2 ? '├─ '
                  : node.level === 3 ? '  └─ '
                  : '    · '
        L.push(`${pad}${sym}${node.text}`)
      }
      L.push('')
    }

    if (formulas.formulas.length > 0) {
      L.push('【三】核心公式与定量约束')
      L.push(hr2)
      formulas.formulas.forEach((f, i) => L.push(`  ${i + 1}. ${f}`))
      L.push('')
    }

    if (formulas.numbers.length > 0) {
      L.push('【四】关键阈值与数值约束')
      L.push(hr2)
      formulas.numbers.forEach((n, i) => L.push(`  ${i + 1}. ${n}`))
      L.push('')
    }

    if (rules.forbidden.length > 0) {
      L.push('【五】明确禁止项')
      L.push(hr2)
      rules.forbidden.forEach((r, i) => L.push(`  ${i + 1}. ${r}`))
      L.push('')
    }

    if (rules.must.length > 0) {
      L.push('【六】强制要求项')
      L.push(hr2)
      rules.must.forEach((r, i) => L.push(`  ${i + 1}. ${r}`))
      L.push('')
    }

    if (rules.warning.length > 0) {
      L.push('【七】P0/P1 高危警告')
      L.push(hr2)
      rules.warning.forEach((r, i) => L.push(`  ${i + 1}. ${r}`))
      L.push('')
    }

    if (definitions.length > 0) {
      L.push('【八】核心定义块（按类型聚合）')
      L.push(hr2)

      const grouped = {}
      for (const d of definitions) {
        if (!grouped[d.trigger]) grouped[d.trigger] = []
        grouped[d.trigger].push(d)
      }

      for (const [trigger, items] of Object.entries(grouped)) {
        L.push(`  ▶ ${trigger}`)
        items.slice(0, 8).forEach(item => {
          if (item.owner) L.push(`    [${item.owner}]`)
          L.push(`    ${item.content}`)
          L.push('')
        })
      }
    }

    L.push(hr1)
    L.push(`  原文 ${text.length} 字 → 报告 ${L.join('\n').length} 字`)
    L.push(hr1)

    return L.join('\n')
  }

  // ══════════════════════════════════════
  // 模式二：统计提取
  // ══════════════════════════════════════

  extractByStatistics(text, fileName, notify) {
    const cleaned = this.cleanText(text)

    notify({ progress: 35, message: '正在识别文档结构...' })
    const structure = this.parseStructure(text)

    notify({ progress: 45, message: '正在分句...' })
    const sentences = this.splitSentences(cleaned)

    notify({ progress: 55, message: '正在分词...' })
    const allWords = this.segmentAll(cleaned)

    notify({ progress: 65, message: '正在计算 TF-IDF 关键词...' })
    const keywords = this.extractKeywords(allWords, sentences)

    notify({ progress: 78, message: '正在运行 TextRank...' })
    const ranked = this.textRank(sentences, keywords)

    notify({ progress: 90, message: '正在提取段落主旨...' })
    const paraDigests = this.digestParagraphs(text, keywords)

    return this.renderStatisticalReport({
      fileName, structure, keywords, ranked,
      paraDigests,
      totalSentences: sentences.length,
      totalChars: cleaned.length
    })
  }

  // ══════════════════════════════════════
  // 统计模式子方法
  // ══════════════════════════════════════

  cleanText(text) {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[\uff01-\uff5e]/g, c =>
        String.fromCharCode(c.charCodeAt(0) - 0xfee0))
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      .replace(/\n{4,}/g, '\n\n\n')
      .replace(/[^\S\n]{2,}/g, ' ')
      .replace(/\u0000/g, '')
      .trim()
  }

  parseStructure(text) {
    const lines  = text.split('\n')
    const titles = []
    const lists  = []
    const paras  = []
    let   buf    = []

    for (const raw of lines) {
      const line = raw.trim()
      if (!line) {
        if (buf.length) { paras.push(buf.join('')); buf = [] }
        continue
      }
      const mdH = line.match(/^(#{1,6})\s+(.+)/)
      if (mdH) {
        titles.push({ level: mdH[1].length, text: mdH[2].trim() })
        continue
      }
      const cnH = line.match(/^(第[一二三四五六七八九十百\d]+[章节部分篇]|[一二三四五六七八九十]+[、.．]|\d+[.、）)]\s)/)
      if (cnH && line.length < 50) {
        titles.push({ level: 2, text: line })
        continue
      }
      if (line.length < 40 && !/[，。；：！？,;]/.test(line) &&
          /[\u4e00-\u9fa5]/.test(line) && buf.length === 0) {
        titles.push({ level: 3, text: line })
        continue
      }
      if (/^[•·\-\*]\s/.test(line) || /^[①-⑩]/.test(line) ||
          /^\d+[.、）)]\s/.test(line)) {
        lists.push(line.replace(/^[•·\-\*①-⑩\d]+[.、）)]*\s*/, '').trim())
        continue
      }
      buf.push(line)
    }
    if (buf.length) paras.push(buf.join(''))
    return { titles, lists, paras }
  }

  splitSentences(text) {
    const raw = text
      .replace(/([。！？!?…]+)/g, '$1\n')
      .replace(/([；;])\s*/g, '$1\n')
      .split('\n')
      .map(s => s.trim())
      .filter(s =>
        s.length >= this.minSentenceLen &&
        /[\u4e00-\u9fa5]/.test(s)
      )
    const seen = new Set()
    return raw.filter(s => {
      const key = s.replace(/\s/g, '')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  segmentAll(text) {
    const dict      = this.getDict()
    const stopWords = this.getStopWords()
    const words     = []
    const blocks    = text.split(/[，。！？；：\s\n""【】《》（）()「」『』\[\]]+/)

    for (const block of blocks) {
      const cjk = block.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '')
      if (!cjk) continue
      let i = 0
      while (i < cjk.length) {
        let matched = false
        for (let len = Math.min(4, cjk.length - i); len >= 2; len--) {
          const w = cjk.slice(i, i + len)
          if (dict.has(w) && !stopWords.has(w)) {
            words.push(w); i += len; matched = true; break
          }
        }
        if (!matched) {
          const ch = cjk[i]
          if (/[\u4e00-\u9fa5]/.test(ch) && !stopWords.has(ch)) {
            words.push(ch)
          } else if (/[a-zA-Z]/.test(ch)) {
            let j = i
            while (j < cjk.length && /[a-zA-Z]/.test(cjk[j])) j++
            const word = cjk.slice(i, j).toLowerCase()
            if (word.length >= 2 && !stopWords.has(word)) words.push(word)
            i = j; continue
          }
          i++
        }
      }
    }
    return words
  }

  segment(sentence) {
    const dict      = this.getDict()
    const stopWords = this.getStopWords()
    const words     = new Set()
    const cjk       = sentence.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '')
    let i = 0
    while (i < cjk.length) {
      let matched = false
      for (let len = Math.min(4, cjk.length - i); len >= 2; len--) {
        const w = cjk.slice(i, i + len)
        if (dict.has(w) && !stopWords.has(w)) {
          words.add(w); i += len; matched = true; break
        }
      }
      if (!matched) {
        const ch = cjk[i]
        if (/[\u4e00-\u9fa5]/.test(ch) && !stopWords.has(ch)) words.add(ch)
        i++
      }
    }
    return words
  }

  extractKeywords(allWords, sentences) {
    const docCount = sentences.length || 1
    const tf       = new Map()
    for (const w of allWords) tf.set(w, (tf.get(w) || 0) + 1)

    const df = new Map()
    for (const sent of sentences) {
      for (const w of this.segment(sent)) df.set(w, (df.get(w) || 0) + 1)
    }

    const scores = []
    for (const [word, freq] of tf) {
      if (freq < 2 || /^\d+$/.test(word)) continue
      const tfS  = freq / allWords.length
      const idfS = Math.log((docCount + 1) / ((df.get(word) || 0) + 1)) + 1
      scores.push({ word, score: tfS * idfS, freq })
    }
    return scores.sort((a, b) => b.score - a.score).slice(0, this.topKeywords)
  }

  textRank(sentences, keywords) {
    if (!sentences.length) return []
    if (sentences.length === 1) return [{ text: sentences[0], score: 1, rank: 1 }]

    const kwSet    = new Set(keywords.map(k => k.word))
    const sents    = sentences.slice(0, 200)
    const n        = sents.length
    const wordSets = sents.map(s => this.segment(s))
    const sim      = this.buildSimMatrix(wordSets, n)
    const pgS      = this.pageRank(sim, n)

    const results = sents.map((text, i) => {
      let score = pgS[i]
      let kwHits = 0
      for (const w of wordSets[i]) if (kwSet.has(w)) kwHits++
      score = score * 0.6 + Math.min(kwHits / 5, 1) * 0.4
      const ratio = i / n
      score *= ratio < 0.1 ? 1.25 : ratio < 0.2 ? 1.10 : ratio > 0.9 ? 1.10 : 1.0
      const len = text.replace(/\s/g, '').length
      score *= len < 15 ? 0.6 : len > 120 ? 0.8 : 1.0
      if (/\d+[\.\%倍万亿百千]/.test(text)) score *= 1.15
      return { text, score, originalIndex: i }
    })

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, this.topSentences)
      .map((item, i) => ({ ...item, rank: i + 1 }))
  }

  buildSimMatrix(wordSets, n) {
    const matrix = Array.from({ length: n }, () => new Float32Array(n))
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const si = wordSets[i]; const sj = wordSets[j]
        if (!si.size || !sj.size) continue
        let inter = 0
        for (const w of si) if (sj.has(w)) inter++
        const union = si.size + sj.size - inter
        if (!union) continue
        matrix[i][j] = inter / union
        matrix[j][i] = inter / union
      }
    }
    return matrix
  }

  pageRank(matrix, n, d = 0.85, maxIter = 50) {
    let scores  = new Float32Array(n).fill(1 / n)
    const rSums = matrix.map(row => row.reduce((a, b) => a + b, 0))

    for (let iter = 0; iter < maxIter; iter++) {
      const next  = new Float32Array(n)
      let   delta = 0
      for (let i = 0; i < n; i++) {
        let sum = 0
        for (let j = 0; j < n; j++) {
          if (i !== j && rSums[j] > 0) sum += (matrix[j][i] / rSums[j]) * scores[j]
        }
        next[i] = (1 - d) / n + d * sum
        delta  += Math.abs(next[i] - scores[i])
      }
      scores = next
      if (delta < 1e-5) break
    }
    return scores
  }

  digestParagraphs(text, keywords) {
    const kwSet = new Set(keywords.slice(0, 15).map(k => k.word))

    return text
      .split(/\n\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 20 && /[\u4e00-\u9fa5]/.test(p))
      .slice(0, 30)
      .map((para, idx) => {
        const sents = this.splitSentences(this.cleanText(para))
        if (!sents.length) return null
        let best = sents[0], bestScore = 0
        for (const s of sents) {
          let hits = 0
          for (const w of this.segment(s)) if (kwSet.has(w)) hits++
          const score = hits + (s === sents[0] ? 2 : 0)
          if (score > bestScore) { bestScore = score; best = s }
        }
        return {
          index: idx + 1, digest: best,
          sentCount: sents.length,
          charCount: para.replace(/\s/g, '').length
        }
      })
      .filter(Boolean)
  }

  renderStatisticalReport({
    fileName, structure, keywords, ranked,
    paraDigests, totalSentences, totalChars
  }) {
    const time = new Date().toLocaleString('zh-CN')
    const L    = []
    const hr1  = '═'.repeat(60)
    const hr2  = '─'.repeat(48)

    L.push(hr1)
    L.push('  核心内容提炼报告（统计模式）')
    L.push(`  文件：${fileName}`)
    L.push(`  时间：${time}`)
    L.push(`  模式：TF-IDF + TextRank（离线 / 零依赖）`)
    L.push(hr1)
    L.push('')

    L.push('【一】文档统计')
    L.push(hr2)
    L.push(`  总字符：${totalChars.toLocaleString()} 字`)
    L.push(`  有效句：${totalSentences} 句`)
    L.push(`  段落数：${structure.paras.length} 段`)
    L.push(`  标题数：${structure.titles.length} 个`)
    L.push(`  列表项：${structure.lists.length} 条`)
    L.push('')

    if (structure.titles.length > 0) {
      L.push('【二】文档结构')
      L.push(hr2)
      for (const t of structure.titles) {
        const pad = '  '.repeat(Math.max(0, t.level - 1))
        const sym = t.level === 1 ? '▌' : t.level === 2 ? '├─' : '└─'
        L.push(`${pad}${sym} ${t.text}`)
      }
      L.push('')
    }

    L.push('【三】核心关键词（TF-IDF）')
    L.push(hr2)
    for (let i = 0; i < keywords.length; i += 5) {
      L.push('  ' + keywords.slice(i, i + 5)
        .map((k, j) => `${i+j+1}.${k.word}(${k.freq}次)`)
        .join('   '))
    }
    L.push('')

    if (structure.lists.length > 0) {
      L.push('【四】文档要点列表')
      L.push(hr2)
      structure.lists.slice(0, 25).forEach((item, i) => {
        L.push(`  ${i + 1}. ${item}`)
      })
      L.push('')
    }

    if (paraDigests.length > 0) {
      L.push('【五】各段核心主旨句')
      L.push(hr2)
      for (const p of paraDigests) {
        L.push(`  ▶ 第 ${p.index} 段（${p.sentCount} 句 / ${p.charCount} 字）`)
        L.push(`    ${p.digest}`)
        L.push('')
      }
    }

    L.push('【六】TextRank 核心句子（综合评分前25句）')
    L.push(hr2)
    for (const s of ranked) {
      L.push(`  No.${String(s.rank).padStart(2, '0')}  ${s.text}`)
      L.push('')
    }

    L.push(hr1)
    L.push(`  原文 ${totalChars} 字 → 报告 ${L.join('\n').length} 字`)
    L.push(hr1)

    return L.join('\n')
  }

  // ══════════════════════════════════════
  // 词典
  // ══════════════════════════════════════

  getDict() {
    if (this._dict) return this._dict
    const words = [
      '系统','管理','用户','服务','数据','信息','技术','平台','功能','界面',
      '产品','方案','模块','接口','文件','目录','配置','参数','版本','更新',
      '安全','权限','账号','密码','验证','授权','认证','加密','协议','标准',
      '流程','规范','制度','政策','法规','条款','合同','方法','步骤','阶段',
      '问题','解决','分析','评估','测试','部署','维护','监控','报告','记录',
      '目标','计划','策略','方向','需求','要求','条件','限制','范围','边界',
      '结果','效果','影响','原因','风险','成本','价值','质量','效率','性能',
      '资源','能力','支持','扩展','集成','兼容','稳定','可靠','灵活','便捷',
      '企业','公司','组织','团队','部门','项目','业务','运营','市场','客户',
      '合作','竞争','发展','战略','规划','执行','监督','控制','评价','改进',
      '销售','采购','供应','库存','物流','财务','预算','利润','收入','支出',
      '算法','模型','网络','数据库','服务器','客户端','前端','后端','框架',
      '代码','程序','软件','硬件','设备','云端','存储','计算','处理','传输',
      '请求','响应','缓存','队列','线程','进程','容器','集群','负载','日志',
      '人工智能','机器学习','深度学习','神经网络','自然语言','图像识别',
      '大数据','区块链','云计算','物联网','边缘计算','数字化','智能化',
      '互联网','移动端','小程序','公众号','电商','直播','短视频','社交',
      '政府','机构','监管','合规','法律','规定','义务','责任','权利','保护',
      '隐私','审计','检查','许可','申请','审批','备案','登记','注册','资质',
      '研究','实验','验证','理论','结论','发现','创新','突破','趋势','现状',
      '假设','变量','因素','指标','样本','误差','精度','方法论','文献','引用',
      '健康','医疗','疾病','治疗','预防','诊断','药物','手术','康复','患者',
      '金融','投资','融资','股权','债券','基金','保险','银行','信贷','利率',
      '风险','收益','资产','负债','现金','流动性','估值','股票','期权',
      '学习','教育','培训','课程','知识','技能','考试','认证','经验','实践',
      '实现','完成','提高','降低','增加','减少','优化','改善','建立','构建',
      '设计','开发','确保','保证','满足','符合','遵守','执行','协调','整合',
      '重要','关键','核心','基础','主要','必要','可选','默认','全局','局部',
      '高效','稳定','灵活','标准','规范','完整','准确','及时','有效','合理',
      '验证','控制','约束','定义','法则','规律','原则','机制','策略','协议',
      '永恒','物理','语义','认知','算力','纯度','骨架','层级','边界','投影',
      '熵增','复杂度','可观测','因果','闭环','自愈','降级','熔断','阈值',
      '数字经济','共同富裕','高质量发展','乡村振兴','碳中和','智慧城市',
      '产业链','生态系统','新能源','供应链','创新驱动'
    ]
    this._dict = new Set(words)
    return this._dict
  }

  // ══════════════════════════════════════
  // 停用词
  // ══════════════════════════════════════

  getStopWords() {
    if (this._stopWords) return this._stopWords
    const stops = [
      '我','你','他','她','它','我们','你们','他们','她们','它们',
      '这','那','这个','那个','这些','那些','这里','那里','哪','谁',
      '什么','怎么','怎样','如何','为何','自己','本身','大家','别人',
      '的','地','得','了','着','过','和','与','或','及','而','但',
      '因为','所以','如果','虽然','但是','然而','不过','而且','并且',
      '因此','于是','然后','同时','另外','此外','其次','最后','以及',
      '还是','或者','既然','即使','尽管','除非','只要','只有','不仅',
      '其实','总之','综上','由此','据此','为此','对此','关于','至于',
      '很','非常','十分','极','特别','尤其','相当','比较','更','最',
      '太','过','稍','略','有点','已经','正在','将要','马上','立即',
      '经常','常常','往往','通常','一般','有时','总是','始终','一直',
      '当然','确实','果然','居然','竟然','毕竟','终于','最终','原来',
      '只','仅','仅仅','只是','就','才','都','全','均',
      '吗','呢','吧','啊','哦','么','呀','嘛','啦',
      '是','有','在','做','说','看','想','知','去','来','到','把','被',
      '让','使','令','叫','请','问','答','告','给','拿','用',
      '今天','昨天','明天','现在','当时','以前','以后','之前','之后',
      '上','下','左','右','前','后','内','外','里','中','间','旁',
      'the','a','an','is','are','was','were','be','have','has','do',
      'does','did','will','would','could','should','may','might','to',
      'of','in','for','on','with','at','by','from','as','and','or',
      'but','not','this','that','it','we','they','he','she','i'
    ]
    this._stopWords = new Set(stops)
    return this._stopWords
  }
}
