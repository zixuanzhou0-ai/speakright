# SpeakRight 部署与运维指南

> 面向中国市场的美式英语发音矫正 Web App — 完整部署手册

---

## 目录

- [1. 系统要求](#1-系统要求)
- [2. 构建与运行](#2-构建与运行)
- [3. 运行时说明](#3-运行时说明)
- [4. 环境变量](#4-环境变量)
- [5. 静态资源](#5-静态资源)
- [6. 部署方案](#6-部署方案)
  - [6.1 Vercel（推荐）](#61-vercel推荐)
  - [6.2 自托管（Node.js + PM2）](#62-自托管nodejs--pm2)
  - [6.3 Docker 容器化](#63-docker-容器化)
- [7. 反向代理配置（Nginx）](#7-反向代理配置nginx)
- [8. 安全注意事项](#8-安全注意事项)
- [9. 性能优化](#9-性能优化)
- [10. 监控与日志](#10-监控与日志)
- [11. 备份与恢复](#11-备份与恢复)
- [12. 常见问题排查](#12-常见问题排查)

---

## 1. 系统要求

| 依赖 | 最低版本 | 说明 |
|------|---------|------|
| Node.js | 20+ (LTS) | Azure Speech SDK 需要 Node.js 运行时 |
| npm | 10+ | 使用 `npm ci` 保证可复现构建 |
| Git | 最新稳定版 | 代码版本管理 |

---

## 2. 构建与运行

```bash
# 安装依赖
npm install

# 生产构建（输出到 .next/ 目录）
npm run build

# 启动生产服务器（默认端口 3000）
npm run start

# 开发服务器（Turbopack HMR）
npm run dev
```

其他可用命令：

```bash
npm run lint              # Biome 代码检查
npm run lint:fix          # Biome 自动修复
npm run generate:audio    # 批量生成 ElevenLabs 单词音频（需要 API Key）
```

### next.config.ts 配置

当前仅启用了 React Compiler，无环境变量、无 rewrites、无 redirects：

```typescript
import type { NextConfig } from "next";
const nextConfig: NextConfig = { reactCompiler: true };
export default nextConfig;
```

---

## 3. 运行时说明

Next.js 支持 Node.js 和 Edge 两种运行时。本项目各 API 路由的运行时要求如下：

| 路由 | 运行时 | 原因 |
|------|--------|------|
| `/api/azure/*` | **Node.js**（必须） | Azure Speech SDK 依赖 Node.js 原生模块 |
| `/api/pronunciation` | Edge | 轻量代理，兼容 Edge |
| `/api/merriam-webster/*` | Edge | 轻量代理，兼容 Edge |
| `/api/merriam-webster/stress` | Edge | 音节重音查询 |
| `/api/elevenlabs/*` | Node.js（默认） | 默认运行时 |
| `/api/llm/*` | Node.js（默认） | SSE 流式响应 |

各路由文件中通过以下代码声明运行时：

```typescript
// Node.js 运行时（Azure 路由必须）
export const runtime = "nodejs";

// Edge 运行时
export const runtime = "edge";
```

> **重要**：Azure 路由如果运行在 Edge 环境会崩溃，务必确认其运行时为 `nodejs`。

---

## 4. 环境变量

### Phase 1（当前）

**无需任何服务端环境变量。** 所有 API Key 由用户在设置页配置，存储在客户端 localStorage 中，通过 HTTP 自定义 headers 传递给 API 路由。

### Phase 2（计划中，Supabase 集成后）

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
ENCRYPTION_KEY=your_encryption_key_for_api_keys
```

---

## 5. 静态资源

以下静态资源必须包含在部署中，总计约 700+ 文件：

```
public/
├── audio/
│   ├── ipa/              ~120 个文件（来源：americanipachart.com）
│   │   ├── phoneme/      40 个 IPA 音素发音
│   │   ├── normal/       40 个正常语速单词音频
│   │   └── slow/         40 个慢速单词音频
│   └── words/            ~536 个文件（268 单词 × 2 个声音）
│       ├── blue/         Max 声音 (Gfpl8Yo74Is0W6cPUWWT)
│       └── pink/         Nichalia 声音 (XfNU2rGpBa01ckF309OY)
├── images/
│   └── ipa/              40 张 Microsoft Fluent Emoji 3D PNG
└── videos/
    └── phonemes/         （预留，暂未填充）
```

> **注意**：确保 `public/audio/` 目录完整包含在部署产物中，不要被 `.gitignore` 排除。

---

## 6. 部署方案

### 6.1 Vercel（推荐）

Vercel 对 Next.js 项目零配置支持，同时支持 Node.js 和 Edge 运行时。

**部署步骤：**

1. 将代码推送到 GitHub 仓库
2. 在 [Vercel Dashboard](https://vercel.com/dashboard) 导入项目
3. Vercel 自动检测为 Next.js 项目并完成部署

**注意事项：**

- Phase 1 无需配置任何环境变量
- Vercel 自动处理 Node.js 与 Edge 运行时分发
- 静态资源（`public/` 目录）自动部署到 CDN

---

### 6.2 自托管（Node.js + PM2）

适用于自有服务器或云主机部署。

#### 使用 PM2 管理进程

```bash
# 构建
npm run build

# 使用 PM2 启动
pm2 start npm --name "speakright" -- start

# 保存进程列表并设置开机自启
pm2 save
pm2 startup
```

#### 使用 systemd 管理服务

创建 systemd 服务文件 `/etc/systemd/system/speakright.service`：

```ini
[Unit]
Description=SpeakRight Next.js App
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/speakright
ExecStart=/usr/bin/npm start
Restart=on-failure
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

启用并启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable speakright
sudo systemctl start speakright

# 查看状态
sudo systemctl status speakright

# 查看日志
sudo journalctl -u speakright -f
```

---

### 6.3 Docker 容器化

#### Dockerfile

```dockerfile
FROM node:20-alpine AS base

# 安装依赖阶段
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production=false

# 构建阶段
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 运行阶段
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

> **重要**：使用 Docker standalone 模式需要在 `next.config.ts` 中添加 `output: "standalone"` 配置：
>
> ```typescript
> const nextConfig: NextConfig = {
>   reactCompiler: true,
>   output: "standalone",
> };
> ```

#### 构建与运行

```bash
# 构建镜像
docker build -t speakright .

# 运行容器
docker run -d -p 3000:3000 --name speakright speakright

# 查看日志
docker logs -f speakright
```

#### Docker Compose（可选）

```yaml
version: "3.8"
services:
  speakright:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
```

---

## 7. 反向代理配置（Nginx）

生产环境建议在 Next.js 前面放置 Nginx 做反向代理，提供 HTTPS 终端和静态资源缓存。

```nginx
# HTTP → HTTPS 重定向
server {
    listen 80;
    server_name speakright.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name speakright.example.com;

    ssl_certificate /etc/ssl/certs/speakright.crt;
    ssl_certificate_key /etc/ssl/private/speakright.key;

    # 通用代理
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # SSE 支持（LLM 流式反馈）
    location /api/llm/feedback {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding off;
    }
}
```

**关键配置说明：**

- `/api/llm/feedback` 路由使用 SSE（Server-Sent Events）流式传输 LLM 反馈，必须关闭 `proxy_buffering` 和 `proxy_cache`，否则客户端无法实时接收流式数据
- WebSocket `Upgrade` 头支持用于 Next.js 开发模式 HMR（生产环境不需要，但保留不影响）

> **HTTPS 必需**：麦克风录音使用 MediaRecorder API，该 API 在生产环境中**要求 HTTPS**（localhost 开发模式除外）。务必部署 SSL 证书。

---

## 8. 安全注意事项

### API Key 存储

Phase 1 将所有 API Key 存储在客户端 localStorage 中。Key 不会被服务端记录或持久化。这是个人学习工具的便捷性与安全性之间的折中方案。

### API 代理模式

所有外部 API 调用通过 `/api/*` 路由代理：

1. 客户端通过自定义 HTTP headers 传递 Key（如 `x-azure-key`、`x-llm-key`）
2. 服务端路由转发请求到外部 API
3. Key 不会出现在客户端 JavaScript 或对外部服务的网络请求中

### 输入校验

| 校验项 | 限制 |
|--------|------|
| ElevenLabs Voice ID | 白名单（7 个允许的 ID） |
| TTS/评测文本 | 最长 500 字符 |
| 单词查询 | 最长 50 字符 |
| UI 输入框 | 最长 150 字符 |
| 单词格式 | 去除空格、裁剪、转小写 |

### 速率限制

- **速率限制**：所有 API 路由使用 `src/lib/rate-limit.ts` 实现内存 IP 级速率限制（60 次/分钟/IP），超过返回 429 + `Retry-After` header。Edge 和 Node.js runtime 均兼容。

### CORS

所有 API 路由都是 Next.js 同源路由，无需配置 CORS。

---

## 9. 性能优化

| 优化项 | 说明 |
|--------|------|
| **React Compiler** | 生产构建自动 memoization，减少不必要的重渲染 |
| **Turbopack** | 仅开发模式，比 Webpack 更快的 HMR |
| **TTS 缓存** | IndexedDB 缓存（最多 50 条，LRU 淘汰），避免重复调用 ElevenLabs API |
| **静态音频** | 预生成 536 个单词音频文件，常见单词无需 API 调用 |
| **SSE 流式传输** | LLM 反馈使用 Server-Sent Events 实现渐进式渲染 |

---

## 10. 监控与日志

Phase 1 无专用监控系统。内置机制如下：

### 服务端日志

- Next.js 服务器日志输出到 stdout/stderr
- 所有 API 路由使用 try-catch，返回结构化 JSON 错误响应
- PM2 或 systemd 可收集和管理日志

### 客户端用量追踪

用量数据存储在 localStorage `speakright_usage` 中：

| 服务 | 追踪指标 |
|------|---------|
| **Azure Speech** | 使用秒数 + 请求次数（按月） |
| **LLM** | prompt/completion token 数 + 估算费用 |
| **ElevenLabs** | 字符用量/上限（通过 API 查询） |

---

## 11. 备份与恢复

Phase 1 所有数据存储在浏览器本地。可通过浏览器 DevTools 手动导出。

### 配置数据（建议备份）

| localStorage Key | 内容 |
|-----------------|------|
| `speakright_azure_config` | Azure Speech 服务配置 |
| `speakright_elevenlabs_config` | ElevenLabs TTS 配置 |
| `speakright_llm_config` | LLM 提供商配置 |
| `speakright_mw_config` | 韦氏词典 API 配置 |
| `speakright_pronunciation_config` | 发音音源偏好（有道/韦氏） |

### 练习数据（可选备份）

| localStorage Key | 内容 |
|-----------------|------|
| `speakright_usage` | API 用量统计 |
| `speakright_score_history` | 评分历史记录 |
| `speakright_practice_history` | 练习记录（用于加权选词） |
| `speakright_stress_cache` | 音节重音缓存（word → StressLevel[]） |
| `speakright_ipa_cache` | IPA 音标缓存（word → IPA string） |

### sessionStorage 数据

| Key 模式 | 内容 |
|----------|------|
| `sentences:*` | 句子练习页状态保持 |
| `phonemes:*:*` | 音标详情页状态保持 |

> sessionStorage 数据在标签页关闭时自动清除，无需备份。

### IndexedDB 数据

| 数据库 | 内容 | 备份建议 |
|--------|------|---------|
| `speakright_tts_cache` | TTS 音频 blob 缓存 | 通常不需要备份，可随时重新生成 |

---

## 12. 常见问题排查

### Azure SDK 在 Edge 运行时崩溃

**症状**：`/api/azure/*` 路由返回 500 错误

**原因**：Azure Speech SDK 依赖 Node.js 原生模块，无法在 Edge 运行时执行

**解决**：确认路由文件中声明了 `export const runtime = "nodejs"`

---

### 构建失败：依赖缺失

**症状**：`npm run build` 报模块找不到错误

**解决**：使用 `npm ci`（而非 `npm install`）保证可复现构建

```bash
rm -rf node_modules
npm ci
npm run build
```

---

### 静态音频文件缺失

**症状**：单词发音无法播放，浏览器控制台显示 404

**原因**：`public/audio/` 目录未完整包含在部署中

**解决**：确认 `.gitignore` 未排除 `public/audio/`，且部署流程包含整个 `public/` 目录

---

### 端口冲突

**症状**：`Error: listen EADDRINUSE :::3000`

**解决**：更换端口

```bash
PORT=3001 npm start
```

---

### 内存不足

**症状**：Azure Speech SDK 请求时进程被 OOM Killer 终止

**原因**：Azure Speech SDK 内存占用较高

**解决**：确保每个实例至少分配 **512MB RAM**。Docker 部署时设置内存限制：

```bash
docker run -d -p 3000:3000 --memory=1g --name speakright speakright
```

---

### 麦克风无法使用

**症状**：录音按钮无响应或浏览器提示权限错误

**原因**：MediaRecorder API 在生产环境要求 HTTPS

**解决**：部署时配置 HTTPS 反向代理（参见[第 7 节](#7-反向代理配置nginx)）。localhost 开发模式不受此限制。
