# SpeakRight Desktop

SpeakRight Desktop 是面向中文学习者的多语言发音训练桌面端。当前英语
`en-US` 是稳定基线，西班牙语 `es-ES`、法语 `fr-FR`、俄语 `ru-RU`
是实验板块；日语本轮不做。

## 一键启动

```bat
cd /d E:\SpeakRight
npm run codex:start
```

该命令会同时启动网页端和桌面端，并把日志写入 `E:\SpeakRight\.runlogs\`。

Tauri 桌面端独立入口如下。

## 启动

```bat
cd /d E:\SpeakRight\apps\desktop
npm run dev
```

Tauri 会通过 `src-tauri/tauri.conf.json` 启动桌面壳，并把前端开发服务放在
http://localhost:3002。

注意：桌面端使用 3002 端口；网页端使用 3000 端口，两者不要混用。不要再使用 1420；当前 Windows 环境保留了 1321-1520 端口段，1420 会导致 `EACCES: permission denied`。

## 当前桌面端 API 与资源边界

- 录音评分：Azure Speech，密钥保存在桌面端 secure store/系统凭据。
- 标准示范 TTS：ElevenLabs 或当前语言的本地发音包。
- 单词词典发音：有道/韦氏只负责单词复读，不负责句子示范。
- AI 教练：LLM provider 只生成中文反馈，不参与评分。
- 多语言素材：`public/videos/language-assets/` 和
  `public/audio/language-packs/` 包含 es-ES/fr-FR/ru-RU 的本地素材。
