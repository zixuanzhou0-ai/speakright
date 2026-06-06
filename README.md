# SpeakRight Desktop

## 一键启动

```bat
cd /d E:\SpeakRight
npm run codex:start
```

该命令会同时启动网页端和桌面端，并把日志写入 `E:\SpeakRight\.runlogs\`。

Tauri 桌面端独立入口。

## 启动

```bat
cd /d E:\SpeakRight\apps\desktop
npm run dev
```

Tauri 会通过 `src-tauri/tauri.conf.json` 自动在 http://localhost:1420 启动前端开发服务。

注意：桌面端使用 3002 端口；网页端使用 3000 端口，两者不要混用。不要再使用 1420；当前 Windows 环境保留了 1321-1520 端口段，1420 会导致 `EACCES: permission denied`。
