# SpeakRight 四语发音资产审计进度（2026-07-14）

## 结论

本轮已完成全部发布资产的清点、信号检查、faster-whisper large-v3 离线筛查，以及所有可使用参考文本的 Azure Pronunciation Assessment 全量筛查。

机器结果是风险信号，不是最终发音真相。正式替换必须经过参考答案复核和人工审听；西班牙语、法语、俄语争议项还需对应语言的母语审校。

## 覆盖

- 主资产：6,242 条，105,564,575 bytes。
- 桌面端与网页端 SHA-256 差异：0。
- 信号检查：6,242 / 6,242。
- Whisper：6,242 / 6,242。
- Azure：6,061 / 6,061（其余 181 条为孤立音标锚点或缺少可用参考文本，不进行词汇判定）。
- Azure 请求失败：0。
- Azure region：switzerlandnorth。
- Azure 音频总时长：6,048.939 秒（1.6803 小时）。
- 全量调用实际墙钟时间：约 1,958 秒。

## 模型

- 模型：Systran/faster-whisper-large-v3。
- 本地目录：D:\AI\models\whisper\faster-whisper-large-v3。
- revision：edaa852ec7e145841d8ffdb056a99866b5f0a478。
- 大小：3,090,840,024 bytes。
- 运行：CUDA float16。
- C 盘未新增 Whisper 模型副本。

## 离线筛查

Whisper 结果：

- exact：5,266。
- orthographic-variant：51。
- contains-expected：28。
- mismatch：713。
- no-speech：3。
- 不适用或缺少参考文本：181。

信号问题共 4 条：

- 过短：1。
- 静音比例异常：2。
- 平均音量过低：1。

这些项目全部进入人工审听队列。

## Azure 描述性分布

以下阈值仅用于排列审听优先级，未经过针对本项目材料的科学校准，不能直接判定正确或错误。

| 语言 | 请求 | 平均 PronScore | <60 | 60–69 | 70–79 | ≥80 | 完整度 <100 |
|---|---:|---:|---:|---:|---:|---:|---:|
| en-US | 1,843 | 99.69 | 0 | 0 | 0 | 1,843 | 0 |
| es-ES | 1,094 | 96.93 | 10 | 2 | 5 | 1,077 | 12 |
| fr-FR | 1,482 | 86.87 | 140 | 19 | 35 | 1,288 | 164 |
| ru-RU | 1,642 | 97.12 | 31 | 10 | 28 | 1,573 | 70 |

Whisper 与 Azure 同时出现风险的高优先候选共 171 条：

- es-ES：11。
- fr-FR：125。
- ru-RU：35。
- en-US：0。

英语 Azure 分数很高并不证明全部英语资产或项目 IPA 元数据绝对正确。Azure 使用参考文本进行评估，对干净 TTS 音频可能非常宽容；英语仍有 62 条 Whisper 不匹配和 37 条 CMUdict 参考冲突需要独立复核。

## 人工审听队列

审听面板位于被 Git 忽略的：

outputs/pronunciation-audit-2026-07-14/review/index.html

优先播放列表包含 1,019 条，覆盖：

- 全部音标锚点和 header clips；
- 全部信号异常；
- Whisper mismatch / no-speech；
- Azure PronScore <80；
- Azure 完整度 <100。

自动通过项仍需按语言、声线、角色和分数层做至少 10% 抽样；任一层错误率超过 1% 时，该层扩展为 100% 人工审听。

## 安全与服务调用

- Azure 配置只从 Windows Credential Manager 读取。
- 输出脱敏扫描未发现 subscription key、Authorization、Token、密码或请求头字段。
- 原始响应、WAV 缓存、播放列表和审听页面均位于 /outputs/，不进入 Git。
- 本轮没有调用 ElevenLabs。
- 本轮没有调用 Vortex Gemini TTS。
- 正式音频替换数：0。
- 聊天中曾出现的 Azure Key 在批次结束后仍必须轮换；代码已恢复为只允许“已轮换密钥”确认后启动新批次。

## 当前门禁

已通过：

- 资产清单与双端哈希门禁。
- 信号与 Whisper 全覆盖门禁。
- Azure 6,061 条完整性检查。
- 审计契约测试 7 / 7。
- 根项目 Biome lint。
- 脱敏扫描。

最终发布门禁仍正确阻塞：

- final-decisions.json 尚未完成。
- 1,019 条优先队列尚未逐条审听。
- 西班牙语、法语、俄语争议项尚未完成母语审校。
- 尚未确认任何 confirmed-error，因此不能启动 ElevenLabs 或 Vortex 重制。