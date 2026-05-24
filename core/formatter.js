/**
 * formatter.js
 * TXT + DOCX 生成（零依赖，手写 OpenXML + ZIP）
 */

export function formatAsTxt(reportText) {
  return reportText
}

export function formatAsDocx(reportText) {
  const xml = buildDocumentXml(reportText)
  return buildZip(xml)
}

function escapeXml(str) {
  return String(str ?? '')
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
}

function buildDocumentXml(text) {
  const paras = text.split('\n').map(line => lineToParagraph(line))
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paras.join('\n    ')}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1800" w:bottom="1440" w:left="1800"/>
    </w:sectPr>
  </w:body>
</w:document>`
}

function lineToParagraph(line) {
  const e = escapeXml(line)

  if (line.includes('核心内容提炼报告')) {
    return para(e, { bold: true, size: 32, color: '1E3A8A', align: 'center', spaceAfter: 200 })
  }
  if (/^[═─·]+$/.test(line.trim())) {
    return para(e, { color: '94A3B8', spaceAfter: 60 })
  }
  if (/^【[一二三四五六七八九十\d]+】/.test(line)) {
    return para(e, { bold: true, size: 26, color: '1E40AF', spaceBefore: 280, spaceAfter: 120 })
  }
  if (line.trimStart().startsWith('▶')) {
    return para(e, { bold: true, size: 22, color: '2563EB', spaceBefore: 180, spaceAfter: 80 })
  }
  if (/[▌├└]/.test(line)) {
    return para(e, { bold: true, color: '1D4ED8', spaceAfter: 60 })
  }
  if (/^\s+No\.\d+/.test(line)) {
    return para(e, { color: '374151', spaceAfter: 80 })
  }
  if (!line.trim()) {
    return `<w:p><w:pPr><w:spacing w:after="80"/></w:pPr></w:p>`
  }
  return para(e, { spaceAfter: 60 })
}

function para(text, opts = {}) {
  const {
    bold        = false,
    size        = 21,
    color       = '000000',
    align       = 'left',
    spaceBefore = 0,
    spaceAfter  = 60
  } = opts

  const rPr = [
    bold        ? '<w:b/>'                           : '',
    size !== 21 ? `<w:sz w:val="${size}"/>`           : '',
    color !== '000000' ? `<w:color w:val="${color}"/>` : ''
  ].filter(Boolean).join('')

  return `<w:p>
      <w:pPr>
        <w:jc w:val="${align}"/>
        <w:spacing w:before="${spaceBefore}" w:after="${spaceAfter}"/>
      </w:pPr>
      <w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}<w:t xml:space="preserve">${text}</w:t></w:r>
    </w:p>`
}

function buildZip(documentXml) {
  const files = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/word/document.xml"
    ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
    Target="word/document.xml"/>
</Relationships>`,
    'word/_rels/document.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`,
    'word/document.xml': documentXml
  }
  return zipFiles(files)
}

function zipFiles(files) {
  const enc     = new TextEncoder()
  const locals  = []
  const central = []
  let   offset  = 0

  for (const [name, content] of Object.entries(files)) {
    const nameB = enc.encode(name)
    const dataB = enc.encode(content)
    const crc   = crc32(dataB)

    const lh = new Uint8Array(30 + nameB.length)
    const lv = new DataView(lh.buffer)
    lv.setUint32(0,  0x04034b50, true)
    lv.setUint16(4,  20,         true)
    lv.setUint16(6,  0,          true)
    lv.setUint16(8,  0,          true)
    lv.setUint16(10, 0,          true)
    lv.setUint16(12, 0,          true)
    lv.setUint32(14, crc,              true)
    lv.setUint32(18, dataB.length,     true)
    lv.setUint32(22, dataB.length,     true)
    lv.setUint16(26, nameB.length,     true)
    lv.setUint16(28, 0,          true)
    lh.set(nameB, 30)
    locals.push(lh, dataB)

    const cd = new Uint8Array(46 + nameB.length)
    const cv = new DataView(cd.buffer)
    cv.setUint32(0,  0x02014b50, true)
    cv.setUint16(4,  20,         true)
    cv.setUint16(6,  20,         true)
    cv.setUint16(8,  0,          true)
    cv.setUint16(10, 0,          true)
    cv.setUint16(12, 0,          true)
    cv.setUint16(14, 0,          true)
    cv.setUint32(16, crc,              true)
    cv.setUint32(20, dataB.length,     true)
    cv.setUint32(24, dataB.length,     true)
    cv.setUint16(28, nameB.length,     true)
    cv.setUint16(30, 0,          true)
    cv.setUint16(32, 0,          true)
    cv.setUint16(34, 0,          true)
    cv.setUint16(36, 0,          true)
    cv.setUint32(38, 0,          true)
    cv.setUint32(42, offset,           true)
    cd.set(nameB, 46)
    central.push(cd)
    offset += lh.length + dataB.length
  }

  const cdSize = central.reduce((s, c) => s + c.length, 0)
  const eocd   = new Uint8Array(22)
  const ev     = new DataView(eocd.buffer)
  ev.setUint32(0,  0x06054b50,      true)
  ev.setUint16(4,  0,               true)
  ev.setUint16(6,  0,               true)
  ev.setUint16(8,  central.length,  true)
  ev.setUint16(10, central.length,  true)
  ev.setUint32(12, cdSize,          true)
  ev.setUint32(16, offset,          true)
  ev.setUint16(20, 0,               true)

  const parts = [...locals, ...central, eocd]
  const total = parts.reduce((s, p) => s + p.length, 0)
  const out   = new Uint8Array(total)
  let   pos   = 0
  for (const p of parts) { out.set(p, pos); pos += p.length }
  return out
}

function crc32(data) {
  const t = makeCrcTable()
  let c = 0xFFFFFFFF
  for (let i = 0; i < data.length; i++) {
    c = (c >>> 8) ^ t[(c ^ data[i]) & 0xFF]
  }
  return (c ^ 0xFFFFFFFF) >>> 0
}

function makeCrcTable() {
  if (makeCrcTable._t) return makeCrcTable._t
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    }
    t[i] = c
  }
  makeCrcTable._t = t
  return t
}
