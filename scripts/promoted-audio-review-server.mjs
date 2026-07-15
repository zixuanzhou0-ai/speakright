#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto";
import {
  copyFileSync,
  createReadStream,
  existsSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { URL } from "node:url";
import {
  buildPromotedReviewBundle,
  PROMOTED_HUMAN_OUTCOMES,
  promotedBlindPayload,
  resolvePromotedHumanStatus,
} from "./lib/promoted-audio-review-core.mjs";
import { normalizeAuditText } from "./lib/pronunciation-audit-core.mjs";

const root = process.cwd();
const auditRoot = path.resolve(
  root,
  "outputs",
  "phoneme-word-auditory-audit-2026-07-14",
);
const regenerationRoot = path.join(auditRoot, "regenerated-candidates");
const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));
const readJsonLines = (filePath) =>
  existsSync(filePath)
    ? readFileSync(filePath, "utf8")
        .split(/\r?\n/u)
        .filter(Boolean)
        .map((line) => JSON.parse(line))
    : [];
const bundle = buildPromotedReviewBundle({
  plan: readJson(path.join(regenerationRoot, "regeneration-plan.json")),
  ledger: readJson(path.join(regenerationRoot, "promotion-ledger.json")),
  selection: readJson(path.join(regenerationRoot, "candidate-selection.json")),
});
const fullInventory = readJson(path.join(auditRoot, "inventory.json"));
const decisionsArgument = process.argv.find((value) =>
  value.startsWith("--decisions-file="),
);
const decisionsFileName =
  decisionsArgument?.slice("--decisions-file=".length) ??
  "promoted-human-auditory-decisions.json";
if (!/^[a-z0-9][a-z0-9._-]*\.json$/iu.test(decisionsFileName)) {
  throw new Error("Decisions filename must be a simple JSON filename");
}
const decisionsPath = path.join(regenerationRoot, decisionsFileName);
const portArgument = process.argv.find((value) => value.startsWith("--port="));
const port = Number(portArgument?.slice("--port=".length) ?? 43128);
const host = "127.0.0.1";
const origin = `http://${host}:${port}`;
const reviewToken = randomBytes(24).toString("hex");
const instanceArgument = process.argv.find((value) =>
  value.startsWith("--instance-id="),
);
const requestedInstanceId = instanceArgument?.slice("--instance-id=".length);
if (requestedInstanceId && !/^[a-f0-9]{16,64}$/u.test(requestedInstanceId)) {
  throw new Error("Instance ID must be a 16-64 character lowercase hex value");
}
const instanceId = requestedInstanceId ?? randomBytes(16).toString("hex");

function isWithinRoot(absolutePath) {
  const relative = path.relative(root, absolutePath);
  return (
    relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative)
  );
}

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

for (const asset of bundle.assets) {
  for (const relativePath of [asset.desktopPath, asset.browserPath]) {
    const absolutePath = path.resolve(root, relativePath);
    if (!isWithinRoot(absolutePath) || !existsSync(absolutePath)) {
      throw new Error(`Promoted review file missing: ${relativePath}`);
    }
    if (sha256File(absolutePath) !== asset.sha256) {
      throw new Error(`Promoted review SHA mismatch: ${relativePath}`);
    }
  }
  const candidatePath = path.resolve(root, asset.candidatePath);
  if (!isWithinRoot(candidatePath) || !existsSync(candidatePath)) {
    throw new Error(`Promoted candidate cache missing: ${asset.candidatePath}`);
  }
  if (sha256File(candidatePath) !== asset.sha256) {
    throw new Error(`Promoted candidate SHA mismatch: ${asset.candidatePath}`);
  }
}

const assetsById = new Map(
  bundle.assets.map((asset) => [asset.assetId, asset]),
);
const queueById = new Map(bundle.queue.map((item) => [item.reviewId, item]));

const machineMaps = {
  whisper: new Map(
    readJsonLines(path.join(regenerationRoot, "analysis", "whisper.jsonl")).map(
      (row) => [row.assetId, row],
    ),
  ),
  azureStt: new Map(
    readJsonLines(
      path.join(regenerationRoot, "analysis", "azure-stt.jsonl"),
    ).map((row) => [row.candidateId, row]),
  ),
  scribe: new Map(
    readJsonLines(
      path.join(regenerationRoot, "analysis", "scribe-v2.jsonl"),
    ).map((row) => [row.candidateId, row]),
  ),
};

for (const asset of bundle.assets) {
  const rows = [
    machineMaps.whisper.get(asset.candidateId),
    machineMaps.azureStt.get(asset.candidateId),
    machineMaps.scribe.get(asset.candidateId),
  ];
  const hashes = [
    rows[0]?.sha256,
    rows[1]?.candidateSha256,
    rows[2]?.candidateSha256,
  ];
  if (
    rows.some((row) => !row) ||
    hashes.some((hash) => hash !== asset.sha256)
  ) {
    throw new Error(`Promoted machine evidence mismatch: ${asset.candidateId}`);
  }
}

function emptyDecisions() {
  return {
    version: 2,
    scope: "machine-replaced-pending-human",
    bundleDigest: bundle.digest,
    updatedAt: new Date().toISOString(),
    blindReviews: {},
    assets: {},
    revisions: [],
  };
}

const decisionsTemporaryPath = `${decisionsPath}.tmp`;
const decisionsBackupPath = `${decisionsPath}.bak`;

function validateDecisionsDocument(document) {
  if (
    document?.version !== 2 ||
    document.scope !== "machine-replaced-pending-human" ||
    document.bundleDigest !== bundle.digest ||
    !document.blindReviews ||
    !document.assets ||
    !Array.isArray(document.revisions) ||
    Array.isArray(document.blindReviews) ||
    Array.isArray(document.assets)
  ) {
    throw new Error("Decision store metadata does not match this review batch");
  }
  const allowedTopLevel = new Set([
    "version",
    "scope",
    "bundleDigest",
    "updatedAt",
    "blindReviews",
    "assets",
    "revisions",
  ]);
  if (Object.keys(document).some((key) => !allowedTopLevel.has(key))) {
    throw new Error("Decision store contains unknown top-level fields");
  }
  for (const [reviewId, decision] of Object.entries(document.blindReviews)) {
    const resolved = resolveReview(reviewId);
    if (
      !resolved ||
      decision.reviewId !== reviewId ||
      decision.assetId !== resolved.asset.assetId ||
      decision.assetSha256 !== resolved.asset.sha256 ||
      decision.candidateId !== resolved.asset.candidateId ||
      decision.bundleDigest !== bundle.digest ||
      (decision.duplicateOf ?? null) !==
        (resolved.queueItem.duplicateOf ?? null) ||
      !String(decision.heardText ?? "").trim()
    ) {
      throw new Error(`Decision store blind row mismatch: ${reviewId}`);
    }
  }
  for (const [assetId, decision] of Object.entries(document.assets)) {
    const asset = assetsById.get(assetId);
    const blindDecision = document.blindReviews[decision.blindReviewId];
    const blindQueueItem = queueById.get(decision.blindReviewId);
    const expectedStatus = asset
      ? resolvePromotedHumanStatus({
          humanOutcome: decision.humanOutcome,
          referenceStatus: asset.referenceStatus,
          languageId: asset.languageId,
        })
      : null;
    if (
      !asset ||
      decision.assetId !== assetId ||
      decision.assetSha256 !== asset.sha256 ||
      decision.candidateId !== asset.candidateId ||
      decision.bundleDigest !== bundle.digest ||
      !PROMOTED_HUMAN_OUTCOMES.includes(decision.humanOutcome) ||
      !blindDecision ||
      blindDecision.assetId !== assetId ||
      blindQueueItem?.duplicateOf ||
      decision.referenceStatus !== asset.referenceStatus ||
      decision.status !== expectedStatus
    ) {
      throw new Error(`Decision store final row mismatch: ${assetId}`);
    }
  }
  for (const revision of document.revisions) {
    const asset = assetsById.get(revision.assetId);
    if (
      !asset ||
      revision.version !== 1 ||
      revision.assetSha256 !== asset.sha256 ||
      revision.candidateId !== asset.candidateId ||
      revision.bundleDigest !== bundle.digest ||
      revision.reason !== "hidden-repeat-inconsistent" ||
      !Array.isArray(revision.blindReviews) ||
      revision.blindReviews.length !== 2 ||
      revision.blindReviews.some(
        (decision) =>
          decision.assetId !== asset.assetId ||
          decision.assetSha256 !== asset.sha256,
      ) ||
      revision.finalDecision?.assetId !== asset.assetId
    ) {
      throw new Error(`Decision store revision mismatch: ${revision.assetId}`);
    }
  }
  return document;
}

function quarantineInvalidDecisionFile(filePath) {
  if (!existsSync(filePath)) return;
  const quarantinePath = `${filePath}.invalid-${Date.now()}-${randomBytes(3).toString("hex")}`;
  renameSync(filePath, quarantinePath);
  console.warn(`Quarantined incompatible decision file: ${quarantinePath}`);
}

function loadDecisions() {
  for (const candidatePath of [
    decisionsTemporaryPath,
    decisionsPath,
    decisionsBackupPath,
  ]) {
    if (!existsSync(candidatePath)) continue;
    try {
      const document = validateDecisionsDocument(readJson(candidatePath));
      if (candidatePath !== decisionsPath) {
        copyFileSync(candidatePath, decisionsPath);
        if (candidatePath === decisionsTemporaryPath) {
          rmSync(decisionsTemporaryPath, { force: true });
        }
      }
      if (candidatePath === decisionsPath) {
        rmSync(decisionsTemporaryPath, { force: true });
      }
      return document;
    } catch (error) {
      console.warn(
        `Decision recovery rejected ${candidatePath}: ${String(error?.message ?? error)}`,
      );
      quarantineInvalidDecisionFile(candidatePath);
    }
  }
  return emptyDecisions();
}

const decisions = loadDecisions();

function saveDecisions() {
  decisions.updatedAt = new Date().toISOString();
  writeFileSync(
    decisionsTemporaryPath,
    `${JSON.stringify(decisions, null, 2)}\n`,
    "utf8",
  );
  validateDecisionsDocument(readJson(decisionsTemporaryPath));
  if (existsSync(decisionsPath)) {
    copyFileSync(decisionsPath, decisionsBackupPath);
  }
  try {
    copyFileSync(decisionsTemporaryPath, decisionsPath);
    validateDecisionsDocument(readJson(decisionsPath));
    rmSync(decisionsTemporaryPath, { force: true });
  } catch (error) {
    if (existsSync(decisionsBackupPath)) {
      copyFileSync(decisionsBackupPath, decisionsPath);
    }
    throw error;
  }
}

function responseJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 128 * 1024) throw new Error("Request body too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function resolveReview(reviewId) {
  const queueItem = queueById.get(reviewId);
  const asset = queueItem ? assetsById.get(queueItem.assetId) : null;
  return queueItem && asset ? { queueItem, asset } : null;
}

function alternateFor(asset) {
  return fullInventory.assets.find(
    (candidate) =>
      candidate.assetId !== asset.assetId &&
      candidate.languageId === asset.languageId &&
      candidate.text === asset.text &&
      candidate.role === asset.role &&
      candidate.voiceGender &&
      candidate.voiceGender !== asset.voiceGender,
  );
}

function compactMachineObservation(asset) {
  const whisper = machineMaps.whisper.get(asset.candidateId);
  const azure = machineMaps.azureStt.get(asset.candidateId);
  const scribe = machineMaps.scribe.get(asset.candidateId);
  return {
    whisper: whisper
      ? {
          heardText: whisper.whisper?.transcript ?? null,
          outcome: whisper.whisper?.match ?? null,
        }
      : null,
    azureStt: azure
      ? { heardText: azure.heardText, outcome: azure.outcome }
      : null,
    scribe: scribe
      ? { heardText: scribe.heardText, outcome: scribe.outcome }
      : null,
  };
}

function revealPayload(asset) {
  return {
    assetId: asset.assetId,
    text: asset.text,
    canonicalIpa: asset.canonicalIpa,
    targetUnits: asset.targetUnits,
    phonemePageIds: asset.phonemePageIds,
    referenceStatus: asset.referenceStatus,
    voiceName: asset.voiceName,
    voiceGender: asset.voiceGender,
    candidateLabel: asset.candidateLabel,
    hasAlternate: Boolean(alternateFor(asset)),
    machine: compactMachineObservation(asset),
  };
}

function publicItem(reviewId) {
  const resolved = resolveReview(reviewId);
  if (!resolved) return null;
  const blindDecision = decisions.blindReviews[reviewId] ?? null;
  const item = promotedBlindPayload({
    asset: resolved.asset,
    queueItem: resolved.queueItem,
    blindDecision,
  });
  return {
    ...item,
    reveal: blindDecision ? revealPayload(resolved.asset) : null,
  };
}

function blindSignature(decision, languageId) {
  const heardText = normalizeAuditText(decision.heardText, languageId);
  const heardIpa = String(decision.heardIpa ?? "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/gu, " ");
  return `${heardText}\u0000${heardIpa}`;
}

function repeatConsistency() {
  const pairs = bundle.queue
    .filter((item) => item.duplicateOf)
    .flatMap((item) => {
      const original = decisions.blindReviews[item.duplicateOf];
      const repeated = decisions.blindReviews[item.reviewId];
      if (!original || !repeated) return [];
      const asset = assetsById.get(item.assetId);
      return [
        blindSignature(original, asset.languageId) ===
          blindSignature(repeated, asset.languageId),
      ];
    });
  return {
    completed: pairs.length,
    score:
      pairs.length > 0
        ? Number((pairs.filter(Boolean).length / pairs.length).toFixed(4))
        : null,
  };
}

function inconsistentAssetIds() {
  return bundle.queue
    .filter((item) => item.duplicateOf)
    .flatMap((item) => {
      const original = decisions.blindReviews[item.duplicateOf];
      const repeated = decisions.blindReviews[item.reviewId];
      if (!original || !repeated) return [];
      const asset = assetsById.get(item.assetId);
      return blindSignature(original, asset.languageId) ===
        blindSignature(repeated, asset.languageId)
        ? []
        : [asset.assetId];
    });
}

function progressPayload() {
  const next = bundle.queue.find((item) => {
    if (!decisions.blindReviews[item.reviewId]) return true;
    if (item.duplicateOf) return false;
    return !decisions.assets[item.assetId];
  });
  const consistency = repeatConsistency();
  const inconsistentAssets = inconsistentAssetIds();
  const blindCompleted = Object.keys(decisions.blindReviews).length;
  const finalCompleted = Object.keys(decisions.assets).length;
  return {
    scope: "machine-replaced-pending-human",
    primaryAssetCount: bundle.assetCount,
    duplicateCount: bundle.duplicateCount,
    totalReviewItems: bundle.totalReviewItems,
    blindCompleted,
    finalCompleted,
    nextReviewId: next?.reviewId ?? null,
    breakSuggested: blindCompleted > 0 && blindCompleted % 40 === 0,
    repeatPairsCompleted: consistency.completed,
    repeatConsistency: consistency.score,
    inconsistentAssetIds: inconsistentAssets,
    revisionCount: decisions.revisions.length,
    recheckAvailable:
      blindCompleted === bundle.totalReviewItems &&
      finalCompleted === bundle.assetCount &&
      inconsistentAssets.length > 0,
    reviewComplete:
      blindCompleted === bundle.totalReviewItems &&
      finalCompleted === bundle.assetCount &&
      inconsistentAssets.length === 0,
    decisionsPath,
  };
}

function streamFile(response, relativePath, expectedSha256 = null) {
  const absolutePath = path.resolve(root, relativePath);
  if (!isWithinRoot(absolutePath) || !existsSync(absolutePath)) {
    response.writeHead(404);
    response.end();
    return;
  }
  if (expectedSha256 && sha256File(absolutePath) !== expectedSha256) {
    response.writeHead(409);
    response.end("Audio SHA changed");
    return;
  }
  const contentType = {
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
  }[path.extname(absolutePath).toLowerCase()];
  response.writeHead(200, {
    "Content-Type": contentType ?? "application/octet-stream",
    "Cache-Control": "private, max-age=300",
    "X-Content-Type-Options": "nosniff",
  });
  createReadStream(absolutePath).pipe(response);
}

if (process.argv.includes("--summary")) {
  console.log(JSON.stringify(progressPayload(), null, 2));
  process.exit(0);
}

const page = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SpeakRight · 64 条替换音频盲听</title><style>
:root{font-family:Inter,"Microsoft YaHei",sans-serif;color:#18312d;background:#f2f7f5}*{box-sizing:border-box}body{margin:0}.top{position:sticky;top:0;z-index:2;background:#fff;border-bottom:1px solid #d8e6e1;padding:14px 22px;display:flex;align-items:center;gap:16px}.brand{font-weight:800;color:#087c69}.progress{margin-left:auto;color:#60736e}.shell{max-width:900px;margin:28px auto;padding:0 18px}.card{background:#fff;border:1px solid #d8e6e1;border-radius:18px;padding:24px;box-shadow:0 10px 30px #153c3210}.stage{display:inline-flex;border-radius:999px;background:#e6f5f0;color:#087c69;padding:6px 10px;font-weight:750}.muted{color:#6b7d78}.audio{width:100%;margin:22px 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.field{display:flex;flex-direction:column;gap:7px}.field.full{grid-column:1/-1}input,textarea,select,button{font:inherit;border-radius:11px;min-height:44px}input,textarea,select{border:1px solid #b9cec7;padding:10px 12px;background:#fff}textarea{min-height:82px;resize:vertical}button{border:0;padding:0 18px;background:#087c69;color:#fff;font-weight:750;cursor:pointer}button.secondary{background:#e9f2ef;color:#24423b}button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:3px solid #62c9b0;outline-offset:2px}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.reveal{border-top:1px solid #e0ebe7;margin-top:24px;padding-top:22px}.word{font-size:42px;font-weight:850}.ipa{font-family:"Geist Mono",monospace;font-size:22px;color:#087c69}.signals{background:#f3f7f6;border-radius:12px;padding:13px;white-space:pre-wrap;font:13px/1.55 "Geist Mono",monospace;overflow:auto}.warning{background:#fff5df;color:#795100;border:1px solid #f2d287;border-radius:12px;padding:12px;margin-bottom:16px}.hidden{display:none!important}@media(max-width:640px){.grid{grid-template-columns:1fr}.field.full{grid-column:auto}.shell{margin:12px auto}.card{padding:18px}.word{font-size:34px}}
</style></head><body><header class="top"><div class="brand">SpeakRight · 替换音频真人盲听</div><div id="progress" class="progress"></div></header><main class="shell"><div id="break" class="warning hidden">已连续完成 40 条，建议休息后再继续，避免听觉疲劳。</div><section class="card"><div id="stage" class="stage">盲听</div><h1 id="title">只根据耳朵判断</h1><p id="meta" class="muted"></p><audio id="audio" class="audio" controls preload="metadata"></audio><div id="blindForm" class="grid"><label class="field"><span>你实际听到的词</span><input id="heardText" autocomplete="off" required></label><label class="field"><span>尽力写 IPA（可空）</span><input id="heardIpa" autocomplete="off"></label><label class="field"><span>把握程度</span><select id="confidence"><option value="high">高</option><option value="medium" selected>中</option><option value="low">低</option></select></label><label class="field full"><span>盲听备注</span><textarea id="blindNotes"></textarea></label></div><div id="blindActions" class="actions"><button id="submitBlind">提交盲听，再揭示答案</button></div><div id="reveal" class="reveal hidden"><div id="word" class="word"></div><div id="ipa" class="ipa"></div><p id="relations" class="muted"></p><div class="actions"><button id="alternate" class="secondary hidden">播放另一声线</button></div><pre id="signals" class="signals"></pre><div class="grid"><label class="field"><span>真人听觉结论</span><select id="outcome" required><option value="" selected disabled>请选择结论</option><option value="heard-target">听成目标词</option><option value="heard-variant">听成合法变体</option><option value="heard-different-word">听成其他词或错误发音</option><option value="audio-quality-issue">发音内容可辨，但有音质问题</option><option value="uncertain">仍无法判断</option></select></label><label class="field full"><span>揭示后依据</span><textarea id="finalNotes"></textarea></label></div><div class="actions"><button id="saveFinal">保存结论并进入下一条</button></div></div><div id="completionActions" class="actions hidden"><button id="recheck">归档并重新复核不一致项</button></div></section></main><script>
const reviewToken='${reviewToken}';let current=null;let alternateAudio=null;const $=id=>document.getElementById(id);function stopAlternate(){if(alternateAudio){alternateAudio.pause();alternateAudio.src='';alternateAudio=null}}async function api(url,options={}){const headers={...(options.headers||{}),'X-Review-Token':reviewToken};const r=await fetch(url,{...options,headers});const j=await r.json();if(!r.ok)throw new Error(j.error||'请求失败');return j}function machineText(m){return Object.entries(m||{}).map(([k,v])=>k+': '+(v?(v.heardText||'—')+' · '+(v.outcome||'—'):'无记录')).join('\\n')}async function refresh(){const p=await api('/api/progress');$('progress').textContent='盲听 '+p.blindCompleted+'/'+p.totalReviewItems+' · 定稿 '+p.finalCompleted+'/'+p.primaryAssetCount;$('break').classList.toggle('hidden',!p.breakSuggested);$('completionActions').classList.add('hidden');if(!p.nextReviewId){stopAlternate();$('audio').pause();$('title').textContent=p.reviewComplete?'64 条替换音频已完成本轮审听':'审听已完成，但匿名重复项存在不一致';$('meta').textContent=p.reviewComplete?'待参考与母语门禁完成后才能升级为正式听觉验证。':'请休息后点击下方按钮；旧判断会保留在修订历史中。';$('audio').classList.add('hidden');$('blindForm').classList.add('hidden');$('blindActions').classList.add('hidden');$('reveal').classList.add('hidden');$('completionActions').classList.toggle('hidden',!p.recheckAvailable);return}await load(p.nextReviewId)}async function load(id){stopAlternate();$('audio').pause();current=await api('/api/item?reviewId='+encodeURIComponent(id));$('stage').textContent=current.phase==='blind'?'盲听':'揭示核对';$('title').textContent=current.duplicate?'匿名一致性复核':'只根据耳朵判断';$('meta').textContent=current.languageId+' · 匿名说话人';$('audio').src='/audio/'+current.reviewId;$('audio').classList.remove('hidden');$('blindForm').classList.toggle('hidden',current.phase!=='blind');$('blindActions').classList.toggle('hidden',current.phase!=='blind');$('reveal').classList.toggle('hidden',current.phase==='blind');if(current.phase!=='blind')showReveal()}function showReveal(){const r=current.reveal;$('stage').textContent='揭示核对';$('word').textContent=r.text;$('ipa').textContent=r.canonicalIpa||'IPA 待定稿';$('relations').textContent='目标：'+(r.targetUnits||[]).join('、')+' · 页面：'+(r.phonemePageIds||[]).join('、')+' · '+r.referenceStatus;$('signals').textContent=machineText(r.machine);$('alternate').classList.toggle('hidden',!r.hasAlternate);$('alternate').onclick=()=>{stopAlternate();$('audio').pause();alternateAudio=new Audio('/audio/'+current.reviewId+'?alternate=1');alternateAudio.play()};if(current.duplicate){$('saveFinal').textContent='一致性复核已记录，进入下一条';$('outcome').closest('.field').classList.add('hidden');$('finalNotes').closest('.field').classList.add('hidden')}else{$('saveFinal').textContent='保存结论并进入下一条';$('outcome').value='';$('outcome').closest('.field').classList.remove('hidden');$('finalNotes').closest('.field').classList.remove('hidden')}}$('audio').addEventListener('play',stopAlternate);$('submitBlind').onclick=async()=>{const heardText=$('heardText').value.trim();const heardIpa=$('heardIpa').value.trim();if(!heardText){$('heardText').focus();return}current=await api('/api/blind',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reviewId:current.reviewId,heardText,heardIpa,confidence:$('confidence').value,notes:$('blindNotes').value})});$('blindForm').classList.add('hidden');$('blindActions').classList.add('hidden');$('reveal').classList.remove('hidden');showReveal()};$('saveFinal').onclick=async()=>{if(!current.duplicate){if(!$('outcome').value){$('outcome').focus();return}await api('/api/final',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reviewId:current.reviewId,humanOutcome:$('outcome').value,notes:$('finalNotes').value})})}stopAlternate();$('heardText').value='';$('heardIpa').value='';$('blindNotes').value='';$('finalNotes').value='';await refresh()};$('recheck').onclick=async()=>{await api('/api/recheck',{method:'POST'});await refresh()};refresh().catch(e=>{$('title').textContent='加载失败';$('meta').textContent=e.message});
</script></body></html>`;

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${host}:${port}`);
  if (request.headers.host?.split(":")[0] !== host) {
    response.writeHead(403);
    response.end("Loopback host required");
    return;
  }
  if (
    request.method === "POST" &&
    (request.headers.origin !== origin ||
      request.headers["x-review-token"] !== reviewToken)
  ) {
    responseJson(response, 403, { error: "Review origin or token rejected" });
    return;
  }
  try {
    if (request.method === "GET" && requestUrl.pathname === "/api/health") {
      responseJson(response, 200, {
        status: "ready",
        instanceId,
        bundleDigest: bundle.digest,
      });
      return;
    }
    if (request.method === "GET" && requestUrl.pathname === "/favicon.ico") {
      response.writeHead(204, { "Cache-Control": "public, max-age=86400" });
      response.end();
      return;
    }
    if (request.method === "GET" && requestUrl.pathname === "/") {
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Security-Policy":
          "default-src 'self'; media-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'",
        "X-Frame-Options": "DENY",
      });
      response.end(page);
      return;
    }
    if (request.method === "GET" && requestUrl.pathname === "/api/progress") {
      responseJson(response, 200, progressPayload());
      return;
    }
    if (request.method === "GET" && requestUrl.pathname === "/api/item") {
      const item = publicItem(requestUrl.searchParams.get("reviewId"));
      responseJson(
        response,
        item ? 200 : 404,
        item ?? { error: "Unknown review item" },
      );
      return;
    }
    if (request.method === "GET" && requestUrl.pathname.startsWith("/audio/")) {
      const reviewId = requestUrl.pathname.slice("/audio/".length);
      const resolved = resolveReview(reviewId);
      if (!resolved) {
        response.writeHead(404);
        response.end();
        return;
      }
      const audioAsset =
        requestUrl.searchParams.get("alternate") === "1"
          ? alternateFor(resolved.asset)
          : resolved.asset;
      if (!audioAsset) {
        response.writeHead(404);
        response.end();
        return;
      }
      if (
        requestUrl.searchParams.get("alternate") === "1" &&
        !decisions.blindReviews[reviewId]
      ) {
        response.writeHead(403);
        response.end("Blind answer required before alternate audio");
        return;
      }
      streamFile(
        response,
        audioAsset.desktopPath,
        audioAsset.assetId === resolved.asset.assetId
          ? resolved.asset.sha256
          : null,
      );
      return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/api/recheck") {
      const inconsistentAssets = inconsistentAssetIds();
      if (
        inconsistentAssets.length === 0 ||
        Object.keys(decisions.blindReviews).length !==
          bundle.totalReviewItems ||
        Object.keys(decisions.assets).length !== bundle.assetCount
      ) {
        responseJson(response, 409, {
          error: "No completed inconsistent review pair is available",
        });
        return;
      }
      const previousDecisions = structuredClone(decisions);
      for (const assetId of inconsistentAssets) {
        const asset = assetsById.get(assetId);
        const queueItems = bundle.queue.filter(
          (item) => item.assetId === assetId,
        );
        const blindReviews = queueItems.map(
          (item) => decisions.blindReviews[item.reviewId],
        );
        if (
          !asset ||
          queueItems.length !== 2 ||
          blindReviews.some((decision) => !decision) ||
          !decisions.assets[assetId]
        ) {
          for (const key of Object.keys(decisions)) delete decisions[key];
          Object.assign(decisions, previousDecisions);
          responseJson(response, 409, {
            error: `Incomplete inconsistent review pair: ${assetId}`,
          });
          return;
        }
        decisions.revisions.push({
          version: 1,
          assetId,
          assetSha256: asset.sha256,
          candidateId: asset.candidateId,
          bundleDigest: bundle.digest,
          reason: "hidden-repeat-inconsistent",
          blindReviews,
          finalDecision: decisions.assets[assetId],
          archivedAt: new Date().toISOString(),
        });
        for (const item of queueItems) {
          delete decisions.blindReviews[item.reviewId];
        }
        delete decisions.assets[assetId];
      }
      try {
        saveDecisions();
      } catch (error) {
        for (const key of Object.keys(decisions)) delete decisions[key];
        Object.assign(decisions, previousDecisions);
        throw error;
      }
      responseJson(response, 200, progressPayload());
      return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/api/blind") {
      const body = await readBody(request);
      const resolved = resolveReview(body.reviewId);
      if (!resolved) {
        responseJson(response, 404, { error: "Unknown review item" });
        return;
      }
      const heardText = String(body.heardText ?? "")
        .trim()
        .slice(0, 200);
      const heardIpa = String(body.heardIpa ?? "")
        .trim()
        .slice(0, 200);
      if (!heardText) {
        responseJson(response, 400, { error: "Heard word is required" });
        return;
      }
      if (decisions.blindReviews[body.reviewId]) {
        responseJson(response, 409, { error: "Blind answer is immutable" });
        return;
      }
      decisions.blindReviews[body.reviewId] = {
        version: 2,
        reviewId: body.reviewId,
        assetId: resolved.asset.assetId,
        assetSha256: resolved.asset.sha256,
        candidateId: resolved.asset.candidateId,
        bundleDigest: bundle.digest,
        duplicateOf: resolved.queueItem.duplicateOf,
        heardText,
        heardIpa,
        confidence: ["low", "medium", "high"].includes(body.confidence)
          ? body.confidence
          : "medium",
        notes: String(body.notes ?? "").slice(0, 2000),
        createdAt: new Date().toISOString(),
      };
      try {
        saveDecisions();
      } catch (error) {
        delete decisions.blindReviews[body.reviewId];
        throw error;
      }
      responseJson(response, 200, publicItem(body.reviewId));
      return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/api/final") {
      const body = await readBody(request);
      const resolved = resolveReview(body.reviewId);
      if (!resolved || !decisions.blindReviews[body.reviewId]) {
        responseJson(response, 409, {
          error: "Blind answer is required first",
        });
        return;
      }
      if (resolved.queueItem.duplicateOf) {
        responseJson(response, 409, {
          error: "Hidden repeat has no final decision",
        });
        return;
      }
      if (!PROMOTED_HUMAN_OUTCOMES.includes(body.humanOutcome)) {
        responseJson(response, 400, { error: "Invalid human outcome" });
        return;
      }
      if (decisions.assets[resolved.asset.assetId]) {
        responseJson(response, 409, { error: "Final decision already exists" });
        return;
      }
      decisions.assets[resolved.asset.assetId] = {
        version: 2,
        assetId: resolved.asset.assetId,
        assetSha256: resolved.asset.sha256,
        candidateId: resolved.asset.candidateId,
        bundleDigest: bundle.digest,
        humanOutcome: body.humanOutcome,
        status: resolvePromotedHumanStatus({
          humanOutcome: body.humanOutcome,
          referenceStatus: resolved.asset.referenceStatus,
          languageId: resolved.asset.languageId,
        }),
        referenceStatus: resolved.asset.referenceStatus,
        notes: String(body.notes ?? "").slice(0, 4000),
        blindReviewId: body.reviewId,
        createdAt: new Date().toISOString(),
      };
      try {
        saveDecisions();
      } catch (error) {
        delete decisions.assets[resolved.asset.assetId];
        throw error;
      }
      responseJson(response, 200, progressPayload());
      return;
    }
    responseJson(response, 404, { error: "Not found" });
  } catch (error) {
    responseJson(response, 500, { error: String(error?.message ?? error) });
  }
});

server.listen(port, host, () => {
  console.log(`SpeakRight promoted-audio reviewer: http://${host}:${port}`);
  console.log(
    `Scope: ${bundle.assetCount} assets + ${bundle.duplicateCount} hidden repeats`,
  );
  console.log(`Decisions: ${decisionsPath}`);
});
