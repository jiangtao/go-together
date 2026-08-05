---
name: translate-pdf-book
description: Translate complete PDF books into polished target-language reading editions and page-aligned bilingual editions while preserving technical terms, code, figures, and source pagination. Use when the user asks to translate a book or long PDF, requests 翻译书籍/翻译 PDF, wants English keywords retained, or needs bilingual and target-language-only PDF deliverables.
---

# 翻译 PDF 书籍

将整本 PDF 按页翻译，并生成可校对、可搜索的专业译本。默认保留必要英文术语、产品名称、代码标识符、图表上下文和原书页码。

## 执行约束

1. 同时加载并遵循 `pdf:pdf` Skill；先检查 PDF，再创建成品。
2. 翻译前完整读取 [references/translation-policy.md](references/translation-policy.md)。
3. 只处理用户提供或明确授权访问的材料。未经要求，不把书稿上传到第三方翻译服务，也不公开分发成品。
4. 不把翻译做成摘要。逐页覆盖正文、标题、目录、图注、脚注和列表；代码保持可运行，不翻译标识符。

## 工作流

### 1. 确认交付约定

从用户请求中确定：

- 目标语言；
- 是否保留英文术语，以及首次出现/后续出现的格式；
- 需要逐页双语对照版、纯目标语言阅读版，或两者都要；
- 是否必须保留原图、原代码和原页码。

请求已经明确时直接执行。默认交付：目标语言主译、关键英文术语保留、代码不改写、双语对照版和纯目标语言阅读版各一份。

### 2. 检查源 PDF

使用 `pdfinfo`、`pdfplumber` 或 `pypdf` 检查：

- 总页数、页面尺寸和旋转；
- 文本层覆盖率、空白页和疑似扫描页；
- 目录、正文、代码页、表格、图像和高密度页面的代表样本；
- 估算总词数与需要 OCR 的页面。

至少渲染封面、目录、正文、代码/图表和结尾页进行视觉检查。文本层不足时先 OCR，且保留页码映射。

### 3. 建立术语表并逐页翻译

先从目录、前言和代表章节提取高频术语，再按 [references/translation-policy.md](references/translation-policy.md) 统一译法。

把译文保存为 UTF-8 Markdown，严格使用以下页级结构：

```markdown
## Page 1

# 目标语言标题（English Term）

逐页完整译文。

## Page 2

下一页译文。
```

页号必须从 `1` 连续到源 PDF 总页数。空白页保留对应标题，但正文留空。不要把跨页句子重复翻译；在原分页处自然续写。

### 4. 生成 PDF

使用 `scripts/build_translated_book.py` 确定性排版。依赖 `reportlab` 与 `pypdf`。

生成逐页双语对照版：

```bash
python scripts/build_translated_book.py \
  --source /abs/source.pdf \
  --translations /abs/translations.md \
  --output /abs/output-bilingual.pdf \
  --mode bilingual \
  --translation-header "中文译文" \
  --source-header "英文原页" \
  --page-label-template "原书第 {page} 页" \
  --term-note "关键术语、产品名称、代码与标识符保留英文"
```

生成纯目标语言阅读版：

```bash
python scripts/build_translated_book.py \
  --source /abs/source.pdf \
  --translations /abs/translations.md \
  --output /abs/output-reading.pdf \
  --mode reading \
  --translation-header "中文阅读版" \
  --page-label-template "第 {page} 页" \
  --term-note "关键术语、产品名称、代码与标识符保留英文"
```

若自动字体探测失败，使用 `--regular-font` 与 `--bold-font` 传入支持目标语言的 TTF/TTC 字体。中间文件放在 `tmp/pdfs/`，最终 PDF 放在 `output/pdf/`。

### 5. 验证成品

交付前全部满足：

- 源 PDF、译文页映射和两个成品页数一致；
- 纯目标语言版不包含隐藏的整页源语言正文；
- 译文可搜索、可复制；
- 术语、数字、日期、产品名和代码经过抽查；
- 封面、目录、最密集正文页、代码/图表页和结尾页无裁切、重叠、黑块或缺字；
- 最终版本全部页面以低分辨率渲染成功，代表页面再以高分辨率人工检查；
- 临时渲染图和构建文件已清理，最终文件名稳定且可辨识。

## 资源

- `scripts/build_translated_book.py`：从逐页 Markdown 生成双语或纯目标语言 PDF。
- `scripts/test_build_translated_book.py`：验证页数、页面尺寸、文本隔离和基本构建能力。
- `references/translation-policy.md`：完整性、术语、代码、图表和 QA 规则。
