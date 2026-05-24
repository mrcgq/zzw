/**
 * parser.js
 * 文件解析：浏览器端 + Node.js 端
 * 支持：TXT / MD / HTML / CSV
 * 零依赖
 */

export function parseFileBrowser(file) {
  return new Promise((resolve, reject) => {
    const ext       = file.name.split('.').pop().toLowerCase()
    const supported = ['txt', 'md', 'markdown', 'html', 'htm', 'csv']

    if (!supported.includes(ext)) {
      reject(new Error(
        `暂不支持 .${ext} 格式。\n` +
        `请将文件另存为 TXT 后再上传。\n` +
        `支持格式：${supported.join(' / ')}`
      ))
      return
    }

    const reader = new FileReader()
    reader.onload = e => {
      let text = e.target.result

      if (ext === 'html' || ext === 'htm') {
        const div = document.createElement('div')
        div.innerHTML = text
        div.querySelectorAll('script,style,iframe,svg,noscript').forEach(el => el.remove())
        text = div.innerText || div.textContent || ''
      }

      if (ext === 'csv') {
        text = text.split('\n').map(row => row.split(',').join('  ')).join('\n')
      }

      resolve(text)
    }
    reader.onerror = () => reject(new Error('文件读取失败，请重试'))
    reader.readAsText(file, 'UTF-8')
  })
}

export async function parseFileNode(filePath) {
  const fs   = await import('fs')
  const path = await import('path')

  const ext       = path.extname(filePath).toLowerCase()
  const supported = ['.txt', '.md', '.markdown', '.html', '.htm', '.csv']

  if (!supported.includes(ext)) {
    throw new Error(
      `CLI 模式支持格式：${supported.join(', ')}\n` +
      `PDF / Word 请先导出为 TXT 后处理。`
    )
  }

  let text = fs.readFileSync(filePath, 'utf-8')

  if (ext === '.html' || ext === '.htm') {
    text = text
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g,  ' ')
      .replace(/&amp;/g,   '&')
      .replace(/&lt;/g,    '<')
      .replace(/&gt;/g,    '>')
      .replace(/&quot;/g,  '"')
  }

  if (ext === '.csv') {
    text = text.split('\n').map(row => row.split(',').join('  ')).join('\n')
  }

  return text
}
