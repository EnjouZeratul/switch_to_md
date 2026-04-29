# switch_to_md — Design Spec

## Overview

一个 TypeScript 优先的 npm 库，将**任意文件格式**转换为结构化、Agent 友好的 Markdown。核心零依赖（~50KB），视觉/音频能力通过可选插件提供。

**设计哲学**：用户不需要了解"流水线"、"节点"、"图"等概念。一行代码完成任务。

## Goals

- **一行 API**：`convert('file.pdf')` 搞定
- **零配置起步**：文本类文档直接可用
- **按需安装**：图片/音频处理通过插件
- **灵活配置**：支持环境变量、配置文件、代码配置
- **自定义端点**：可接入自建模型服务
- **Agent 友好**：结构化 MD 输出

## Non-Goals

- 视频处理（成本过高）
- 浏览器端运行（暂仅 Node.js）

---

## Architecture

### 目录结构

```
switch_to_md/
├── c/                              # C 层（可选字节级加速）
│   ├── src/
│   └── include/
│
├── packages/
│   ├── core/                       # 核心
│   │   ├── src/
│   │   │   ├── index.ts            # 公共 API：convert, configure
│   │   │   ├── detect.ts           # 文件类型检测
│   │   │   ├── router.ts           # 格式路由
│   │   │   ├── convert.ts           # 转换逻辑
│   │   │   ├── normalize.ts       # Markdown 标准化
│   │   │   ├── config.ts           # 配置管理
│   │   │   ├── errors.ts           # 错误类型定义
│   │   │   └── cache.ts            # 缓存机制
│   │   └── package.json
│   │
│   ├── adapters/                   # 格式适配器
│   │   ├── src/
│   │   │   ├── pdf.ts
│   │   │   ├── docx.ts
│   │   │   ├── xlsx.ts
│   │   │   ├── pptx.ts
│   │   │   ├── epub.ts
│   │   │   ├── svg.ts
│   │   │   ├── image.ts
│   │   │   ├── audio.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── plugins/                    # 插件（独立包）
│   │   ├── vision-local/
│   │   ├── vision-openai/
│   │   ├── vision-anthropic/
│   │   ├── audio-local/
│   │   └── audio-openai/
│   │
│   └── cli/                        # CLI 工具
│       ├── src/
│       │   ├── index.ts
│       │   └── commands/
│       │       ├── convert.ts
│       │       └── setup.ts
│       └── package.json
│
├── samples/                        # 测试样本
├── docs/
├── package.json
├── tsconfig.base.json
├── pnpm-workspace.yaml
└── README.md
```

### 数据流（用户不可见）

```
input
  ↓
detect() → 文件类型
  ↓
router() → 选择适配器
  ↓
adapter.parse() → 提取内容
  ↓
normalize() → 标准化 MD
  ↓
output
```

---

## Public API

### 基础用法

```typescript
import { convert } from 'switch-to-md';

// 单文件
const md = await convert('report.pdf');

// 多文件
const results = await convert(['a.pdf', 'b.docx']);

// 输出到文件
await convert('report.pdf', { output: 'report.md' });
```

### 完整选项

```typescript
interface ConvertOptions {
  // 输出控制
  output?: string;                        // 输出文件路径
  outputDir?: string;                     // 批量输出目录

  // 图片处理
  images?: {
    embed: 'base64' | 'file' | 'link' | 'none';
    outputDir?: string;                   // embed: 'file' 时图片保存目录
    maxWidth?: number;                    // 最大宽度（压缩）
  };

  // 进度回调
  onProgress?: (info: ProgressInfo) => void;

  // 缓存
  cache?: boolean | {
    enabled: boolean;
    dir?: string;
    ttl?: number;
  };

  // 取消
  signal?: AbortSignal;
}

interface ProgressInfo {
  percent: number;                         // 0-100
  stage: string;                           // 当前阶段
  message?: string;
}
```

### 配置 API

```typescript
import { configure } from 'switch-to-md';

// Level 1：最简配置
configure({
  apiKey: process.env.OPENAI_API_KEY,
});

// Level 2：指定 provider
configure({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
});

// Level 3：分模块配置
configure({
  vision: {
    provider: 'openai',
    apiKey: 'sk-xxx',
    model: 'gpt-4o',
  },
  audio: {
    provider: 'local',
    model: 'whisper',
  },
});

// Level 4：自定义端点
configure({
  vision: {
    provider: 'custom',
    baseUrl: 'http://localhost:8080/api/vision',
    apiKey: 'optional',
    headers: {
      'X-Custom': 'value',
    },
  },
});

// Level 5：本地模型
configure({
  vision: {
    provider: 'local',
    model: 'tesseract',
    lang: ['zh', 'en'],
  },
});
```

### 配置类型

```typescript
interface Config {
  // 快捷配置
  provider?: 'openai' | 'anthropic' | 'google' | 'aliyun' | 'local';
  apiKey?: string;

  // 分模块配置
  vision?: VisionConfig;
  audio?: AudioConfig;

  // 全局默认
  lang?: string | string[];
  timeout?: number;
}

interface VisionConfig {
  provider: 'openai' | 'anthropic' | 'google' | 'aliyun' | 'local' | 'custom';
  apiKey?: string;
  model?: string;
  baseUrl?: string;

  // local 专用
  lang?: string[];

  // custom 专用
  headers?: Record<string, string>;
}

interface AudioConfig {
  provider: 'openai' | 'local' | 'custom';
  apiKey?: string;
  model?: string;
  baseUrl?: string;

  // local 专用
  lang?: string;

  // custom 专用
  headers?: Record<string, string>;
}
```

---

## Configuration System

### 配置优先级

```
代码 configure() > switch-to-md.config.ts > 环境变量 > 默认
```

### 配置文件

```typescript
// switch-to-md.config.ts
import { defineConfig } from 'switch-to-md';

export default defineConfig({
  vision: {
    provider: 'custom',
    baseUrl: 'http://192.168.1.100:8080/api/vision',
  },
  audio: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
  },
});
```

### 环境变量

```bash
# 快捷配置
SWITCH_TO_MD_PROVIDER=openai
SWITCH_TO_MD_API_KEY=sk-xxx

# 视觉模块
SWITCH_TO_MD_VISION_PROVIDER=openai
SWITCH_TO_MD_VISION_API_KEY=sk-xxx
SWITCH_TO_MD_VISION_MODEL=gpt-4o
SWITCH_TO_MD_VISION_BASE_URL=https://api.openai.com/v1

# 音频模块
SWITCH_TO_MD_AUDIO_PROVIDER=openai
SWITCH_TO_MD_AUDIO_API_KEY=sk-xxx
SWITCH_TO_MD_AUDIO_MODEL=whisper-1

# 全局默认
SWITCH_TO_MD_LANG=zh,en
SWITCH_TO_MD_TIMEOUT=30000
```

---

## First-time User Experience

用户首次处理需要模型的文件时，返回友好引导而非报错：

```typescript
const md = await convert('image.png');
// 未配置任何模型后端

// 返回：
// ┌─────────────────────────────────────────────────────┐
// │ [switch-to-md] 图片处理需要配置视觉后端              │
// │                                                     │
// │ 请选择以下方式之一：                                 │
// │                                                     │
// │ 方式1：使用 OpenAI（推荐，快速）                     │
// │   configure({ provider: 'openai', apiKey: 'sk-xxx' });│
// │   或设置环境变量：SWITCH_TO_MD_API_KEY=sk-xxx       │
// │                                                     │
// │ 方式2：使用本地模型（免费）                          │
// │   npm i @switch-to-md/vision-local                  │
// │                                                     │
// │ 方式3：自定义服务                                   │
// │   configure({ vision: { provider: 'custom', baseUrl: '...' } });│
// │                                                     │
// │ 文档：https://github.com/xxx/switch_to_md#setup     │
// └─────────────────────────────────────────────────────┘
```

---

## Error Types

```typescript
// 基础错误类
class SwitchToMdError extends Error {
  code: string;
  hint?: string;
}

// 格式不支持
class UnsupportedFormatError extends SwitchToMdError {
  format: string;
  supported: string[];
}

// 视觉后端未配置
class VisionNotConfiguredError extends SwitchToMdError {
  hint: string;
}

// 音频后端未配置
class AudioNotConfiguredError extends SwitchToMdError {
  hint: string;
}

// 文件未找到
class FileNotFoundError extends SwitchToMdError {
  path: string;
}

// API Key 无效
class ApiKeyInvalidError extends SwitchToMdError {
  provider: string;
}

// 文件损坏
class CorruptedFileError extends SwitchToMdError {
  warnings: CorruptedWarning[];
}

interface CorruptedWarning {
  type: 'corrupted_page' | 'missing_image' | 'encoding_error';
  location: string;
  message: string;
}

// 使用示例
try {
  const md = await convert('file.xyz');
} catch (e) {
  if (e instanceof UnsupportedFormatError) {
    console.log(`不支持: ${e.format}，支持: ${e.supported.join(', ')}`);
  }
  if (e instanceof VisionNotConfiguredError) {
    console.log(e.hint);
  }
}
```

---

## Format Matrix

| 类别 | 格式 | 本地方案 | 云端 fallback |
|------|------|---------|---------------|
| 文档 | PDF, DOCX, XLSX, PPTX, TXT, RTF, HTML, EPUB | 纯 TS 解析 | N/A |
| 图片-文字 | JPG, PNG, GIF, BMP, TIFF, WebP | Tesseract.js | GPT-4o / Claude Vision |
| 图片-语义 | 同上 | Marker/Donut（Python 子进程） | GPT-4o / Claude Vision |
| 音频 | MP3, WAV, FLAC, OGG, M4A | whisper.cpp CLI | OpenAI Whisper API |
| 代码 | JSON, YAML, XML, CSV, SQL, 多语言源码 | 纯 TS 语法高亮 | N/A |
| 矢量 | SVG | 纯 TS 解析 | N/A |

---

## Output Format

```markdown
---
source: report.pdf
type: PDF
pages: 12
extracted_at: 2026-04-25T00:00:00Z
backend: tesseract + marker
---

# [文档标题/文件名]

## 摘要
[可选 AI 生成摘要]

## 正文
[结构化内容]

## 图表
### 图1: [描述]
![image](path_or_base64)
[图表内容描述、趋势、关键数据点]

### 表1: [表格标题]
| 列1 | 列2 | ... |
|-----|-----|-----|
| 数据 | 数据 | ... |

### 公式1: [描述]
$$E = mc^2$$
[公式解释]
```

---

## Custom Endpoint Protocol

使用自定义模型服务时需遵循以下协议：

### 视觉分析接口

```typescript
// POST ${baseUrl}/analyze
// Content-Type: application/json

// 请求
{
  "image": "<base64>",
  "options": {
    "lang": ["zh", "en"],
    "depth": "visual-semantic"
  }
}

// 响应
{
  "text": "识别出的文字内容...",
  "description": "图片描述（图表、公式等）",
  "tables": [...],     // 可选
  "formulas": [...]    // 可选
}
```

### 音频转写接口

```typescript
// POST ${baseUrl}/transcribe
// Content-Type: application/json

// 请求
{
  "audio": "<base64>",
  "options": {
    "lang": "zh",
    "timestamps": true
  }
}

// 响应
{
  "text": "转写文本...",
  "segments": [...]    // 可选，时间戳分段
}
```

---

## Batch Processing

```typescript
// 多文件
const results = await convert(['a.pdf', 'b.docx', 'c.png']);

// 返回结构
interface BatchResult {
  files: Record<string, string>;      // 文件名 → 内容
  errors: Record<string, Error>;      // 失败文件
  summary: {
    total: number;
    success: number;
    failed: number;
  };
}

// 输出到目录
await convert(['a.pdf', 'b.docx'], { outputDir: './output/' });
// → 生成 ./output/a.md, ./output/b.md

// Glob 支持
await convert('./docs/**/*.pdf');
```

---

## Cache Mechanism

```typescript
// 启用缓存
await convert('large.pdf', { cache: true });

// 详细配置
await convert('large.pdf', {
  cache: {
    enabled: true,
    dir: './.switch-to-md-cache',
    ttl: 86400,  // 24 小时
  }
});

// 默认缓存位置：./.switch-to-md-cache/
// 缓存 key：文件路径 + 内容哈希 + 配置哈希
```

---

## Plugin Auto-Discovery

用户安装插件包后自动启用，无需手动注册：

```typescript
// 核心内部实现
function getPlugin(type: 'vision' | 'audio') {
  // 优先检查代码配置
  if (config[type]) return createPluginFromConfig(config[type]);

  // 其次检查环境变量
  if (process.env[`SWITCH_TO_MD_${type.toUpperCase()}_PROVIDER`]) {
    return createPluginFromEnv(type);
  }

  // 最后检查本地插件包是否安装
  try {
    return require(`@switch-to-md/${type}-local`);
  } catch {
    return null; // 返回 null，触发友好引导
  }
}
```

---

## Node.js Requirements

```json
// package.json
{
  "engines": {
    "node": ">=18.0.0"
  },
  "enginesStrict": true
}
```

原因：Node 18+ 原生支持 fetch、AbortController、Buffer blob 等 API。

---

## Testing Strategy

| 层级 | 内容 |
|------|------|
| 单元测试 | 各适配器解析、路由匹配、Markdown 转换 |
| 集成测试 | 完整文件 → MD 输出，snapshot 对比 |
| 格式矩阵 | 50+ 真实样本文件 |
| 边界测试 | 空文件、损坏文件、超大文件、多语言混合 |

---

## Documentation Plan

```
docs/
├── README.md                    # 5 分钟快速开始
├── getting-started.md           # 安装 + 基础用法
├── configuration.md             # 配置详解
├── supported-formats.md         # 支持的格式
├── local-models.md              # 本地模型安装
├── custom-provider.md           # 自定义服务接入
├── api-reference.md             # API 文档
└── troubleshooting.md          # 常见问题
```

---

## Distribution

| 包名 | 说明 |
|------|------|
| `switch-to-md` | 主包，包含 core + adapters |
| `@switch-to-md/vision-local` | 本地视觉插件 |
| `@switch-to-md/vision-openai` | OpenAI Vision 插件 |
| `@switch-to-md/vision-anthropic` | Claude Vision 插件 |
| `@switch-to-md/audio-local` | 本地音频插件 |
| `@switch-to-md/audio-openai` | OpenAI Whisper 插件 |

---

## Publishing Workflow

### 发布到 npm

```bash
# 1. 登录
npm login

# 2. 构建
pnpm build

# 3. 测试
pnpm test

# 4. 发布主包
npm publish --access public

# 5. 发布插件包
cd packages/plugins/vision-local
npm publish --access public
```

### 发布到 GitHub

```bash
# 1. 推送代码
git push origin main

# 2. 创建 tag
git tag v1.0.0
git push origin v1.0.0

# 3. 创建 Release（可选）
gh release create v1.0.0 --title "v1.0.0" --notes "首次发布"
```

### 用户安装流程

```
用户 npm i switch-to-md
       ↓
npm 从 npm registry 下载
       ↓
安装到 node_modules/
       ↓
用户 import { convert } from 'switch-to-md'
```

**GitHub 不直接提供包下载**，仅用于：
- 源码展示
- Issue 追踪
- 文档托管
- Star / Fork

---

## Dependencies

### Core（零模型依赖）

| 依赖 | 用途 | 大小 |
|------|------|------|
| `pdf-parse` | PDF 文本提取 | ~100KB |
| `mammoth` | Word → MD | ~150KB |
| `xlsx` | Excel 解析 | ~200KB |
| `adm-zip` | PPTX/EPUB 解压 | ~50KB |
| `linkedom` | HTML/SVG DOM | ~100KB |
| `commander` | CLI 参数 | ~20KB |

**核心总大小：~500KB**

### Plugins（可选）

| 插件 | 依赖 |
|------|------|
| `@switch-to-md/vision-local` | Tesseract.js |
| `@switch-to-md/audio-local` | whisper.cpp（CLI） |

---

## CLI Commands

```bash
# 转换单文件
npx switch-to-md convert report.pdf

# 批量转换
npx switch-to-md convert ./docs/**/*.pdf -o ./output/

# 设置向导
npx switch-to-md setup

# 查看支持的格式
npx switch-to-md formats
```

---

## Summary

**switch_to_md** 是一个：

1. **简单**：一行代码 `convert('file.pdf')`
2. **轻量**：核心 ~500KB，插件按需安装
3. **灵活**：环境变量 / 配置文件 / 代码配置
4. **可扩展**：支持自定义模型端点
5. **友好**：首次使用有清晰引导
6. **可靠**：完善错误类型和文档

目标是让任何程序员都能**零门槛**将任意文件转为 Markdown，供 Agent 或其他工具使用。
