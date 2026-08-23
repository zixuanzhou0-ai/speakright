# 四语发音资产审计运行手册

## 范围与原则

本审计覆盖桌面端的 6,242 条主音频，并用 SHA-256 验证网页端副本。审计结果不写入学习进度，也不能仅凭 Whisper 或 Azure 的一次分数宣称“百分之百准确”。每条资产最终必须落在以下状态之一：

- `verified`
- `verified-variant`
- `needs-review`
- `needs-native-review`
- `confirmed-error`
- `regenerated-candidate`
- `replaced-and-verified`

机器结论只用于风险筛查。判错至少需要两个独立自动信号一致并经人工确认，或人工直接确认错误词、错误音位、错误重音、截断或失真。

## 安全边界

- Whisper 模型固定在 `D:\AI\models\whisper\faster-whisper-large-v3`。
- Hugging Face、Torch 和 XDG 缓存固定在 `D:\AI\cache`。
- 脚本发现模型或缓存路径解析到 C 盘时立即失败。
- 英语参考词典固定使用 `D:\AI\lexicons\cmudict`，记录仓库 revision 与词典 SHA-256；CMUdict 只提供独立风险信号，不自动改写项目 IPA。
- Azure 与 ElevenLabs 凭据只从 Windows Credential Manager 读取。
- 聊天、`.env`、命令行参数、报告和 Git 中不得出现密钥。
- Azure 与任何 TTS 付费调用必须先运行 dry-run，再使用显式确认参数。
- 所有原始响应、WAV 缓存、审听决定和候选音频都位于被 Git 忽略的 `outputs/pronunciation-audit-2026-07-14/`。

## 推荐运行顺序

```powershell
npm.cmd run whisper:model:check
npm.cmd run audio:pronunciation:inventory
npm.cmd run audio:pronunciation:test
npm.cmd run audio:pronunciation:reference
npm.cmd run audio:pronunciation:offline -- --signal-only
npm.cmd run audio:pronunciation:offline
npm.cmd run audio:pronunciation:offline:gate
npm.cmd run audio:pronunciation:azure:plan
npm.cmd run audio:pronunciation:review
npm.cmd run audio:pronunciation:report
```

模型缺失时，用户确认下载后运行：

```powershell
npm.cmd run whisper:model:download -- --confirm
```

Azure 调用只在轮换后的新密钥已保存到桌面端系统凭据库、dry-run 已复核并获得单独费用确认后运行：

```powershell
npm.cmd run audio:pronunciation:azure:run -- --mode=smoke --confirm --rotated-key-confirmed
npm.cmd run audio:pronunciation:azure:run -- --mode=full --confirm --rotated-key-confirmed
```

全量模式要求先有通过的付费 smoke。脚本默认并发 2，按 SHA 缓存并可断点续跑。

## 重制供应商策略

正式资产从不因一次低分自动覆盖。只有人工标记为 `confirmed-error` 的项目可以进入候选重制。

- ElevenLabs 是四语现有声线的首选候选提供方。
- 当 ElevenLabs 可用字符低于“预计消耗 + 安全保留量”时，英语 `en-US` 可以切到本地 Vortex AI 的 Gemini 3.1 TTS。
- Vortex/Gemini 不会静默启用；必须先验证本机可调用接口、模型标识、许可、输出格式和美音声线。
- 当前未授权 Vortex 生成西班牙语、法语或俄语替换资产。
- 不同供应商生成的候选必须经过相同的信号、Whisper、Azure 和人工审听门禁，不能仅凭提供商名称直接发布。

生成 dry-run：

```powershell
npm.cmd run audio:pronunciation:regenerate:plan -- --elevenlabs-remaining=<characters>
```

本地 Vortex 适配器完成验证后，计划命令才可附加 `--vortex-configured`。没有审听决定文件、显式费用确认和候选复核时，正式重制命令保持锁定。

## 审听

`audio:pronunciation:review` 会生成本地 HTML 面板和优先 M3U8 播放列表。必须：

1. 100% 审听所有音标锚点和 header clips；
2. 100% 审听异常项、冲突项和重制候选；
3. 对自动通过项按语言、声线、角色和分数层至少抽样 10%；
4. 任一层错误率超过 1% 时扩展为该层 100%；
5. 西、法、俄争议读法没有母语审校时保持 `needs-native-review`。

## 发布门禁

```powershell
npm.cmd run audio:pronunciation:gate
```

最终门禁要求 6,242 条都有正式决定，且只允许 `verified`、`verified-variant` 或 `replaced-and-verified`。任何 `confirmed-error`、`needs-review` 或 `needs-native-review` 都会阻止发布。