# Next Browser Edition Goals

Copy the goal below into the next Codex chat when you want an autonomous long
run. It intentionally points Codex to the detailed Browser Edition plan first,
then gives hard boundaries and acceptance gates.

## Current Handoff Status — 2026-06-23

- Browser Edition code lives under `apps/browser`; local build isolation scans
  show no Tauri imports, desktop secure-store dependency, or desktop port
  dependency in Browser Edition source.
- Latest local gate passed from `<repository-root>`:
  `npm run validate:browser`.
  This covered Browser Edition lint, typecheck, 113 Vitest files / 639 tests,
  Next production static build with 197 routes, and static smoke for 9 routes
  plus 2 media assets.
- `npm run docs:check-links` passed for public README/docs relative links and
  screenshot paths.
- Root `npm run lint` passes without diagnostics after `biome.json` was tightened to exclude local generated output directories, nested Browser app config parsed by the app-local Biome version, and generated IPA audit input JSON files.
- `npm run browser:azure-live-log` and
  `npm --prefix apps/browser run azure:live-log` both create/verify the ignored
  root `.runlogs/browser-azure-live-check.md` template for sanitized live Azure
  evidence. The helper rejects obvious key-shaped input before writing.
- Text secret scan over Browser Edition source/scripts/docs and public entry
  docs found no Azure/OpenAI/ElevenLabs/Gemini-style key literals.
- Browser screenshots are stored in `docs/assets/screenshots/browser/`.
- Browser Edition PR #1 has been merged to GitHub `main`
  (`8669834c Merge pull request #1 from
  zixuanzhou0-ai/codex/browser-edition-release-pr`). The follow-up scoring
  validation commit `3e900c3 Validate browser Azure scoring release gate` was
  also pushed to GitHub `main`; remote `refs/heads/main`
  was verified immediately after that push.
- Follow-up SDK audit verified the installed Azure Speech browser SDK exposes
  sentence prosody as a boolean setter:
  `pronunciationConfig.enableProsodyAssessment = isSentence(referenceText)`.
  Targeted Azure boundary tests passed after the source/type check.
- `docs/browser-edition/COMPLETION_AUDIT.md` maps each hard requirement to
  current evidence. The live Azure scoring path now covers `en-US` from the
  current Browser Edition page plus `es-ES`, `fr-FR`, and `ru-RU` through
  low-cost ElevenLabs `eleven_flash_v2_5` synthetic audio scored by Azure REST;
  this is provider/locale/scoring evidence, not a replacement for a separate
  human microphone UX pass. The current scoring-validation follow-up is pushed;
  the remaining separate decision is that current public Windows Desktop code
  still lives in repository root / `src` / `src-tauri` rather than a physically
  migrated `apps/desktop` folder.

```text
/goal 继续 SpeakRight Browser Edition 最后一轮收紧：先读取 <repository-root>\docs\browser-edition\README.md、<repository-root>\docs\browser-edition\ARCHITECTURE_AND_SEPARATION.md、<repository-root>\docs\browser-edition\IMPLEMENTATION_PLAN.md、<repository-root>\docs\browser-edition\VALIDATION_AND_RELEASE.md，以及 <repository-root>\docs\operations\NEXT_BROWSER_EDITION_GOALS.md 本文件。当前目标不是继续打磨 Windows 安装包，而是把最新 Windows Desktop 版本的功能同步到一个清晰独立的 Browser Edition，让 Windows、macOS、Linux 用户都能通过浏览器使用开源版 SpeakRight。

第一原则：Windows Desktop 和 Browser Edition 必须完全分开。最终公开仓库必须让用户一眼看懂：Windows Desktop 是桌面安装/Release EXE 路线，Browser Edition 是浏览器运行路线。桌面端只能在自己的文件夹里保留 Tauri、Rust、Windows installer、secure store、Release EXE 门禁等代码；浏览器端必须在自己的文件夹里运行，不能直接 import Tauri，不能依赖桌面端端口、桌面端启动器、桌面端 secure store、桌面端 release scripts，也不能把桌面端专属逻辑藏在一堆模糊 helper 里。优先目标结构是 apps/desktop 对应 Windows Desktop，apps/browser 对应 Browser Edition；旧 apps/web 只能作为临时 scaffold 或 legacy seed。迁移完成时，如果 apps/web 还存在，必须在 README 和 docs 里明确说明它不是生产 Browser Edition；如果已经被 apps/browser 取代，就删除或归档旧入口，并更新所有脚本和链接。

第二原则：功能源以最新版 Windows Desktop 为准。先只读核对 <repository-root> 当前 main 分支、README、docs/INSTALLATION.md、docs/archive/2026-06-desktop-release/RC_EVIDENCE_AUDIT.md、package.json scripts、src/app 路由、src/components、src/hooks、src/lib、public/audio、public/videos、docs/assets/screenshots。不要假设 <repository-root> 旧 web 版本已经包含最新功能。旧 web 只能提供早期 Next/React 结构和部分素材线索。最新功能、UI、语言边界、Azure 评分边界、LLM 反馈规则、错误消息、release 文案和截图标准都以 <repository-root> 为准。读取桌面仓库时只读即可；如果需要写入 <repository-root>，必须先说明原因并确保不破坏当前稳定桌面版。

第三原则：Browser Edition 不是 SaaS。不要引入账号系统、云端数据库、托管评分服务或隐藏后端。第一版目标是开源、本地、浏览器可运行：用户 clone 仓库以后能在本地用 npm 命令跑起来，或者在静态导出后通过 localhost/HTTPS 访问。不要宣传 file:// 直接打开，因为麦克风权限通常需要安全上下文。用户自带 Azure Speech、ElevenLabs、LLM、字典等 provider key。浏览器端设置页必须清楚说明 key 的存储方式：默认 session，仅用户明确选择时才持久化到 localStorage/IndexedDB；绝不把 key 写进文件、URL、截图、日志、GitHub issue、测试 fixture 或 release note。

第四原则：评分必须真实。所有用户可见的数字发音评分必须来自 Azure Speech Pronunciation Assessment，不能由 LLM 编造。LLM 只负责中文教练反馈：它可以解释 Azure 结果、指出练习重点、结合语言规则给建议，但不能覆盖、重写或虚构总分、准确度、流利度、完整度、韵律、单词分、音素分、音节/重音证据。Browser Edition 必须有明确的 scoring boundary 测试：禁用 LLM 时 Azure 评分仍能工作；缺少 Azure key 时不显示假分；smoke/demo 分数只能通过明确 smoke-only flag 渲染，正常用户路径不能出现 fixture 分数。英语使用 en-US，西语使用 es-ES，法语使用 fr-FR，俄语使用 ru-RU。每个语言的评分请求必须携带对应 Azure locale，不能用英语 locale 去评西语、法语、俄语，也不能把非英语语言的规则反馈伪装成已掌握的正式诊断。

第五原则：先做可验证的浏览器 Azure spike。实现之前查询当前官方 Azure Speech browser/Pronunciation Assessment 文档，优先使用项目约定的 Context7 或官方文档来源。确认浏览器端能否直接用 Speech SDK 或官方支持路径完成 Pronunciation Assessment。实现 apps/browser/src/platform/speech-assessment.ts 或等价 adapter，把浏览器录音转成 Azure 可接受格式，并返回和桌面端 UI 兼容的结果结构。至少用真实浏览器录音验证 en-US、es-ES、fr-FR、ru-RU 各一次。若浏览器端 Azure 真实评分技术上受阻，停止并写清楚 blocker，不要用 LLM 或本地启发式替代真实评分。只有在用户明确允许后，才能规划可选 local proxy；这不能成为默认 Browser Edition。

第六原则：同步当前桌面功能，但保持浏览器边界。Browser Edition 至少要覆盖设置页、音标/发音单位列表、音标/发音单位详情、录音、波形/回放、Azure 分数卡、详细拆解、中文 AI 教练、自由练习、英语诊断、英语进阶训练入口和已稳定子路由、进度/历史的本地存储。英语是稳定基线；西班牙语、法语、俄语是实验模块，开放 sound-unit practice、本地 A/B demo、free practice、Azure locale 评分、语言规则反馈，但不能宣称已经具备英语同等的 formal mastery、完整诊断或证据掌握，除非桌面最新 release 已经有对应验证。多语言本地 audio/video 资源要从桌面版资源策略同步，缺少精确短音频时不要显示误导性 speaker button；规则单位、复合发音、重音/弱化/连读类内容要忠实标注为教学/练习指导。

第七原则：架构要干净。创建或整理 apps/browser，不要把 Browser Edition 直接堆在根目录或旧 apps/web 里继续含混。平台代码放在 apps/browser/src/platform，例如 api-keys、speech-assessment、audio-recording、file-runtime。桌面平台代码留在 apps/desktop 或 <repository-root> 自己的 app 内。纯数据、类型、语言 profile、Azure 结果解析、score utilities、无平台依赖的 UI primitive 可以进入 packages/shared，但 packages/shared 不能 import Tauri，不能在模块加载时读取 window/localStorage/process secrets，也不能变成第二个大杂烩。宁可在过渡期少量重复，也不要让 Browser 和 Desktop 相互 import。

第八原则：静态/浏览器构建要真实可用。Browser Edition 不应依赖 Next API Routes 完成核心功能；旧的 /api/maintenance-start-desktop 这类桌面维护接口必须删除、隔离或留在非 Browser app。build:browser 应能产出浏览器生产构建；如果可以，支持 static export 到 apps/browser/out。所有核心路由必须在 localhost 或 HTTPS server 下可打开。自动 smoke 要验证不是桌面端 3002 runtime，不需要 Tauri global，设置页、英语详情、西语/法语/俄语详情、自由练习、诊断/训练入口都能打开，录音按钮可见，guarded smoke score summary 可渲染，缺 key 时中文错误清楚，媒体 URL 能加载。

第九原则：GitHub 文档要给用户一条明路。完成代码后必须更新 README、docs、安装说明、开发说明、release notes 和截图。README 第一屏要告诉用户如何选择：想要 Windows 桌面安装包看 Windows Desktop；想跨平台用浏览器看 Browser Edition。必须写明目录：apps/desktop 是桌面端，apps/browser 是浏览器端，packages/shared 是纯共享层；如果 apps/web 仍存在，必须说明它是 legacy seed，不是推荐入口。必须分别给出 Windows Desktop 命令、Browser Edition dev/build/static serve 命令、验证命令、已知限制、隐私说明、API provider 说明、语言支持表。截图要自己从当前版本截取，桌面截图和浏览器截图分开放在 docs/assets/screenshots/desktop 和 docs/assets/screenshots/browser，不要混在一个表里让人误会。

第十原则：鸣谢和第三方说明要详细但克制。公开文档需要说明 SpeakRight 使用或支持了哪些 API：Azure Speech 用于真实发音评分，ElevenLabs 用于可选 TTS/已批准本地 demo audio，LLM providers 用于中文反馈且不负责评分，Youdao 或其它已配置的在线词典源用于英文词典发音 fallback。还要说明教学视频和发音素材来源边界：Rachel's English、American IPA Chart / americanipachart.com、University of Iowa Sounds of Speech、西语/法语/俄语相关 phonetics references、Seeing Speech / University of Glasgow、EasyPronunciation 等。区分 used as reference、bundled local asset、API provider 三类，不要把参考来源写成自动授权，不要把未授权媒体塞进开源包。若发现资源许可不清，移出公开构建或改为链接/占位，并在 THIRD_PARTY_NOTICES 或 README credits 中写清楚。

第十一原则：清理垃圾文档和过时入口，但必须先查引用。不要一上来删除。先列出 stale docs、旧截图、旧 static export、旧根目录页面、废弃 svg、过时 plan、重复启动脚本、旧 release 文案。用搜索确认没有 README、docs、scripts、tests 引用后再删除或归档。清理时按小 commit 做：结构/脚本、功能迁移、验证、文档、清理分开提交。不要提交 EXE/MSI/NSIS、node_modules、.next、out 临时产物、.runlogs、.codex logs、私钥、录音、真实 API key、用户路径敏感日志。

第十二原则：验收必须完整。至少运行 Browser Edition 的 lint、typecheck、unit tests、build、browser smoke、static smoke（如支持）。真实 Azure live check 至少覆盖 en-US、es-ES、fr-FR、ru-RU 各一次，可以在本地验证日志中记录，不把 key/录音/账号信息公开。若用户明确要求降低手动录音成本，可以用 ElevenLabs `eleven_flash_v2_5` 生成极短 synthetic audio 并交给 Azure Speech 真实评分；必须记录字符预算、模型、locale、分数，并明确说明这是 synthetic-audio provider validation，不冒充人工麦克风 UX。桌面 parity 声明前，再在 <repository-root> 跑 validate:desktop 或读取最新通过证据，确认没有把未验证的桌面功能写进 Browser Edition 文案。最后跑 markdown 链接检查或手动验证新增链接，做 staged diff 审查和 secret scan。最终 git status 只能包含有意变更。

最终完成标准：一个新用户打开 GitHub 后，不需要问作者就能明白 SpeakRight 有两个清楚版本：Windows Desktop 和 Browser Edition；他能选择 Browser Edition，按照 README 进入 apps/browser，安装依赖，启动 localhost，配置自己的 Azure key，录一段英语或西语/法语/俄语练习，看到真实 Azure 分数和基于该分数的中文反馈；他也能选择 Windows Desktop，知道哪里是安装包/Release EXE 路线，知道 unsigned artifact 的限制。代码层面没有桌面/浏览器互相 import 的混乱；文档层面没有旧 web、desktop、root legacy 入口互相打架；发布层面有当前截图、API 说明、语言功能表、第三方鸣谢、已知限制和清晰验证记录。完成后提交并推送到 GitHub main，提交信息要清楚说明 Browser Edition sync、validation、docs/release cleanup 的范围。
```
