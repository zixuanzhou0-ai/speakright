# SpeakRight 416 条高风险音频重制报告（V1）

生成日期：2026-07-15<br>
安全起点：`80f87802fc0ebc1a526472f9a66964f9fb9b5b9f`<br>
报告生成时提交：`f25e63436e8ff2a379cb9c71cd07dd47680c89de`<br>
计划 SHA-256：`0cedfd3041695a8471c039ab32ed6d17c323d162f87f25af20aef39eb9681c3b`

## 结论

- 416 条机器高风险原资产生成了 832 个 A/B 候选，范围与计划完全一致。
- 832 个候选全部完成信号检查、Whisper large-v3、Azure 无参考文本 STT 和 ElevenLabs Scribe v2 盲听。
- 严格机器门禁通过 91 个候选，最终为 64 条不同原资产选择并替换了候选；桌面端与网页端同步替换。
- 352 条没有合格候选或参考仍未解决，正式文件保持原样。第三候选可执行数为 0，没有继续产生付费调用。
- 64 条替换项状态均为 `machine-replaced-pending-human`，尚未获得 `verified-auditory`。机器通过不等于真人确认或“百分百正确”。

## 数量与结果

| 语言 | 原资产 | 机器通过候选 | 机器失败候选 | 正式替换 |
|---|---:|---:|---:|---:|
| en-US | 23 | 6 | 40 | 4 |
| es-ES | 71 | 32 | 110 | 20 |
| fr-FR | 265 | 41 | 489 | 32 |
| ru-RU | 57 | 12 | 102 | 8 |

- 首轮候选：832
- 信号检查失败候选：3
- 机器通过/失败候选：91 / 741
- 正式替换：64
- A/B 选择分布：A 28，B 36
- 未解决原资产：352
- 第三候选：0；被参考答案门禁阻止：352

主要阻止原因：

- `whisper-different-word`：573
- `scribe-different-word`：437
- `azure-different-word`：396
- `azure-no-speech`：253
- `scribe-uncertain`：24
- `azure-uncertain`：14
- `whisper-uncertain`：14
- `english-stress-mismatch`：12
- `relationship-target-missing:es-bv:/b/ -> [β]`：4
- `relationship-target-missing:fr-glide-hui:/ɥ/`：4
- `relationship-target-missing:ru-ts:/ts/`：4
- `signal-failed`：3

## 费用与服务使用

- 生成前套餐计数：734
- 批次后套餐计数：4472
- 套餐计数变化：3738
- TTS 响应返回的字符成本合计：3538
- 差额：200（包含 Scribe 等服务计量；平台响应未在本地逐项拆分该差额）
- 候选实际总时长：854.727 秒（14.245 分钟）
- 剩余额度：295528 / 300000

## 替换与回退

- 64 条旧/新 SHA、双端路径、voice、模型和 seed 的完整映射：
  [phoneme-word-regeneration-v1-sha-map.json](./phoneme-word-regeneration-v1-sha-map.json)
- 每次提升前均校验原文件 SHA；桌面端和网页端使用同一新 SHA。
- 原文件仍可从 Git 历史及安全标签恢复。
- 候选音频、原始模型响应和请求追踪保留在被 Git 忽略的 `outputs/` 中。

## 自动化证据

已通过：

- 候选生成契约测试（10/10）与候选门禁（416 / 832 / 64，0 issue）
- 根项目 lint、类型检查与 876 项单元测试
- 共享核心重复检测、训练音频门禁、强化跟读音频门禁
- 网页端 lint、类型检查、711 项单元测试、198 页生产构建
- 网页端 35 项 Playwright 与静态构建冒烟
- Tauri `cargo check` 与 8 项 Rust 测试
- 桌面前端生产构建、Tauri Release 编译、MSI 与 NSIS 打包
- 桌面产物检查与安装器元数据冒烟

## 未完成风险

- 64 条替换项仍需真人盲听与揭示后核对，才能升级为听觉验证状态。
- 352 条未替换项中，350 条参考状态为 `needs-native-review`，2 条为 `conflict`；需要对应语言母语者或语音学审校者解决参考后，才允许第三候选。
- EXE、MSI 与 NSIS 尚未代码签名，公开发布门禁因此失败；当前安装包只用于受控内部测试。
- 本报告不把 Whisper、Azure、Scribe 或 TTS 自己的输出当作发音真相。

## 64 条替换音频真人盲听

已增加独立的本地盲听工作流，用于把 64 条
`machine-replaced-pending-human` 音频交给真人逐条确认：

```powershell
npm.cmd run audio:word-audit:promoted-review:test
npm.cmd run audio:word-audit:promoted-review:visual
npm.cmd run audio:word-audit:promoted-review:serve
npm.cmd run audio:word-audit:promoted-review:summary
```

- 正式范围为 64 条替换音频，加 3 条隐藏一致性复听，共 67 条。
- 盲听阶段只显示语言、匿名说话人和音频，不发送目标词、IPA、目标音、候选身份或既有真人结论。
- 隐藏复听只出现在原项之后，且至少间隔 12 项；完成度同时比较实际听到的词和可选 IPA。
- 3 条隐藏复听穿插在主队列中，不集中暴露在末尾；若前后答案不一致，旧判断会先归档，再由界面引导重新复核。
- 每条真人记录绑定当前候选 ID、正式音频 SHA-256 和批次摘要；音频变化后旧结论不能复用。
- 记录使用临时文件和备份恢复，损坏或不兼容记录会被隔离，不会静默套用。
- 参考答案仍为 `needs-native-review` 时，即使真人听成目标词，也不会自动升级为
  `verified-auditory`。
- 本地 Chrome 已验证真实 MP3 解码/短播放、桌面与 390px 布局、答案揭示和控制台零错误。
- 正式真人审听尚未开始，当前进度为盲听 `0/67`、定稿 `0/64`。
