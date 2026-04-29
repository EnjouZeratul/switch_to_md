# Troubleshooting

## 图片处理报错：Vision backend not configured

**原因**：未配置视觉后端。

**解决**：
1. 使用云端 API：
   ```bash
   SWITCH_TO_MD_API_KEY=sk-xxx
   ```

2. 安装本地插件：
   ```bash
   npm i @switch-to-md/vision-local
   ```

---

## PDF 内容为空或很少

**原因**：PDF 是扫描件或图片 PDF。

**解决**：使用视觉插件处理。

```typescript
configure({ provider: 'openai', apiKey: 'sk-xxx' });
const md = await convert('scanned.pdf');
```

---

## 音频处理报错：Audio backend not configured

**原因**：未配置音频后端。

**解决**：
```bash
npm i @switch-to-md/audio-openai
```

---

## whisper.cpp 找不到

**原因**：本地音频插件依赖 whisper.cpp，但未安装。

**解决**：
```bash
# 安装 whisper.cpp
brew install whisper-cpp  # macOS
```

或使用云端 API：
```typescript
configure({
  audio: { provider: 'openai', apiKey: 'sk-xxx' }
});
```

---

## 文件格式不支持

**原因**：尝试转换不支持的格式。

**解决**：查看支持的格式列表：
```bash
npx switch-to-md formats
```

---

## API Key 无效

**原因**：API Key 错误或过期。

**解决**：检查环境变量或配置中的 API Key。

---

## 性能问题：处理很慢

**原因**：
1. 文件过大
2. 使用云端 API 网络延迟
3. 本地模型计算量大

**解决**：
- 大文件使用进度回调：
  ```typescript
  await convert('large.pdf', {
    onProgress: p => console.log(`${p.percent}%`)
  });
  ```
- 图片/音频使用云端更快
- 本地模型选择较小的模型

---

## 内存占用过高

**原因**：大文件一次性加载。

**解决**：目前不支持流式处理大文件，建议：
- 分割大文件
- 使用云端 API（更稳定）