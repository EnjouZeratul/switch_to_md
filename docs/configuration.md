# Configuration

## 配置优先级

```
代码 configure() > switch-to-md.config.ts > 环境变量 > 默认
```

## 环境变量

```bash
# 全局配置
SWITCH_TO_MD_PROVIDER=openai
SWITCH_TO_MD_API_KEY=sk-xxx
SWITCH_TO_MD_LANG=zh,en
SWITCH_TO_MD_TIMEOUT=30000

# 视觉模块
SWITCH_TO_MD_VISION_PROVIDER=openai
SWITCH_TO_MD_VISION_API_KEY=sk-xxx
SWITCH_TO_MD_VISION_MODEL=gpt-4o
SWITCH_TO_MD_VISION_BASE_URL=https://api.openai.com/v1

# 音频模块
SWITCH_TO_MD_AUDIO_PROVIDER=openai
SWITCH_TO_MD_AUDIO_API_KEY=sk-xxx
SWITCH_TO_MD_AUDIO_MODEL=whisper-1
```

## 配置文件

```typescript
// switch-to-md.config.ts
import { defineConfig } from 'switch-to-md';

export default defineConfig({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,

  vision: {
    provider: 'openai',
    model: 'gpt-4o',
  },

  audio: {
    provider: 'local',
    model: 'whisper',
  },
});
```

## 代码配置

```typescript
import { configure } from 'switch-to-md';

// 简单配置
configure({ apiKey: 'sk-xxx' });

// 完整配置
configure({
  provider: 'openai',
  apiKey: 'sk-xxx',

  vision: {
    provider: 'openai',
    apiKey: 'sk-xxx',
    model: 'gpt-4o',
  },

  audio: {
    provider: 'openai',
    apiKey: 'sk-xxx',
  },
});
```

## 本地模型配置

```typescript
configure({
  vision: {
    provider: 'local',
    model: 'tesseract',
    lang: ['zh', 'en'],
  },
});
```

## 自定义端点

```typescript
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
```

### 自定义端点协议

**视觉分析接口**：

```typescript
// POST ${baseUrl}/analyze
{
  "image": "<base64>",
  "options": { "lang": ["zh", "en"] }
}

// 响应
{
  "text": "识别的文字",
  "description": "图片描述"
}
```

**音频转写接口**：

```typescript
// POST ${baseUrl}/transcribe
{
  "audio": "<base64>",
  "options": { "lang": "zh" }
}

// 响应
{
  "text": "转写文本"
}
```