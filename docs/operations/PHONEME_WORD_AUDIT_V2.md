# 四语音标页真实听觉对齐审计（V2）

更新时间：2026-07-14

## 当前结论

这是一份进行中的发布级审计记录，不是“所有音频已经验证正确”的声明。当前正式音频、页面元数据和学习证据均未被本轮工具自动改写。

- 审计分支：`codex/phoneme-word-auditory-audit-v2`
- 安全标签：`pre-phoneme-word-auditory-audit-2026-07-14`
- 基线提交：`14357d6`
- 正式资产：4,543 条，共 69.05 分钟
- 单词音频：4,362 条
- 孤立音标与 header clips：181 条
- 双端缺失或 SHA 不一致：0
- 页面—目标音关系待核对：200 条；其中英语 10 条、西语 74 条、法语 8 条、俄语 108 条
- 正式音频替换：0

## 已完成的机器证据

faster-whisper large-v3 已对 4,362 条单词音频完成无参考文本盲听：

| 结果 | 数量 |
|---|---:|
| exact | 3,739 |
| accepted-homophone | 17 |
| orthographic-variant | 35 |
| uncertain | 28 |
| different-word | 540 |
| no-speech | 3 |

这些结果只用于排队，不能单独证明音频正确或错误。

Gemini 3.1 Pro 已按计划在仅监听 `127.0.0.1` 的本地代理上执行 12 条烟测。12/12 均收到代理 502；最小诊断显示代理使用的 Google 上游 `v1internal:generateContent` 返回 404。烟测因此失败，全量 Gemini 盲听没有启动，代理进程已关闭。

用户明确授权把聊天中出现过的 Key 仅用于完成本轮后再轮换。Azure 普通 STT 无参考文本盲听已完成 4,362/4,362，请求级失败为 0：

| 结果 | 数量 |
|---|---:|
| exact | 3,258 |
| accepted-homophone | 12 |
| orthographic-variant | 17 |
| uncertain | 27 |
| different-word | 457 |
| no-speech | 591 |

Azure烟测和全量结果均明确记录 `exposed-key-authorized-for-one-batch`。Key内容未写入输出或日志；本轮完成后必须立即在 Azure 门户轮换。

Whisper 与 Azure 的两路一致性分层结果：

| 优先级 | 含义 | 数量 |
|---|---|---:|
| P0-human | 两路都异常 | 416 |
| P1-human | 只有一路异常 | 814 |
| P2-confirm | 两路都稳定 | 3,132 |

其中 125 条被两路都听成同一个其他词，应最优先真人核对；595 组男女声或声线结果存在机器结论差异。这些数字用于安排审听顺序，不代表已确认的音频错误数。

## 已实施的防误判门禁

- 盲听请求不包含目标词、IPA、目标音、页面信息或原始文件名。
- Azure 使用普通 STT，不携带 reference text，也不混用 Pronunciation Assessment 分数。
- Gemini 只能连接 `http://127.0.0.1`，烟测失败时禁止进入全量。
- 英语目标音关系使用产品页面 IPA；不再错误套用 Azure 音素别名。
- 同音词使用版本化清单，不直接报成错词。
- 参考答案必须有两个独立来源，单一 CMUdict 或项目元数据不能标记为确认。
- 4,543 条人工审听队列包含 5% 匿名重复项；盲听提交前不会返回答案，也不会提示重复题身份。
- 单词参考未完成双来源定稿时，服务端拒绝保存 `verified-auditory` 或 `verified-variant`。
- 只有人工结论为 `confirmed-audio-error` 的资产才能进入重制 dry-run。
- 重制命令仍处于锁定状态，不会调用 ElevenLabs 或 Vortex，也不会覆盖正式文件。

## 参考答案队列

当前共有 2,167 个唯一词条：英语 760 条（含音标页与 chart 词例），西语 403 条，法语 499 条，俄语 505 条。

- P0：137 条。包括项目 IPA 与 CMUdict 冲突、缺失参考或页面目标音关系异常。
- P1：716 条。英语 CMUdict 一致，但仍需独立第二来源。
- P2-native：1,314 条。三种 Labs 语言需要 Wiktionary候选和母语者裁决。

被忽略输出目录中的 `reference-review-queue.json` 提供每个词的 Wiktionary入口；英语冲突项同时提供两家权威美式词典的人工裁决入口。第三方音频只用于人耳参照，不复制进产品。

## 人工审听

运行：

```powershell
npm.cmd run audio:word-audit:review
npm.cmd run audio:word-audit:review:serve
```

审听服务固定绑定 `127.0.0.1:43127`。流程先匿名盲听，再揭示正确词、IPA、目标音、男女声和机器观测。审听结果保存在被 Git 忽略的 `outputs/phoneme-word-auditory-audit-2026-07-14/`，可中断续跑。

## 目前的发布阻塞

1. 2,167 个词条尚未完成双来源或母语者参考定稿。
2. 本轮 Azure 已完成，但使用过的 Key 现在必须立即轮换。
3. Gemini本地代理上游失效，12 条烟测未通过。
4. 4,543 条真人盲听与揭示核对尚未完成。
5. 西语、法语、俄语争议项尚未由对应语言母语者裁决。

在这些阻塞清零前，最终门禁会失败；不得声称四语音频已完成发布级验证。

## 本轮工程回归

- 根项目 Biome lint：通过（921 个文件）。
- TypeScript `tsc --noEmit`：通过。
- 根项目 Vitest：160 个测试文件、876 项测试全部通过。
- 新增审计契约测试：10/10 通过。
- 原发音审计契约测试：7/7 通过。
- 10 个英语训练包、80 组对比、双平台四声线资产门禁：通过。
- 四语强化跟读资产门禁：通过（40 个英语锚点、732 个英语词、2,109 个多语言项目、11,634 个双平台文件）。
- 桌面预检：通过，现有 Release EXE 可定位，未发现残留 SpeakRight 进程。
- 完整 `npm run build` 在 10 分钟外部超时点仍停留于 Tauri NSIS 安装包生成；没有输出代码编译错误。超时后的 npm、Tauri 和 makensis 进程树已按 PID 核对并终止。该项记录为安装器阶段环境/时长阻塞，不能写成完整安装包门禁已通过。

## 常用命令

```powershell
npm.cmd run audio:word-audit:inventory
npm.cmd run audio:word-audit:reference
npm.cmd run audio:word-audit:blind:plan
npm.cmd run audio:word-audit:whisper
npm.cmd run audio:word-audit:consensus
npm.cmd run audio:word-audit:align:english
npm.cmd run audio:word-audit:test
npm.cmd run audio:word-audit:gate -- --stage=baseline
npm.cmd run audio:word-audit:report
```

最终阶段使用：

```powershell
npm.cmd run audio:word-audit:gate -- --stage=machine
npm.cmd run audio:word-audit:gate -- --stage=final
```

`machine` 和 `final` 目前按设计不会通过。
