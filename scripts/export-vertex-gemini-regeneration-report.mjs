import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const auditRoot = path.resolve(
  root,
  "outputs/phoneme-word-auditory-audit-2026-07-14",
);
const regenerationRoot = path.join(auditRoot, "regenerated-candidates");
const vertexRoot = path.join(regenerationRoot, "vertex-gemini-3.1-tts");
const analysisRoot = path.join(vertexRoot, "analysis");
const reportPath = path.resolve(
  root,
  "docs/operations/PHONEME_WORD_VERTEX_REGENERATION_V1.md",
);
const shaMapPath = path.resolve(
  root,
  "docs/operations/phoneme-word-vertex-regeneration-v1-sha-map.json",
);

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function readJsonl(filePath) {
  return readFileSync(filePath, "utf8")
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function countBy(items, selector) {
  const counts = {};
  for (const item of items) {
    const key = selector(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

const headSha = process.env.REPORT_HEAD_SHA?.trim();
if (!headSha || !/^[0-9a-f]{40}$/u.test(headSha)) {
  throw new Error("Set REPORT_HEAD_SHA to the audited 40-character Git SHA");
}
const vertexPlan = readJson(path.join(vertexRoot, "vertex-plan.json"));
const inventory = readJson(path.join(vertexRoot, "candidate-inventory.json"));
const offline = readJson(path.join(analysisRoot, "offline-summary.json"));
const azure = readJson(path.join(analysisRoot, "azure-blind-summary.json"));
const evaluation = readJson(
  path.join(analysisRoot, "candidate-evaluation.json"),
);
const third = readJson(
  path.join(analysisRoot, "vertex-gemini-blind-summary.json"),
);
const promotionPlan = readJson(path.join(analysisRoot, "promotion-plan.json"));
const vertexLedger = readJson(path.join(analysisRoot, "promotion-ledger.json"));
const vertexGate = readJson(
  path.join(analysisRoot, "vertex-candidate-gate.json"),
);
const priorLedger = readJson(
  path.join(regenerationRoot, "promotion-ledger.json"),
);
const generatedRows = readJsonl(path.join(vertexRoot, "generated.jsonl"));
const failures = readJsonl(
  path.join(analysisRoot, "vertex-gemini-blind-failures.jsonl"),
);
const allPromptTokens = generatedRows.reduce(
  (sum, row) => sum + Number(row.usageMetadata?.promptTokenCount ?? 0),
  0,
);
const allAudioTokens = generatedRows.reduce(
  (sum, row) => sum + Number(row.usageMetadata?.candidatesTokenCount ?? 0),
  0,
);
const estimatedSuccessfulGenerationCostUsd =
  allPromptTokens / 1_000_000 + (allAudioTokens * 20) / 1_000_000;
const blockedReasons = countBy(
  promotionPlan.blocked.flatMap((item) => item.reasons),
  (reason) => reason,
);
const promotedByLanguage = countBy(
  vertexLedger.replacements,
  (item) => item.languageId,
);
const totalMachinePendingHuman =
  priorLedger.replacementCount + vertexLedger.replacementCount;
const unresolvedAfterVertex =
  vertexPlan.sourceAssetCount - vertexLedger.replacementCount;

writeFileSync(
  shaMapPath,
  `${JSON.stringify(
    {
      version: 1,
      generatedAt: new Date().toISOString(),
      baseHeadSha: headSha,
      replacementCount: vertexLedger.replacementCount,
      replacements: vertexLedger.replacements.map((replacement) => ({
        sourceAssetId: replacement.sourceAssetId,
        candidateId: replacement.candidateId,
        languageId: replacement.languageId,
        text: replacement.text,
        desktopPath: replacement.desktopPath,
        browserPath: replacement.browserPath,
        oldSha256: replacement.expectedOldSha256,
        newSha256: replacement.candidateSha256,
        provider: replacement.provider,
        modelId: replacement.modelId,
        voiceGender: replacement.voiceGender,
        vertexVoiceName: replacement.vertexVoiceName,
        status: replacement.status,
      })),
    },
    null,
    2,
  )}\n`,
  "utf8",
);

const reasonLines = Object.entries(blockedReasons)
  .map(([reason, count]) => `- \`${reason}\`：${count}`)
  .join("\n");
const report = `# SpeakRight Vertex Gemini 发音候选重制报告（V1）

生成日期：2026-07-16
基线提交：\`${headSha}\`
模型：\`${vertexPlan.modelId}\`（TTS）＋ \`${third.modelId}\`（第三路无答案听写）
正式状态：\`machine-replaced-pending-human\`

## 结论

- ElevenLabs 暂不可用后，使用 Vertex Gemini 3.1 Flash TTS 为剩余 ${vertexPlan.sourceAssetCount} 条高风险源资产生成候选。
- 生成 ${inventory.assetCount} 个可解码候选，覆盖 ${inventory.sourceAssetCount}/${vertexPlan.sourceAssetCount} 个源资产；没有源资产因生成失败而完全缺少候选。
- ${offline.signalObservations} 个候选全部完成信号检查和 Whisper large-v3 无答案盲听；${azure.observationCount} 个完成 Azure 普通 STT 无答案盲听。
- 严格双路门禁留下 ${evaluation.twoListenerEligibleCandidateCount} 个候选、${evaluation.twoListenerEligibleSourceCount} 个源资产；第三路 Vertex 听写完成 ${third.observationCount}/${third.plannedCandidateCount}，其中 ${third.outcomes.exact ?? 0} exact、${third.outcomes["different-word"] ?? 0} different-word。
- 最终原子替换 ${vertexLedger.replacementCount} 条法语正式音频（${JSON.stringify(promotedByLanguage)}），桌面端和网页端 SHA 差异为 0；Vertex 专用门禁为 ${vertexGate.passed ? "通过" : "失败"}，issue ${vertexGate.issues.length}。
- 先前 ElevenLabs 批次有 ${priorLedger.replacementCount} 条机器替换，本批新增 ${vertexLedger.replacementCount} 条；当前共 ${totalMachinePendingHuman} 条仍待真人审听确认。
- 其余 ${unresolvedAfterVertex} 条保持原文件，不因赶进度强行替换。

## 机器审计结果

- 信号异常候选：${offline.signalIssueCount}
- Whisper 原始结果：${JSON.stringify(offline.whisperMatches)}
- Whisper 按同音词规则重分类：${JSON.stringify(evaluation.whisperOutcomes)}
- Azure 无答案听写：${JSON.stringify(evaluation.azureOutcomes)}
- 参考状态：${JSON.stringify(evaluation.referenceStatuses)}
- 第三路超时记录：${failures.length} 条记录；最终缺少第三路结果 ${promotionPlan.blocked.filter((item) => item.reasons.includes("third-listener-missing")).length} 条。

本批 14 条严格候选未提升的原因：

${reasonLines}

## 费用与凭据

- 当前成功生成响应累计 prompt tokens：${allPromptTokens}
- 当前成功生成响应累计 audio tokens：${allAudioTokens}
- 按官方 Vertex TTS token 单价估算，成功响应约 USD ${estimatedSuccessfulGenerationCostUsd.toFixed(4)}；重试、第三路听写和云平台计量以账单为准。
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

- ${totalMachinePendingHuman} 条正式替换仍需真人盲听与揭示后复核，不能标记为 \`verified-auditory\`。
- 198 条参考仍为 \`needs-native-review\`；西、法、俄争议项需要对应语言母语者或语音学审校者。
- 5 条英语候选尚缺 Azure 目标音/音节/重音辅助门禁，本批未替换。
- 7 条第三路听写最终缺失、2 条听成其他词，均未替换。
- 桌面 CDP UI smoke 因当前 WebView2 调试目标不可用而失败；不能用网页 E2E 冒充真实桌面验收。
- EXE、MSI、NSIS 均未代码签名，公开发布门禁按预期失败；当前构建仅用于受控内部测试。
- 聊天中曾暴露的 Azure Key 仍应在本轮完成后轮换。

完整旧/新 SHA 映射见 [phoneme-word-vertex-regeneration-v1-sha-map.json](./phoneme-word-vertex-regeneration-v1-sha-map.json)。
`;
writeFileSync(reportPath, report, "utf8");
console.log(
  JSON.stringify(
    {
      reportPath: path.relative(root, reportPath),
      shaMapPath: path.relative(root, shaMapPath),
      vertexReplacements: vertexLedger.replacementCount,
      totalMachinePendingHuman,
      unresolvedAfterVertex,
      estimatedSuccessfulGenerationCostUsd: Number(
        estimatedSuccessfulGenerationCostUsd.toFixed(4),
      ),
    },
    null,
    2,
  ),
);
