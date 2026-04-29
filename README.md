# switch_to_md

将任意文件格式转换为 Markdown，让 AI Agent 完美理解所有内容。

## 特性

- 🚀 **一行代码搞定**：`convert('file.pdf')`
- 📦 **轻量核心**：~500KB，无模型依赖
- 🔧 **灵活配置**：环境变量 / 配置文件 / 代码配置
- 🤖 **Agent 友好**：结构化 MD 输出，带 frontmatter
- 🌐 **支持云端 & 本地**：OpenAI / Claude / 本地模型
- 📄 **全格式覆盖**：PDF / Word / Excel / PPT / 图片 / 音频 / 代码

## 安装

```bash
# 核心包（文档类直接可用）
npm i switch-to-md

# 图片处理（可选）
npm i @switch-to-md/vision-openai  # OpenAI Vision
npm i @switch-to-md/vision-local   # 本地 Tesseract

# 音频处理（可选）
npm i @switch-to-md/audio-openai   # OpenAI Whisper
npm i @switch-to-md/audio-local    # 本地 Whisper
```

## 快速开始

```typescript
import { convert } from 'switch-to-md';

// 转换 PDF
const md = await convert('report.pdf');

// 转换 Word
const md = await convert('document.docx');

// 输出到文件
await convert('report.pdf', { output: 'report.md' });

// 批量转换
const results = await convert(['a.pdf', 'b.docx']);
```

## 配置

### 环境变量

```bash
# .env
SWITCH_TO_MD_PROVIDER=openai
SWITCH_TO_MD_API_KEY=sk-xxx
```

### 代码配置

```typescript
import { configure } from 'switch-to-md';

// OpenAI
configure({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
});

// 本地模型
configure({
  vision: { provider: 'local', model: 'tesseract' },
});

// 自定义端点
configure({
  vision: {
    provider: 'custom',
    baseUrl: 'http://localhost:8080/api/vision',
  },
});
```

### 配置文件

```typescript
// switch-to-md.config.ts
import { defineConfig } from 'switch-to-md';

export default defineConfig({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
});
```

## CLI 使用

```bash
# 转换文件
npx switch-to-md convert report.pdf

# 批量转换
npx switch-to-md convert ./docs/**/*.pdf -o ./output/

# 设置向导
npx switch-to-md setup

# 查看支持格式
npx switch-to-md formats
```

## 支持的格式

| 类别 | 格式 | 说明 |
|------|------|------|
| 文档 | PDF, DOCX, XLSX, PPTX, TXT, HTML, EPUB | 无需配置 |
| 图片 | PNG, JPG, GIF, BMP, TIFF, WebP | 需要视觉插件 |
| 音频 | MP3, WAV, FLAC, OGG, M4A | 需要音频插件 |
| 代码 | JSON, YAML, XML, CSV, 多语言源码 | 无需配置 |
| 矢量 | SVG | 无需配置 |

## 输出格式

```markdown
---
source: report.pdf
type: PDF
pages: 12
extracted_at: 2026-04-29T00:00:00Z
backend: pdf-parse
---

# Document Title

## Body
[内容]

## Tables
| Col1 | Col2 |
|------|------|
| Data | Data |
```

## 进度回调

```typescript
await convert('large.pdf', {
  onProgress: (info) => {
    console.log(`${info.stage}: ${info.percent}%`);
  },
});
```

## 错误处理

```typescript
import {
  UnsupportedFormatError,
  VisionNotConfiguredError,
  FileNotFoundError,
} from 'switch-to-md';

try {
  const md = await convert('file.xyz');
} catch (e) {
  if (e instanceof UnsupportedFormatError) {
    console.log(`不支持: ${e.format}，支持: ${e.supported.join(', ')}`);
  }
}
```

## API

### `convert(input, options?)`

```typescript
interface ConvertOptions {
  output?: string;        // 输出文件路径
  outputDir?: string;     // 批量输出目录
  onProgress?: (info: ProgressInfo) => void;
  cache?: boolean;
  signal?: AbortSignal;
}
```

### `configure(config)`

```typescript
interface Config {
  provider?: 'openai' | 'anthropic' | 'local' | 'custom';
  apiKey?: string;
  vision?: VisionConfig;
  audio?: AudioConfig;
}
```

## 开发

```bash
# 安装依赖
pnpm install

# 构建
pnpm build

# 测试
pnpm test
```

## License

MIT