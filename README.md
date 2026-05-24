# 🔬 核心内容提炼器

> 纯算法 · 零 AI · 零费用 · 完全离线
> 中文 TF-IDF + TextRank，提炼任意文本的核心内容

## 在线使用

部署后访问：`https://你的用户名.github.io/essence-extractor`

## 本地 CLI

```bash
# 克隆
git clone https://github.com/你的用户名/essence-extractor.git
cd essence-extractor

# 直接运行，无需 npm install
node cli.js --file=./文档.txt
node cli.js --file=./文档.txt --format=docx
node cli.js --file=./文档.md  --keywords=40 --sentences=30
```

## 支持格式

| 格式 | Web | CLI |
|------|-----|-----|
| TXT  | ✅  | ✅  |
| Markdown | ✅ | ✅ |
| HTML | ✅  | ✅  |
| CSV  | ✅  | ✅  |
| PDF  | 请先导出为TXT | 请先导出为TXT |
| Word | 请先导出为TXT | 请先导出为TXT |

## 算法说明

```
1. 正向最大匹配分词  → 中文词语切分
2. TF-IDF           → 关键词权重计算
3. TextRank         → 句子重要性评分（PageRank变体）
4. 多信号融合        → 位置权重 + 关键词密度 + 长度合理性
5. 结构识别          → 标题 / 列表 / 段落层级
```

## 输出内容

- 文档统计（字数 / 句数 / 段落数）
- 文档结构（标题层级）
- 核心关键词（TF-IDF排序）
- 文档要点列表
- 各段核心主旨句
- TextRank 核心句子（前25句）
