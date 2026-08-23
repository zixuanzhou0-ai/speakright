#!/usr/bin/env node

import { execFile } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { assessAzurePronunciation } from "./lib/azure-pronunciation-client.mjs";
import {
  compareProjectIpaToCmu,
  loadCmuDictReference,
  lookupCmuPronunciations,
} from "./lib/cmudict-reference.mjs";
import {
  AUDIT_OUTPUT_NAME,
  AUDIT_STATUSES,
  AUDIT_VERSION,
  buildPronunciationInventory,
  compareTranscript,
  EXPECTED_CANONICAL_ASSET_COUNT,
  LANGUAGE_IDS,
  redactSecrets,
  WHISPER_MODEL_ROOT,
} from "./lib/pronunciation-audit-core.mjs";
import { readSpeakRightCredential } from "./lib/secure-credentials.mjs";
import { selectRegenerationProvider } from "./lib/tts-provider-policy.mjs";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const outputRoot = path.resolve(root, "outputs", AUDIT_OUTPUT_NAME);
const inventoryPath = path.join(outputRoot, "inventory.json");
const signalPath = path.join(outputRoot, "signal.jsonl");
const whisperPath = path.join(outputRoot, "whisper.jsonl");
const azurePath = path.join(outputRoot, "azure.jsonl");
const fixedAzureRegion = "switzerlandnorth";

function parseArgs(values) {
  const command = values[0];
  const args = new Set(values.slice(1));
  const valueFor = (prefix, fallback) =>
    values
      .find((value) => value.startsWith(`${prefix}=`))
      ?.slice(prefix.length + 1) ?? fallback;
  return { command, args, valueFor };
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp`;
  writeFileSync(
    temporary,
    `${JSON.stringify(redactSecrets(value), null, 2)}\n`,
    "utf8",
  );
  rmSync(filePath, { force: true });
  renameSync(temporary, filePath);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function readJsonl(filePath) {
  const values = [];
  if (!existsSync(filePath)) return values;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/u)) {
    if (!line.trim()) continue;
    try {
      values.push(JSON.parse(line));
    } catch {
      // A final interrupted checkpoint line is ignored and regenerated.
    }
  }
  return values;
}

function appendJsonl(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  appendFileSync(filePath, `${JSON.stringify(redactSecrets(value))}\n`, "utf8");
}

function requireInventory() {
  if (!existsSync(inventoryPath)) {
    throw new Error(
      "Inventory is missing. Run audio:pronunciation:inventory first.",
    );
  }
  return readJson(inventoryPath);
}

function inventoryCommand() {
  const inventory = buildPronunciationInventory(root);
  writeJson(inventoryPath, inventory);
  console.log(
    `Pronunciation inventory: ${inventory.assetCount} assets, ${inventory.totalBytes} bytes.`,
  );
  console.log(JSON.stringify(inventory.countsByLanguage, null, 2));
  if (
    inventory.issues.length > 0 ||
    inventory.untrackedAudio.length > 0 ||
    inventory.missingPhysical.length > 0
  ) {
    console.error(
      `Inventory has ${inventory.issues.length} issue(s), ` +
        `${inventory.untrackedAudio.length} untracked audio file(s), ` +
        `${inventory.missingPhysical.length} missing path(s).`,
    );
    process.exitCode = 1;
  }
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function referenceCommand() {
  const inventory = requireInventory();
  const groups = new Map();
  for (const asset of inventory.assets) {
    if (
      !asset.text ||
      asset.role === "header-clip" ||
      asset.role === "phoneme-anchor"
    ) {
      continue;
    }
    const key = [asset.languageId, asset.text, asset.expectedIpa ?? ""].join(
      "\u0000",
    );
    const current = groups.get(key) ?? {
      languageId: asset.languageId,
      locale: asset.locale,
      text: asset.text,
      projectIpa: asset.expectedIpa ?? null,
      targetUnits: asset.targetUnits,
      assetCount: 0,
      sourcePolicy:
        asset.languageId === "en-US"
          ? ["CMUdict", "Wiktionary"]
          : ["Wiktionary", "native-review-on-conflict"],
      referenceStatus: asset.expectedIpa
        ? "needs-independent-source-check"
        : "missing-project-ipa",
      sourceRevision: null,
      sourceIpa: null,
      reviewerDecision: null,
      notes: "",
    };
    current.assetCount += 1;
    groups.set(key, current);
  }
  const rows = [...groups.values()].sort((a, b) =>
    `${a.languageId}:${a.text}`.localeCompare(`${b.languageId}:${b.text}`),
  );
  const cmu = loadCmuDictReference();
  for (const row of rows) {
    if (row.languageId !== "en-US") continue;
    if (/\s/u.test(row.text.trim())) {
      row.cmu = {
        status: "cmudict-not-applicable-multiword",
        revision: cmu.revision,
        dictionarySha256: cmu.sha256,
        candidates: [],
      };
      continue;
    }
    const comparison = compareProjectIpaToCmu(
      row.projectIpa,
      lookupCmuPronunciations(cmu.entries, row.text),
    );
    row.cmu = {
      ...comparison,
      revision: cmu.revision,
      dictionarySha256: cmu.sha256,
    };
    row.referenceStatus =
      comparison.status === "cmudict-segment-match"
        ? "cmudict-matched-needs-second-source"
        : comparison.status;
    row.sourceRevision = cmu.revision;
    row.sourceIpa = comparison.candidates
      .map((candidate) => candidate.ipa)
      .join(" | ");
  }
  const document = {
    version: AUDIT_VERSION,
    generatedAt: new Date().toISOString(),
    localePolicy: ["en-US", "es-ES", "fr-FR", "ru-RU"],
    entryCount: rows.length,
    warning:
      "Project IPA is not an independent reference. Fill source revision and source IPA before automatic verification.",
    entries: rows,
  };
  writeJson(path.join(outputRoot, "reference-review.json"), document);
  const columns = [
    "languageId",
    "text",
    "projectIpa",
    "targetUnits",
    "assetCount",
    "sourcePolicy",
    "referenceStatus",
    "sourceRevision",
    "sourceIpa",
    "reviewerDecision",
    "notes",
  ];
  const csv = [
    columns.join(","),
    ...rows.map((row) =>
      columns
        .map((column) =>
          csvCell(
            Array.isArray(row[column]) ? row[column].join(" | ") : row[column],
          ),
        )
        .join(","),
    ),
  ].join("\r\n");
  writeFileSync(
    path.join(outputRoot, "reference-review.csv"),
    `${csv}\r\n`,
    "utf8",
  );
  console.log(`Reference review queue: ${rows.length} unique entries.`);
}
function signalByHash() {
  return new Map(
    readJsonl(signalPath).map((entry) => [entry.sha256, entry.signal]),
  );
}

function eligibleForAzure(asset) {
  return (
    !!asset.text &&
    asset.role !== "phoneme-anchor" &&
    asset.role !== "header-clip" &&
    asset.issues.length === 0
  );
}

function azurePlanCommand() {
  const inventory = requireInventory();
  const signals = signalByHash();
  if (signals.size !== inventory.assetCount) {
    throw new Error(
      `Signal audit incomplete: ${signals.size}/${inventory.assetCount}. Run audio:pronunciation:offline.`,
    );
  }
  const eligible = inventory.assets.filter(eligibleForAzure);
  const byLanguage = Object.fromEntries(
    LANGUAGE_IDS.map((languageId) => {
      const assets = eligible.filter(
        (asset) => asset.languageId === languageId,
      );
      return [
        languageId,
        {
          requests: assets.length,
          durationSeconds: Number(
            assets
              .reduce(
                (sum, asset) =>
                  sum + Number(signals.get(asset.sha256)?.durationSeconds ?? 0),
                0,
              )
              .toFixed(3),
          ),
        },
      ];
    }),
  );
  const requestCount = eligible.length;
  const durationSeconds = Object.values(byLanguage).reduce(
    (sum, item) => sum + item.durationSeconds,
    0,
  );
  const plan = {
    version: AUDIT_VERSION,
    generatedAt: new Date().toISOString(),
    sendsNetworkRequests: false,
    region: fixedAzureRegion,
    requestCount,
    durationSeconds: Number(durationSeconds.toFixed(3)),
    durationHours: Number((durationSeconds / 3600).toFixed(4)),
    concurrency: 2,
    estimatedWallClockMinutes: Number(
      Math.max(durationSeconds / 2 / 60, (requestCount * 1.5) / 2 / 60).toFixed(
        1,
      ),
    ),
    byLanguage,
    note: "Use the Azure account pricing page for the exact charge. No Azure request was made by this plan command.",
  };
  writeJson(path.join(outputRoot, "azure-plan.json"), plan);
  console.log(JSON.stringify(plan, null, 2));
}

async function convertToAzureWav(asset) {
  const wavPath = path.join(outputRoot, "wav-cache", `${asset.sha256}.wav`);
  if (existsSync(wavPath)) return wavPath;
  mkdirSync(path.dirname(wavPath), { recursive: true });
  await execFileAsync(
    "ffmpeg",
    [
      "-y",
      "-loglevel",
      "error",
      "-i",
      path.resolve(root, asset.desktopPath),
      "-ac",
      "1",
      "-ar",
      "16000",
      "-sample_fmt",
      "s16",
      wavPath,
    ],
    { windowsHide: true, timeout: 30_000 },
  );
  return wavPath;
}

async function withRetry(worker) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await worker();
    } catch (error) {
      const retryable =
        error?.status === 429 ||
        (typeof error?.status === "number" && error.status >= 500) ||
        /fetch|network|timeout/i.test(String(error?.message ?? error));
      if (!retryable || attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
    }
  }
  throw new Error("Retry loop exhausted");
}

async function runPool(items, concurrency, worker) {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        await worker(items[index], index);
      }
    }),
  );
}

function chooseSmokeAssets(assets) {
  return LANGUAGE_IDS.flatMap((languageId) => {
    const candidates = assets.filter(
      (asset) => asset.languageId === languageId && eligibleForAzure(asset),
    );
    if (candidates.length < 2) {
      throw new Error(`Not enough Azure smoke assets for ${languageId}`);
    }
    return [
      { asset: candidates[0], intentionalMismatch: false },
      { asset: candidates[1], intentionalMismatch: false },
      { asset: candidates[0], intentionalMismatch: true },
    ];
  });
}

async function azureRunCommand(parsed) {
  if (
    !parsed.args.has("--confirm") ||
    !parsed.args.has("--rotated-key-confirmed")
  ) {
    throw new Error(
      "Azure run requires --confirm and --rotated-key-confirmed after reviewing azure-plan.json.",
    );
  }
  const mode = parsed.valueFor("--mode", "smoke");
  if (!new Set(["smoke", "full"]).has(mode)) {
    throw new Error(`Invalid Azure mode: ${mode}`);
  }
  if (mode === "full") {
    const smokePath = path.join(outputRoot, "azure-smoke-summary.json");
    if (!existsSync(smokePath) || !readJson(smokePath).passed) {
      throw new Error(
        "A passing paid Azure smoke run is required before full mode.",
      );
    }
  }
  const inventory = requireInventory();
  const { value: azure, source } = await readSpeakRightCredential("azure");
  if (
    !azure?.subscriptionKey ||
    azure.region?.toLowerCase() !== fixedAzureRegion
  ) {
    throw new Error(
      `Azure credential must be configured for ${fixedAzureRegion} in desktop settings.`,
    );
  }
  const cached = new Map(
    readJsonl(azurePath)
      .filter((item) => !item.intentionalMismatch)
      .map((item) => [item.sha256, item]),
  );
  const eligible = inventory.assets.filter(eligibleForAzure);
  const items =
    mode === "smoke"
      ? chooseSmokeAssets(eligible)
      : eligible
          .filter((asset) => !cached.has(asset.sha256))
          .map((asset) => ({ asset, intentionalMismatch: false }));
  const failures = [];
  const completed = [];
  await runPool(items, 2, async ({ asset, intentionalMismatch }, index) => {
    try {
      const wavPath = await convertToAzureWav(asset);
      const mismatchReference = {
        "en-US": "different word",
        "es-ES": "palabra distinta",
        "fr-FR": "mot différent",
        "ru-RU": "другое слово",
      }[asset.languageId];
      const referenceText = intentionalMismatch
        ? mismatchReference
        : asset.text;
      const result = await withRetry(() =>
        assessAzurePronunciation({
          subscriptionKey: azure.subscriptionKey,
          region: fixedAzureRegion,
          languageId: asset.languageId,
          referenceText,
          wavPath,
          role: asset.role,
        }),
      );
      const observation = {
        assetId: asset.assetId,
        sha256: asset.sha256,
        languageId: asset.languageId,
        referenceText,
        intentionalMismatch,
        credentialSource: source,
        result,
      };
      appendJsonl(
        mode === "smoke"
          ? path.join(outputRoot, "azure-smoke.jsonl")
          : azurePath,
        observation,
      );
      completed.push({ asset, observation });
      console.log(
        `Azure ${mode} ${index + 1}/${items.length}: ${asset.assetId}`,
      );
    } catch (error) {
      failures.push({
        assetId: asset.assetId,
        intentionalMismatch,
        error: String(error?.message ?? error),
      });
    }
  });
  if (mode === "smoke") {
    for (const { asset, observation } of completed) {
      const transcriptMatch = compareTranscript(
        asset.text,
        observation.result.recognizedText,
        asset.languageId,
      );
      if (
        !observation.intentionalMismatch &&
        (!observation.result.ok ||
          ["mismatch", "no-speech"].includes(transcriptMatch))
      ) {
        failures.push({
          assetId: asset.assetId,
          error: `correct-reference-smoke-failed:${transcriptMatch}`,
        });
      }
      if (observation.intentionalMismatch) {
        const hasReferenceMismatchSignal =
          Number(observation.result.completenessScore ?? 100) < 95 ||
          observation.result.words.some(
            (word) => word.errorType && word.errorType !== "None",
          );
        if (!hasReferenceMismatchSignal) {
          failures.push({
            assetId: asset.assetId,
            error: "intentional-mismatch-was-not-detected",
          });
        }
      }
    }
  }
  const summary = {
    mode,
    generatedAt: new Date().toISOString(),
    requestCount: items.length,
    failed: failures.length,
    failures,
    passed: failures.length === 0,
  };
  writeJson(
    path.join(
      outputRoot,
      mode === "smoke" ? "azure-smoke-summary.json" : "azure-summary.json",
    ),
    summary,
  );
  if (failures.length) process.exitCode = 1;
}

function reviewCommand() {
  const inventory = requireInventory();
  const signals = new Map(
    readJsonl(signalPath).map((entry) => [entry.sha256, entry.signal]),
  );
  const whispers = new Map(
    readJsonl(whisperPath).map((entry) => [entry.sha256, entry.whisper]),
  );
  const azures = new Map(
    readJsonl(azurePath).map((entry) => [entry.sha256, entry.result]),
  );
  const alternatesByKey = new Map();
  for (const asset of inventory.assets) {
    const key = `${asset.languageId}:${asset.text ?? asset.targetUnits.join("|")}`;
    const group = alternatesByKey.get(key) ?? [];
    group.push(asset);
    alternatesByKey.set(key, group);
  }
  const rows = inventory.assets.map((asset) => {
    const key = `${asset.languageId}:${asset.text ?? asset.targetUnits.join("|")}`;
    const alternate = alternatesByKey
      .get(key)
      ?.find((candidate) => candidate.sha256 !== asset.sha256);
    return {
      ...asset,
      audioUrl: pathToFileURL(path.resolve(root, asset.desktopPath)).href,
      alternateAudioUrl: alternate
        ? pathToFileURL(path.resolve(root, alternate.desktopPath)).href
        : null,
      alternateSpeakerId:
        alternate?.speakerId ?? alternate?.voiceSlot ?? "另一音源",
      signal: signals.get(asset.sha256),
      whisper: whispers.get(asset.sha256),
      azure: azures.get(asset.sha256),
    };
  });
  const reviewRoot = path.join(outputRoot, "review");
  mkdirSync(reviewRoot, { recursive: true });
  const embedded = JSON.stringify(rows).replaceAll("<", "\\u003c");
  const options = ["pending", ...AUDIT_STATUSES]
    .map((status) => `<option value="${status}">${status}</option>`)
    .join("");
  const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SpeakRight 发音资产审听</title><style>
:root{font-family:Inter,"Microsoft YaHei",sans-serif;color:#17211f;background:#f4f8f7}body{margin:0}.top{position:sticky;top:0;z-index:2;background:#fff;border-bottom:1px solid #dce8e4;padding:16px 24px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}.top h1{font-size:20px;margin:0 18px 0 0;color:#087c69}.top input,.top select{min-height:42px;border:1px solid #bdd2cc;border-radius:10px;padding:0 12px}.grid{padding:20px;display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:14px}.card{background:#fff;border:1px solid #dbe7e3;border-radius:16px;padding:16px;box-shadow:0 4px 16px #143b3210}.meta{display:flex;justify-content:space-between;gap:12px}.word{font-size:25px;font-weight:750}.ipa{font-family:monospace;color:#087c69}.muted{color:#687874;font-size:13px}.signals{font-size:13px;background:#f5f9f8;border-radius:10px;padding:10px;margin:10px 0;white-space:pre-wrap}.card audio{width:100%;margin:8px 0}.decision{display:grid;grid-template-columns:1fr 1fr;gap:8px}.decision select,.decision textarea{border:1px solid #bdd2cc;border-radius:9px;padding:8px;min-height:42px}.decision textarea{grid-column:1/-1;min-height:64px}.hidden{display:none!important}button{min-height:42px;border:0;border-radius:10px;padding:0 14px;background:#087c69;color:#fff;font-weight:700;cursor:pointer}
</style></head><body><div class="top"><h1>SpeakRight 发音资产审听</h1><input id="q" placeholder="搜索单词/IPA/路径"><select id="language"><option value="">全部语言</option>${LANGUAGE_IDS.map((id) => `<option>${id}</option>`).join("")}</select><select id="role"><option value="">全部类型</option></select><button id="export">导出审听结果</button><span id="count"></span></div><main id="grid" class="grid"></main>
<script>const DATA=${embedded};const statuses=${JSON.stringify(options)};const esc=value=>String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll(String.fromCharCode(34),"&quot;");const saved=JSON.parse(localStorage.getItem('speakright-audio-review-v1')||'{}');const grid=document.getElementById('grid');const role=document.getElementById('role');[...new Set(DATA.map(x=>x.role))].sort().forEach(x=>role.insertAdjacentHTML('beforeend','<option>'+x+'</option>'));
function render(){const q=document.getElementById('q').value.toLowerCase();const lang=document.getElementById('language').value;const r=role.value;const items=DATA.filter(x=>(!lang||x.languageId===lang)&&(!r||x.role===r)&&(!q||JSON.stringify([x.text,x.expectedIpa,x.publicPath,x.speakerId]).toLowerCase().includes(q)));document.getElementById('count').textContent=items.length+' 条';grid.innerHTML=items.map(x=>{const state=saved[x.assetId]||{status:'pending',notes:''};const signal=x.signal||{};const whisper=x.whisper||{};const azure=x.azure||{};return '<article class="card" data-id="'+x.assetId+'"><div class="meta"><div><div class="word">'+esc(x.text||x.publicPath.split('/').pop())+'</div><div class="ipa">'+esc(x.expectedIpa||'IPA待核')+'</div></div><div class="muted">'+x.languageId+' · '+x.role+'<br>'+esc(x.speakerId||x.voiceSlot||'锚点')+'</div></div><div class="muted">当前音源</div><audio controls preload="none" src="'+x.audioUrl+'"></audio>'+(x.alternateAudioUrl?'<div class="muted">A/B 对照 · '+esc(x.alternateSpeakerId)+'</div><audio controls preload="none" src="'+x.alternateAudioUrl+'"></audio>':'')+'<div class="signals">Whisper: '+esc(whisper.transcript||whisper.reason||'待运行')+' ['+esc(whisper.match||'')+']\\nAzure: '+esc(azure.pronScore??'待运行')+' / '+esc(azure.recognizedText||'')+'\\n音质问题: '+esc((signal.issues||[]).join(', ')||'无')+'</div><div class="decision"><select data-field="status">${options}</select><span class="muted">'+x.publicPath+'</span><textarea data-field="notes" placeholder="问题、变体或审听依据"></textarea></div></article>'}).join('');grid.querySelectorAll('.card').forEach(card=>{const id=card.dataset.id;const state=saved[id]||{status:'pending',notes:''};const select=card.querySelector('[data-field=status]');const notes=card.querySelector('[data-field=notes]');select.value=state.status;notes.value=state.notes;const save=()=>{saved[id]={status:select.value,notes:notes.value};localStorage.setItem('speakright-audio-review-v1',JSON.stringify(saved))};select.onchange=save;notes.oninput=save})}document.querySelectorAll('#q,#language,#role').forEach(x=>x.addEventListener('input',render));document.getElementById('export').onclick=()=>{const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),decisions:saved},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='review-decisions.json';a.click();URL.revokeObjectURL(a.href)};render();</script></body></html>`;
  writeFileSync(path.join(reviewRoot, "index.html"), html, "utf8");
  const playlistAssets = rows.filter(
    (item) =>
      item.role === "phoneme-anchor" ||
      item.role === "header-clip" ||
      item.signal?.issues?.length ||
      item.whisper?.match === "mismatch" ||
      item.whisper?.match === "no-speech" ||
      item.azure?.ok === false ||
      (typeof item.azure?.pronScore === "number" && item.azure.pronScore < 80) ||
      (typeof item.azure?.completenessScore === "number" &&
        item.azure.completenessScore < 100),
  );
  const playlist = [
    "#EXTM3U",
    ...playlistAssets.flatMap((item) => [
      `#EXTINF:-1,${item.languageId} / ${item.text ?? item.publicPath}`,
      item.audioUrl,
    ]),
  ].join("\n");
  writeFileSync(path.join(reviewRoot, "priority-review.m3u8"), `${playlist}\n`);
  console.log(`Review dashboard: ${path.join(reviewRoot, "index.html")}`);
  console.log(`Priority playlist: ${playlistAssets.length} assets`);
}

function regeneratePlanCommand(parsed) {
  const inventory = requireInventory();
  const decisionsPath = path.join(outputRoot, "review-decisions.json");
  if (!existsSync(decisionsPath)) {
    throw new Error(
      `Review decisions missing: ${decisionsPath}. Export and place the review file first.`,
    );
  }
  const decisionsDocument = readJson(decisionsPath);
  const decisions = decisionsDocument.decisions ?? {};
  const confirmed = inventory.assets
    .filter((asset) => decisions[asset.assetId]?.status === "confirmed-error")
    .map((asset) => ({
      assetId: asset.assetId,
      languageId: asset.languageId,
      text: decisions[asset.assetId]?.replacementText ?? asset.text,
      expectedIpa:
        decisions[asset.assetId]?.replacementIpa ?? asset.expectedIpa ?? null,
      voiceSlot: asset.voiceSlot,
      speakerId: asset.speakerId,
      candidates: 2,
      estimatedCharacters:
        Array.from(
          decisions[asset.assetId]?.replacementText ?? asset.text ?? "",
        ).length * 2,
      reason: decisions[asset.assetId]?.notes ?? "",
    }));
  const elevenLabsRemaining = Number(
    parsed.valueFor("--elevenlabs-remaining", Number.NaN),
  );
  const vortexConfigured = parsed.args.has("--vortex-configured");
  const byLanguage = Object.fromEntries(
    LANGUAGE_IDS.map((languageId) => {
      const items = confirmed.filter((item) => item.languageId === languageId);
      const estimatedCharacters = items.reduce(
        (sum, item) => sum + item.estimatedCharacters,
        0,
      );
      return [
        languageId,
        {
          itemCount: items.length,
          estimatedCharacters,
          providerPolicy: selectRegenerationProvider({
            languageId,
            estimatedCharacters,
            elevenLabsRemainingCharacters: elevenLabsRemaining,
            vortexConfigured,
          }),
        },
      ];
    }),
  );
  const plan = {
    generatedAt: new Date().toISOString(),
    sendsNetworkRequests: false,
    confirmedErrors: confirmed.length,
    candidateCount: confirmed.length * 2,
    estimatedCharacters: confirmed.reduce(
      (sum, item) => sum + item.estimatedCharacters,
      0,
    ),
    byLanguage,
    vortexPolicy:
      "Gemini 3.1 TTS candidates are en-US only and require an explicit local Vortex adapter check.",
    items: confirmed,
  };
  writeJson(path.join(outputRoot, "elevenlabs-regeneration-plan.json"), plan);
  console.log(JSON.stringify(plan, null, 2));
}

function countBy(values, selector) {
  const counts = {};
  for (const value of values) {
    const key = selector(value) ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function reportCommand() {
  const inventory = requireInventory();
  const signals = [
    ...new Map(
      readJsonl(signalPath).map((item) => [item.sha256, item]),
    ).values(),
  ];
  const whispers = [
    ...new Map(
      readJsonl(whisperPath).map((item) => [item.sha256, item]),
    ).values(),
  ];
  const referencePath = path.join(outputRoot, "reference-review.json");
  const reference = existsSync(referencePath) ? readJson(referencePath) : null;
  const azurePlanPath = path.join(outputRoot, "azure-plan.json");
  const azurePlan = existsSync(azurePlanPath) ? readJson(azurePlanPath) : null;
  const azureSummaryPath = path.join(outputRoot, "azure-summary.json");
  const azureSummary = existsSync(azureSummaryPath)
    ? readJson(azureSummaryPath)
    : null;
  const azureObservations = [
    ...new Map(
      readJsonl(azurePath).map((item) => [item.sha256, item]),
    ).values(),
  ];
  const modelManifestPath = path.join(
    WHISPER_MODEL_ROOT,
    "speakright-model-manifest.json",
  );
  const model = existsSync(modelManifestPath)
    ? readJson(modelManifestPath)
    : { complete: false, modelRoot: WHISPER_MODEL_ROOT };
  const signalIssueCounts = {};
  for (const item of signals) {
    for (const issue of item.signal?.issues ?? []) {
      signalIssueCounts[issue] = (signalIssueCounts[issue] ?? 0) + 1;
    }
  }
  const referenceStatusCounts = reference
    ? countBy(reference.entries, (entry) => entry.referenceStatus)
    : {};
  const azureScoreDistribution = {};
  for (const item of azureObservations) {
    const language = item.languageId ?? "unknown";
    if (!azureScoreDistribution[language]) {
      azureScoreDistribution[language] = {
        count: 0,
        ok: 0,
        scoreMissing: 0,
        below60: 0,
        from60To69: 0,
        from70To79: 0,
        atLeast80: 0,
        completenessBelow100: 0,
        pronScoreTotal: 0,
        pronScoreCount: 0,
      };
    }
    const bucket = azureScoreDistribution[language];
    bucket.count += 1;
    if (item.result?.ok) bucket.ok += 1;
    const score = item.result?.pronScore;
    if (typeof score !== "number") {
      bucket.scoreMissing += 1;
    } else {
      bucket.pronScoreTotal += score;
      bucket.pronScoreCount += 1;
      if (score < 60) bucket.below60 += 1;
      else if (score < 70) bucket.from60To69 += 1;
      else if (score < 80) bucket.from70To79 += 1;
      else bucket.atLeast80 += 1;
    }
    if (
      typeof item.result?.completenessScore === "number" &&
      item.result.completenessScore < 100
    ) {
      bucket.completenessBelow100 += 1;
    }
  }
  for (const bucket of Object.values(azureScoreDistribution)) {
    bucket.averagePronScore = bucket.pronScoreCount
      ? Number((bucket.pronScoreTotal / bucket.pronScoreCount).toFixed(2))
      : null;
    delete bucket.pronScoreTotal;
    delete bucket.pronScoreCount;
  }
  const whisperRiskShas = new Set(
    whispers
      .filter((item) =>
        ["mismatch", "no-speech"].includes(item.whisper?.match),
      )
      .map((item) => item.sha256),
  );
  const dualSignalCandidates = azureObservations.filter((item) => {
    const azureRisk =
      item.result?.ok === false ||
      (typeof item.result?.pronScore === "number" &&
        item.result.pronScore < 80) ||
      (typeof item.result?.completenessScore === "number" &&
        item.result.completenessScore < 100);
    return azureRisk && whisperRiskShas.has(item.sha256);
  });
  const report = {
    generatedAt: new Date().toISOString(),
    branch: "codex/pronunciation-audio-audit-v1",
    assetCount: inventory.assetCount,
    totalBytes: inventory.totalBytes,
    countsByLanguage: inventory.countsByLanguage,
    inventoryIssues: inventory.issues.length,
    platformParityIssues: inventory.assets.filter((asset) =>
      asset.issues.includes("platform-hash-mismatch"),
    ).length,
    signalCoverage: `${signals.length}/${inventory.assetCount}`,
    signalIssueCounts,
    whisperCoverage: `${whispers.length}/${inventory.assetCount}`,
    whisperMatchCounts: countBy(
      whispers,
      (item) => item.whisper?.match ?? item.whisper?.reason ?? "not-applicable",
    ),
    referenceEntries: reference?.entryCount ?? 0,
    referenceStatusCounts,
    azurePlan,
    azureFull: {
      completed: azureSummary?.passed === true,
      requestCount: azureSummary?.requestCount ?? 0,
      failed: azureSummary?.failed ?? null,
      coverage: `${azureObservations.length}/${azurePlan?.requestCount ?? 0}`,
      scoreDistribution: azureScoreDistribution,
      credentialRiskMode:
        azureObservations[0]?.credentialRiskMode ?? "not-recorded",
      dualSignalCandidateCount: dualSignalCandidates.length,
      dualSignalCandidatesByLanguage: countBy(
        dualSignalCandidates,
        (item) => item.languageId,
      ),
    },
    model: {
      id: model.modelId,
      root: model.modelRoot,
      revision: model.repositoryRevision,
      bytes: model.totalBytes,
      complete: model.complete,
    },
    regeneration: {
      formalAssetsReplaced: 0,
      elevenLabsRequestsSent: 0,
      vortexRequestsSent: 0,
      vortexInterfaceStatus: "not-discovered-or-configured",
    },
    blockers: [
      "聊天中出现的 Azure Key 在本批次结束后仍必须轮换；全量 Azure 筛查已按用户明确授权完成。",
      "所有音标锚点、音质异常和参考冲突仍需人工审听。",
      "西班牙语、法语和俄语争议项需要母语审校后才能发布。",
      "尚未发现或验证可调用的本地 Vortex Gemini 3.1 TTS 接口。",
    ],
  };
  writeJson(path.join(outputRoot, "audit-progress-report.json"), report);
  const markdown = `# SpeakRight 四语发音审计进度\n\n- 生成时间：${report.generatedAt}\n- 资产：${report.assetCount} 条，${report.totalBytes} bytes\n- 双端哈希差异：${report.platformParityIssues}\n- 信号覆盖：${report.signalCoverage}\n- Whisper 覆盖：${report.whisperCoverage}\n- 参考答案队列：${report.referenceEntries} 个唯一条目\n- Azure dry-run：${azurePlan ? `${azurePlan.requestCount} 次 / ${azurePlan.durationHours} 小时音频` : "尚未生成"}\n- Azure 全量：${report.azureFull.completed ? `${report.azureFull.coverage}，失败 ${report.azureFull.failed}` : "尚未完成"}\n- 正式替换音频：0\n\n## Azure 分数分布（仅作筛查信号）\n\n\u0060\u0060\u0060json\n${JSON.stringify(report.azureFull.scoreDistribution, null, 2)}\n\u0060\u0060\u0060\n\n## Whisper 匹配\n\n\u0060\u0060\u0060json\n${JSON.stringify(report.whisperMatchCounts, null, 2)}\n\u0060\u0060\u0060\n\n## 信号异常\n\n\u0060\u0060\u0060json\n${JSON.stringify(signalIssueCounts, null, 2)}\n\u0060\u0060\u0060\n\n## 参考答案状态\n\n\u0060\u0060\u0060json\n${JSON.stringify(referenceStatusCounts, null, 2)}\n\u0060\u0060\u0060\n\n## 当前阻塞\n\n${report.blockers.map((item) => `- ${item}`).join("\n")}\n`;
  writeFileSync(
    path.join(outputRoot, "audit-progress-report.md"),
    markdown,
    "utf8",
  );
  console.log(JSON.stringify(report, null, 2));
}
function gateCommand(parsed) {
  const stage = parsed.valueFor("--stage", "final");
  const inventory = requireInventory();
  const failures = [];
  if (inventory.assetCount !== EXPECTED_CANONICAL_ASSET_COUNT) {
    failures.push(`asset count ${inventory.assetCount}`);
  }
  if (inventory.issues.length)
    failures.push(`${inventory.issues.length} inventory issues`);
  if (inventory.untrackedAudio.length) {
    failures.push(`${inventory.untrackedAudio.length} untracked audio files`);
  }
  const signals = readJsonl(signalPath);
  const whispers = readJsonl(whisperPath);
  if (signals.length !== inventory.assetCount) {
    failures.push(
      `signal observations ${signals.length}/${inventory.assetCount}`,
    );
  }
  if (whispers.length !== inventory.assetCount) {
    failures.push(
      `whisper observations ${whispers.length}/${inventory.assetCount}`,
    );
  }
  if (stage === "final") {
    const azureSummaryPath = path.join(outputRoot, "azure-summary.json");
    const azurePlanPath = path.join(outputRoot, "azure-plan.json");
    const azureSummary = existsSync(azureSummaryPath)
      ? readJson(azureSummaryPath)
      : null;
    const azurePlan = existsSync(azurePlanPath) ? readJson(azurePlanPath) : null;
    const azureObservations = [
      ...new Map(
        readJsonl(azurePath).map((item) => [item.sha256, item]),
      ).values(),
    ];
    if (azureSummary?.passed !== true) {
      failures.push("full Azure screening not completed");
    }
    if (
      azurePlan?.requestCount &&
      azureObservations.length !== azurePlan.requestCount
    ) {
      failures.push(
        `azure observations ${azureObservations.length}/${azurePlan.requestCount}`,
      );
    }
    const finalPath = path.join(outputRoot, "final-decisions.json");
    if (!existsSync(finalPath)) failures.push("final-decisions.json missing");
    else {
      const final = readJson(finalPath).decisions ?? {};
      const unresolved = inventory.assets.filter(
        (asset) =>
          !new Set([
            "verified",
            "verified-variant",
            "replaced-and-verified",
          ]).has(final[asset.assetId]?.status),
      );
      if (unresolved.length)
        failures.push(`${unresolved.length} unresolved decisions`);
    }
  }
  if (failures.length) {
    console.error(`Pronunciation ${stage} gate failed:`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log(
      `Pronunciation ${stage} gate passed (${inventory.assetCount} assets).`,
    );
  }
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  switch (parsed.command) {
    case "inventory":
      inventoryCommand();
      break;
    case "reference":
      referenceCommand();
      break;
    case "azure-plan":
      azurePlanCommand();
      break;
    case "azure-run":
      await azureRunCommand(parsed);
      break;
    case "review":
      reviewCommand();
      break;
    case "regenerate-plan":
      regeneratePlanCommand(parsed);
      break;
    case "regenerate":
      throw new Error(
        "Regeneration remains locked until a reviewed plan and a separate paid-credit confirmation are present.",
      );
    case "report":
      reportCommand();
      break;
    case "gate":
      gateCommand(parsed);
      break;
    default:
      throw new Error(`Unknown command: ${parsed.command ?? "(missing)"}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
