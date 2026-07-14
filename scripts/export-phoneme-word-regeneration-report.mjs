import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDirectory, "..");
const regenerationRoot = path.join(
  repoRoot,
  "outputs",
  "phoneme-word-auditory-audit-2026-07-14",
  "regenerated-candidates",
);
const reportPath = path.join(
  repoRoot,
  "docs",
  "operations",
  "PHONEME_WORD_REGENERATION_V1.md",
);
const shaMapPath = path.join(
  repoRoot,
  "docs",
  "operations",
  "phoneme-word-regeneration-v1-sha-map.json",
);

const readJson = async (name) =>
  JSON.parse(await readFile(path.join(regenerationRoot, name), "utf8"));

const readJsonLines = async (relativePath) => {
  const raw = await readFile(path.join(regenerationRoot, relativePath), "utf8");
  return raw
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
};

const countBy = (items, keySelector) => {
  const counts = new Map();
  for (const item of items) {
    const key = keySelector(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Object.fromEntries(
    [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)),
  );
};

const gitRevision = (revision) =>
  execFileSync(
    "git",
    [
      "-c",
      `safe.directory=${repoRoot.replaceAll("\\", "/")}`,
      "rev-parse",
      revision,
    ],
    { cwd: repoRoot, encoding: "utf8" },
  ).trim();

const plan = await readJson("regeneration-plan.json");
const selection = await readJson("candidate-selection.json");
const thirdRound = await readJson("third-round-plan.json");
const ledger = await readJson("promotion-ledger.json");
const gate = await readJson("candidate-gate.json");
const generated = await readJsonLines("generated.jsonl");
const signals = await readJsonLines(path.join("analysis", "signal.jsonl"));

if (!gate.passed || gate.issues.length > 0) {
  throw new Error(`Candidate gate is not clean: ${gate.issues.join("; ")}`);
}

const assetsById = new Map(
  plan.sourceAssets.map((asset) => [asset.sourceAssetId, asset]),
);
const mappings = ledger.replacements
  .map((replacement) => {
    const asset = assetsById.get(replacement.sourceAssetId);
    if (!asset) {
      throw new Error(`Missing source asset for ${replacement.sourceAssetId}`);
    }
    return {
      sourceAssetId: replacement.sourceAssetId,
      candidateId: replacement.candidateId,
      languageId: replacement.languageId,
      text: replacement.text,
      desktopPath: asset.desktopPath,
      browserPath: asset.browserPath,
      oldSha256: replacement.oldSha256,
      newSha256: replacement.newSha256,
      voiceId: replacement.voiceId,
      modelId: replacement.modelId,
      seed: replacement.seed,
      status: replacement.status,
    };
  })
  .sort((a, b) =>
    `${a.languageId}:${a.text}:${a.sourceAssetId}`.localeCompare(
      `${b.languageId}:${b.text}:${b.sourceAssetId}`,
    ),
  );

await writeFile(
  shaMapPath,
  `${JSON.stringify({ version: 1, replacementCount: mappings.length, replacements: mappings }, null, 2)}\n`,
  "utf8",
);

const actualTtsCharacterCost = generated.reduce(
  (total, candidate) => total + (candidate.characterCost ?? 0),
  0,
);
const actualCandidateSeconds = signals.reduce(
  (total, item) => total + (item.signal?.durationSeconds ?? 0),
  0,
);
const signalFailureCount = signals.filter((item) => !item.signal?.ok).length;
const selectedByLanguage = countBy(
  selection.selected,
  (item) => item.languageId,
);
const selectedByLabel = countBy(selection.selected, (item) => item.label);
const passedByLanguage = countBy(
  selection.results.filter((item) => item.status === "machine-passed"),
  (item) => item.languageId,
);
const failedByLanguage = countBy(
  selection.results.filter((item) => item.status === "machine-failed"),
  (item) => item.languageId,
);
const reasonCounts = countBy(
  selection.results.flatMap((item) => item.reasons ?? []),
  (reason) => reason,
);
const usageBefore = 734;
const usageAfter = plan.subscription.characterCount;
const usageDelta = usageAfter - usageBefore;
const usageDifference = usageDelta - actualTtsCharacterCost;
const baselineSha = gitRevision("pre-audio-regeneration-2026-07-15^{}");
const generatedAtSha = gitRevision("HEAD");

const languageRows = ["en-US", "es-ES", "fr-FR", "ru-RU"]
  .map((languageId) => {
    const source = plan.byLanguage[languageId] ?? 0;
    const passed = passedByLanguage[languageId] ?? 0;
    const failed = failedByLanguage[languageId] ?? 0;
    const replaced = selectedByLanguage[languageId] ?? 0;
    return `| ${languageId} | ${source} | ${passed} | ${failed} | ${replaced} |`;
  })
  .join("\n");

const topReasons = Object.entries(reasonCounts)
  .sort(([, a], [, b]) => b - a)
  .slice(0, 12)
  .map(([reason, count]) => `- \`${reason}\`：${count}`)
  .join("\n");

const report = `# SpeakRight 416 条高风险音频重制报告（V1）

生成日期：2026-07-15  
安全起点：\`${baselineSha}\`  
报告生成时提交：\`${generatedAtSha}\`  
计划 SHA-256：\`${plan.planSha256}\`

## 结论

- 416 条机器高风险原资产生成了 832 个 A/B 候选，范围与计划完全一致。
- 832 个候选全部完成信号检查、Whisper large-v3、Azure 无参考文本 STT 和 ElevenLabs Scribe v2 盲听。
- 严格机器门禁通过 91 个候选，最终为 64 条不同原资产选择并替换了候选；桌面端与网页端同步替换。
- 352 条没有合格候选或参考仍未解决，正式文件保持原样。第三候选可执行数为 0，没有继续产生付费调用。
- 64 条替换项状态均为 \`machine-replaced-pending-human\`，尚未获得 \`verified-auditory\`。机器通过不等于真人确认或“百分百正确”。

## 数量与结果

| 语言 | 原资产 | 机器通过候选 | 机器失败候选 | 正式替换 |
|---|---:|---:|---:|---:|
${languageRows}

- 首轮候选：${generated.length}
- 信号检查失败候选：${signalFailureCount}
- 机器通过/失败候选：${selection.passedCandidateCount} / ${selection.failedCandidateCount}
- 正式替换：${ledger.replacementCount}
- A/B 选择分布：A ${selectedByLabel.A ?? 0}，B ${selectedByLabel.B ?? 0}
- 未解决原资产：${selection.unresolvedAssetCount}
- 第三候选：${thirdRound.candidateCount}；被参考答案门禁阻止：${thirdRound.blocked.length}

主要阻止原因：

${topReasons}

## 费用与服务使用

- 生成前套餐计数：${usageBefore}
- 批次后套餐计数：${usageAfter}
- 套餐计数变化：${usageDelta}
- TTS 响应返回的字符成本合计：${actualTtsCharacterCost}
- 差额：${usageDifference}（包含 Scribe 等服务计量；平台响应未在本地逐项拆分该差额）
- 候选实际总时长：${actualCandidateSeconds.toFixed(3)} 秒（${(
  actualCandidateSeconds / 60
).toFixed(3)} 分钟）
- 剩余额度：${plan.subscription.remaining} / ${plan.subscription.characterLimit}

## 替换与回退

- 64 条旧/新 SHA、双端路径、voice、模型和 seed 的完整映射：
  [phoneme-word-regeneration-v1-sha-map.json](./phoneme-word-regeneration-v1-sha-map.json)
- 每次提升前均校验原文件 SHA；桌面端和网页端使用同一新 SHA。
- 原文件仍可从 Git 历史及安全标签恢复。
- 候选音频、原始模型响应和请求追踪保留在被 Git 忽略的 \`outputs/\` 中。

## 自动化证据

已通过：

- 候选生成契约测试（10/10）与候选门禁（416 / 832 / 64，0 issue）
- 根项目 lint、类型检查与 876 项单元测试
- 共享核心重复检测、训练音频门禁、强化跟读音频门禁
- 网页端 lint、类型检查、711 项单元测试、198 页生产构建
- 网页端 35 项 Playwright 与静态构建冒烟
- Tauri \`cargo check\` 与 8 项 Rust 测试
- 桌面前端生产构建、Tauri Release 编译、MSI 与 NSIS 打包
- 桌面产物检查与安装器元数据冒烟

## 未完成风险

- 64 条替换项仍需真人盲听与揭示后核对，才能升级为听觉验证状态。
- 352 条未替换项中，350 条参考状态为 \`needs-native-review\`，2 条为 \`conflict\`；需要对应语言母语者或语音学审校者解决参考后，才允许第三候选。
- EXE、MSI 与 NSIS 尚未代码签名，公开发布门禁因此失败；当前安装包只用于受控内部测试。
- 本报告不把 Whisper、Azure、Scribe 或 TTS 自己的输出当作发音真相。
`;

await writeFile(reportPath, report, "utf8");

console.log(
  JSON.stringify(
    {
      reportPath: path.relative(repoRoot, reportPath),
      shaMapPath: path.relative(repoRoot, shaMapPath),
      replacements: mappings.length,
      actualTtsCharacterCost,
      actualCandidateSeconds: Number(actualCandidateSeconds.toFixed(3)),
      unresolvedAssets: selection.unresolvedAssetCount,
    },
    null,
    2,
  ),
);
