# Local Models

## 视觉插件：@switch-to-md/vision-local

基于 Tesseract.js 的本地 OCR。

### 安装

```bash
npm i @switch-to-md/vision-local
```

### 使用

安装后自动启用，无需额外配置。

```typescript
import { convert } from 'switch-to-md';

const md = await convert('image.png');  // 自动使用本地 OCR
```

### 语言支持

默认支持英语。如需中文：

```typescript
import { configure } from 'switch-to-md';

configure({
  vision: {
    provider: 'local',
    lang: ['chi_sim', 'eng'],  // 中文简体 + 英语
  },
});
```

### Tesseract 语言代码

| 语言 | 代码 |
|------|------|
| 中文简体 | `chi_sim` |
| 中文繁体 | `chi_tra` |
| 英语 | `eng` |
| 日语 | `jpn` |
| 韩语 | `kor` |

---

## 音频插件：@switch-to-md/audio-local

基于 Whisper.cpp 的本地语音转写。

### 前置要求

需要安装 whisper.cpp：

```bash
# macOS
brew install whisper-cpp

# Linux
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp && make

# Windows
# 下载预编译版本：https://github.com/ggerganov/whisper.cpp/releases
```

### 安装

```bash
npm i @switch-to-md/audio-local
```

### 使用

```typescript
import { convert } from 'switch-to-md';

const md = await convert('audio.mp3');
```

### 模型选择

```typescript
configure({
  audio: {
    provider: 'local',
    model: 'small',  // base, small, medium, large
  },
});
```

模型大小对比：

| 模型 | 大小 | 速度 | 精度 |
|------|------|------|------|
| base | ~75MB | 快 | 一般 |
| small | ~250MB | 中 | 较好 |
| medium | ~500MB | 慢 | 好 |
| large | ~1.5GB | 很慢 | 最好 |