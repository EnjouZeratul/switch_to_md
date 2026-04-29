# Getting Started

## 安装

```bash
npm i switch-to-md
```

## 基础使用

```typescript
import { convert } from 'switch-to-md';

// PDF
const md = await convert('report.pdf');

// Word
const md = await convert('document.docx');

// Excel
const md = await convert('data.xlsx');

// 代码
const md = await convert('config.json');
```

## 输出到文件

```typescript
await convert('report.pdf', { output: 'report.md' });
```

## 批量转换

```typescript
const results = await convert(['a.pdf', 'b.docx', 'c.xlsx']);

console.log(results.files);    // { 'a.pdf': '...', 'b.docx': '...' }
console.log(results.errors);   // 失败的文件
console.log(results.summary);  // { total: 3, success: 2, failed: 1 }
```

## 图片处理

图片处理需要配置视觉后端：

```typescript
import { configure } from 'switch-to-md';

// 使用 OpenAI Vision
configure({
  provider: 'openai',
  apiKey: 'sk-xxx',
});

// 或安装本地插件
// npm i @switch-to-md/vision-local

const md = await convert('chart.png');
```

## 音频转写

音频处理需要配置音频后端：

```typescript
configure({
  audio: {
    provider: 'openai',
    apiKey: 'sk-xxx',
  },
});

const md = await convert('meeting.mp3');
```