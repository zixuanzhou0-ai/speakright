# Speak Right 网页端 Browser Edition

这是 Speak Right 的跨平台网页端版本。它不是 Windows 桌面安装包，而是通过本机浏览器打开的版本，适合 Windows、macOS、Linux 用户使用。

## 第一次打开这个文件夹，先看这里

最推荐的入口顺序：

1. 先打开 `00_先看我_网页端入口.md`。
2. Windows 用户双击 `01_双击启动网页端.bat`。
3. 浏览器会打开 `http://127.0.0.1:4173/` 或启动窗口里显示的实际地址。
4. 如果浏览器没有自动打开，再双击 `02_打开网页端.url`，或手动复制启动窗口里的地址到 Chrome。

请不要直接双击 `out/index.html`。麦克风、录音、API 请求需要通过本机网页服务运行，直接用 `file://` 打开会导致权限和功能异常。

## 这个文件夹里哪些东西重要

| 名称 | 给普通用户看的解释 |
| --- | --- |
| `00_先看我_网页端入口.md` | 第一次使用的中文入口说明。 |
| `01_双击启动网页端.bat` | Windows 一键启动网页端。 |
| `02_打开网页端.url` | 服务启动后，用它打开网页；启动脚本会自动更新端口。 |
| `out/` | 已构建好的网页文件，不建议直接点里面的 HTML。 |
| `public/` | 本地图片、音频、视频资源。 |
| `src/` | 开发者源码，普通用户不用打开。 |
| `scripts/` | 启动和测试脚本，普通用户不用打开。 |
| `package.json` | 项目配置，普通用户不用修改。 |

## Windows 快速启动

双击：

```text
01_双击启动网页端.bat
```

启动成功后会看到类似地址：

```text
http://127.0.0.1:4173/
```

保持启动窗口不要关闭。关闭窗口后，网页端服务也会停止。

如果提示没有 Node.js，请先安装 Node.js LTS，然后重新双击启动脚本。只要 `out/` 已经存在，普通用户不需要手动运行 `npm install`。

## macOS / Linux 启动

如果文件夹里已经有 `out/`，进入本文件夹后运行：

```bash
node scripts/serve-static.mjs
```

如果没有 `out/`，再运行开发者构建流程：

```bash
npm install
npm run build
node scripts/serve-static.mjs
```

然后打开终端显示的本地地址。

## 第一次进入网页后做什么

1. 打开“设置”。
2. 填写 Azure Speech，用于真实发音评分。
3. 在“标准示范 TTS”里选择 ElevenLabs、爱马仕 Grok 或 Vertex AI · Gemini 3.1 Flash TTS。后两者直接复用本机已有授权，无需把密钥再填进 SpeakRight。
4. 填写 LLM，用于中文 AI 教练反馈。
5. 允许浏览器使用麦克风。
6. 在自由练习页选择正确麦克风，然后录一句话测试。

## 主要页面

| 页面 | 地址 | 用途 |
| --- | --- | --- |
| 首页 | `/` | 进入项目主界面。 |
| 设置 | `/settings` | 配置 Azure、ElevenLabs、LLM、麦克风权限。 |
| 音标练习 | `/phonemes` | 学音标、看示范、录音评分。 |
| 自由练习 | `/sentences` | 输入自己的句子并评分。 |
| 刻意练习 | `/drill` | 单词、句子、对比、辨音训练。 |
| 发音诊断 | `/assessment` | 做完整发音评估。 |

## 评分和隐私边界

- 分数来自 Azure Speech Pronunciation Assessment。
- LLM 只根据 Azure 结果生成中文教练反馈，不负责编造分数。
- API Key 由用户自己填写，默认保存在本机浏览器里。
- 选择“爱马仕 Grok”时，本机启动器会同时启动带会话校验的回环桥接；练习文本经爱马仕发送给 xAI，Grok 凭据仍由爱马仕管理。设置页的“试听短句”会产生 Grok TTS 用量。
- 选择“Vertex AI · Gemini 3.1”时，同一本机桥接会使用 gcloud 当前项目和 ADC 临时授权；项目名、账号和访问令牌不会返回网页。状态检测不会生成语音，设置页的“试听短句”和实际朗读会产生 Vertex AI 用量。
- 爱马仕与 Vertex 选项只适用于通过本项目本机启动器运行的 Browser Edition；远程托管网页不会自动获得这些本机能力。
- 不要把自己的 API Key 上传到 GitHub、截图或公开文档里。

## 开发者命令

```bash
npm run dev
npm run build
npm run serve:static
npm run validate:browser
```

更多项目说明见仓库根目录 README 和 `docs/browser-edition/`。

## 版权、许可与免责声明

版权所有 © 2026 Zixuan Zhou 与 Speak Right 开源贡献者。

Speak Right 是开源软件。除非文件中另有说明，源代码和源码文档基于 MIT License 发布，具体条款以 `LICENSE` 文件为准。第三方服务、素材、品牌与商标归其各自权利人所有，完整边界见 `NOTICE.md` 和 `THIRD_PARTY_NOTICES.md`。

Speak Right 不是官方语言考试、医疗诊断、语音治疗或认证评分工具。数字发音分数来自用户自行配置的 Azure Speech Pronunciation Assessment；AI 教练反馈仅供学习参考。

用户需要自行管理 API Key。请勿将个人 API Key、账号信息、录音或私人数据提交到公开仓库、Issue、截图或文档中。

GitHub 开源页面：https://github.com/zixuanzhou0-ai/speakright
