# SpeakRight Vertex Gemini 发音候选重制报告（V1）

生成日期：2026-07-16
基线提交：`6b1007cda243050d1107ee081762feb44861d870`
模型：`gemini-3.1-flash-tts-preview`（TTS）＋ `gemini-3.1-pro-preview`（第三路无答案听写）
正式状态：`machine-replaced-pending-human`

## 结论

- ElevenLabs 暂不可用后，使用 Vertex Gemini 3.1 Flash TTS 为剩余 352 条高风险源资产生成候选。
- 生成 691 个可解码候选，覆盖 352/352 个源资产；没有源资产因生成失败而完全缺少候选。
- 691 个候选全部完成信号检查和 Whisper large-v3 无答案盲听；691 个完成 Azure 普通 STT 无答案盲听。
- 严格双路门禁留下 98 个候选、70 个源资产；第三路 Vertex 听写完成 63/70，其中 61 exact、2 different-word。
- 最终原子替换 56 条法语正式音频（{"fr-FR":56}），桌面端和网页端 SHA 差异为 0；Vertex 专用门禁为 通过，issue 0。
- 先前 ElevenLabs 批次有 64 条机器替换，本批新增 56 条；当前共 120 条仍待真人审听确认。
- 其余 296 条保持原文件，不因赶进度强行替换。

## 机器审计结果

- 信号异常候选：13
- Whisper 原始结果：{"mismatch":341,"exact":347,"orthographic-variant":2,"contains-expected":1}
- Whisper 按同音词规则重分类：{"different-word":338,"exact":347,"accepted-homophone":3,"orthographic-variant":2,"uncertain":1}
- Azure 无答案听写：{"different-word":268,"exact":356,"no-speech":57,"accepted-homophone":9,"orthographic-variant":1}
- 参考状态：{"needs-native-review":384,"two-source-confirmed":307}
- 第三路超时记录：7 条记录；最终缺少第三路结果 7 条。

本批 14 条严格候选未提升的原因：

- `english-pronunciation-missing`：5
- `third-listener-missing`：7
- `third-listener-different-word`：2

## 费用与凭据

- 当前成功生成响应累计 prompt tokens：55767
- 当前成功生成响应累计 audio tokens：23069
- 按官方 Vertex TTS token 单价估算，成功响应约 USD 0.5171；重试、第三路听写和云平台计量以账单为准。
- Azure 与 Google 凭据只从系统凭据/ADC 读取；报告、候选清单和 Git 文件不含 Key、Bearer Token 或请求头。

## 自动化回归

已通过：

- 根项目 lint、TypeScript、161 个测试文件 / 878 项单测
- 共享核心门禁（28 parity pairs）
- 训练音频门禁（10 包 / 80 对比 / 2 平台 × 4 声线）
- 强化跟读门禁（40 英语锚点、732 英语词、2109 多语言条目、11634 平台文件）
- 网页 lint、TypeScript、136 个测试文件 / 713 项单测、198 页生产构建
- 网页 35/35 Playwright、9 路由＋2 资产静态冒烟
- Tauri cargo check、8 项 Rust 测试、桌面前端 198 页构建
- Release EXE、MSI、NSIS 构建；产物和安装器元数据冒烟

## 尚未完成与发布边界

- 120 条正式替换仍需真人盲听与揭示后复核，不能标记为 `verified-auditory`。
- 198 条参考仍为 `needs-native-review`；西、法、俄争议项需要对应语言母语者或语音学审校者。
- 5 条英语候选尚缺 Azure 目标音/音节/重音辅助门禁，本批未替换。
- 7 条第三路听写最终缺失、2 条听成其他词，均未替换。
- 桌面 CDP UI smoke 因当前 WebView2 调试目标不可用而失败；不能用网页 E2E 冒充真实桌面验收。
- EXE、MSI、NSIS 均未代码签名，公开发布门禁按预期失败；当前构建仅用于受控内部测试。
- 聊天中曾暴露的 Azure Key 仍应在本轮完成后轮换。

完整旧/新 SHA 映射见 [phoneme-word-vertex-regeneration-v1-sha-map.json](./phoneme-word-vertex-regeneration-v1-sha-map.json)。
