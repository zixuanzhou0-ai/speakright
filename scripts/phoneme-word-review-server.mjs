#!/usr/bin/env node

import {
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
  WORD_AUDIT_FINAL_STATUSES,
  WORD_AUDIT_OUTPUT_NAME,
} from "./lib/phoneme-word-audit-core.mjs";
import { normalizeAuditText } from "./lib/pronunciation-audit-core.mjs";

const root = process.cwd();
const outputRoot = path.resolve(root, "outputs", WORD_AUDIT_OUTPUT_NAME);
const inventory = JSON.parse(
  readFileSync(path.join(outputRoot, "inventory.json"), "utf8"),
);
const reference = JSON.parse(
  readFileSync(path.join(outputRoot, "gold-pronunciations.json"), "utf8"),
);
const queue = JSON.parse(
  readFileSync(path.join(outputRoot, "review-queue.json"), "utf8"),
);
const decisionsPath = path.join(outputRoot, "human-auditory-decisions.json");
const portArgument = process.argv.find((value) => value.startsWith("--port="));
const port = Number(portArgument?.slice("--port=".length) ?? 43127);
const host = "127.0.0.1";

const assetById = new Map(
  inventory.assets.map((asset) => [asset.assetId, asset]),
);
const queueById = new Map(queue.items.map((item) => [item.reviewId, item]));
const goldByKey = new Map(
  reference.entries.map((entry) => [
    `${entry.languageId}\u0000${normalizeAuditText(entry.text, entry.languageId)}`,
    entry,
  ]),
);

function readJsonl(filePath) {
  if (!existsSync(filePath)) return [];
  return readFileSync(filePath, "utf8")
    .split(/\r?\n/u)
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

const machineMaps = Object.fromEntries(
  [
    ["whisper", path.join(outputRoot, "blind", "whisper-large-v3.jsonl")],
    ["azureStt", path.join(outputRoot, "blind", "azure-stt.jsonl")],
    ["gemini", path.join(outputRoot, "blind", "gemini-3.1-pro.jsonl")],
  ].map(([name, filePath]) => [
    name,
    new Map(readJsonl(filePath).map((row) => [row.sha256, row])),
  ]),
);

function emptyDecisions() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    blindReviews: {},
    assets: {},
  };
}

const decisions = existsSync(decisionsPath)
  ? JSON.parse(readFileSync(decisionsPath, "utf8"))
  : emptyDecisions();

function saveDecisions() {
  decisions.updatedAt = new Date().toISOString();
  const temporary = `${decisionsPath}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(decisions, null, 2)}\n`, "utf8");
  rmSync(decisionsPath, { force: true });
  renameSync(temporary, decisionsPath);
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
  if (!queueItem) return null;
  const asset = assetById.get(queueItem.assetId);
  if (!asset) return null;
  return { queueItem, asset };
}

function alternateFor(asset) {
  if (!asset.text || !asset.voiceGender) return null;
  return inventory.assets.find(
    (candidate) =>
      candidate.assetId !== asset.assetId &&
      candidate.languageId === asset.languageId &&
      candidate.text === asset.text &&
      candidate.role === asset.role &&
      candidate.voiceGender &&
      candidate.voiceGender !== asset.voiceGender,
  );
}

function revealPayload(reviewId, asset) {
  const gold = asset.text
    ? goldByKey.get(
        `${asset.languageId}\u0000${normalizeAuditText(asset.text, asset.languageId)}`,
      )
    : null;
  return {
    reviewId,
    assetId: asset.assetId,
    text: asset.text ?? asset.anchorLabel,
    currentIpa: asset.currentIpa,
    canonicalIpa: gold?.canonicalIpa ?? null,
    acceptedVariants: gold?.acceptedVariants ?? [],
    referenceStatus: gold?.referenceStatus ?? "human-anchor-review-required",
    pageRelations: asset.pageRelations,
    speakerId: asset.speakerId,
    voiceGender: asset.voiceGender,
    hasAlternate: Boolean(alternateFor(asset)),
    machine: Object.fromEntries(
      Object.entries(machineMaps).map(([name, map]) => [
        name,
        map.get(asset.sha256) ?? null,
      ]),
    ),
  };
}

function publicItem(reviewId) {
  const resolved = resolveReview(reviewId);
  if (!resolved) return null;
  const { queueItem, asset } = resolved;
  const blind = decisions.blindReviews[reviewId] ?? null;
  return {
    reviewId,
    languageId: asset.languageId,
    role: asset.role,
    voiceGender: asset.voiceGender,
    // Hidden repeats must remain indistinguishable until the blind answer is
    // committed, otherwise the consistency check is biased.
    duplicate: blind ? Boolean(queueItem.duplicateOf) : false,
    phase: blind ? "reveal" : "blind",
    blindDecision: blind,
    finalDecision: decisions.assets[asset.assetId] ?? null,
    reveal: blind ? revealPayload(reviewId, asset) : null,
  };
}

function progressPayload() {
  const blindCompleted = Object.keys(decisions.blindReviews).length;
  const finalCompleted = Object.keys(decisions.assets).length;
  const next = queue.items.find((item) => {
    const resolved = resolveReview(item.reviewId);
    if (!resolved) return false;
    if (!decisions.blindReviews[item.reviewId]) return true;
    if (item.duplicateOf) return false;
    return !decisions.assets[resolved.asset.assetId];
  });
  const repeatPairs = queue.items
    .filter((item) => item.duplicateOf)
    .flatMap((item) => {
      const original = decisions.blindReviews[item.duplicateOf];
      const repeated = decisions.blindReviews[item.reviewId];
      if (!original || !repeated) return [];
      const asset = assetById.get(item.assetId);
      return [
        normalizeAuditText(original.heardText, asset.languageId) ===
          normalizeAuditText(repeated.heardText, asset.languageId),
      ];
    });
  return {
    totalReviewItems: queue.items.length,
    primaryAssetCount: inventory.assetCount,
    blindCompleted,
    finalCompleted,
    nextReviewId: next?.reviewId ?? null,
    breakSuggested: blindCompleted > 0 && blindCompleted % 50 === 0,
    repeatConsistency:
      repeatPairs.length > 0
        ? Number(
            (repeatPairs.filter(Boolean).length / repeatPairs.length).toFixed(
              4,
            ),
          )
        : null,
    repeatPairsCompleted: repeatPairs.length,
  };
}

function streamAudio(response, asset) {
  const absolute = path.resolve(root, asset.desktopPath);
  if (!absolute.startsWith(path.resolve(root)) || !existsSync(absolute)) {
    response.writeHead(404);
    response.end();
    return;
  }
  const contentType = {
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
  }[path.extname(absolute).toLowerCase()];
  response.writeHead(200, {
    "Content-Type": contentType ?? "application/octet-stream",
    "Cache-Control": "private, max-age=300",
    "X-Content-Type-Options": "nosniff",
  });
  createReadStream(absolute).pipe(response);
}

const page = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SpeakRight 真实听觉审校</title><style>
:root{font-family:Inter,"Microsoft YaHei",sans-serif;color:#18312d;background:#f2f7f5}*{box-sizing:border-box}body{margin:0}.top{position:sticky;top:0;z-index:2;background:#fff;border-bottom:1px solid #d8e6e1;padding:14px 22px;display:flex;align-items:center;gap:16px}.brand{font-weight:800;color:#087c69}.progress{margin-left:auto;color:#60736e}.shell{max-width:920px;margin:28px auto;padding:0 18px}.card{background:#fff;border:1px solid #d8e6e1;border-radius:18px;padding:24px;box-shadow:0 10px 30px #153c3210}.stage{display:inline-flex;border-radius:999px;background:#e6f5f0;color:#087c69;padding:6px 10px;font-weight:750}.blind h1{font-size:28px;margin:18px 0 8px}.muted{color:#6b7d78}.audio{width:100%;margin:22px 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.field{display:flex;flex-direction:column;gap:7px}.field.full{grid-column:1/-1}input,textarea,select,button{font:inherit;border-radius:11px;min-height:44px}input,textarea,select{border:1px solid #b9cec7;padding:10px 12px;background:#fff}textarea{min-height:82px;resize:vertical}button{border:0;padding:0 18px;background:#087c69;color:#fff;font-weight:750;cursor:pointer}button.secondary{background:#e9f2ef;color:#24423b}button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:3px solid #62c9b0;outline-offset:2px}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.reveal{border-top:1px solid #e0ebe7;margin-top:24px;padding-top:22px}.word{font-size:42px;font-weight:850}.ipa{font-family:"Geist Mono",monospace;font-size:22px;color:#087c69}.signals{background:#f3f7f6;border-radius:12px;padding:13px;white-space:pre-wrap;font:13px/1.55 "Geist Mono",monospace;overflow:auto}.warning{background:#fff5df;color:#795100;border:1px solid #f2d287;border-radius:12px;padding:12px;margin-bottom:16px}.hidden{display:none!important}@media(max-width:640px){.grid{grid-template-columns:1fr}.field.full{grid-column:auto}.shell{margin:12px auto}.card{padding:18px}.word{font-size:34px}}
</style></head><body><header class="top"><div class="brand">SpeakRight · 真实听觉审校</div><div id="progress" class="progress"></div></header><main class="shell"><div id="break" class="warning hidden">已连续完成 50 条，建议休息几分钟再继续，避免听觉疲劳。</div><section class="card"><div id="stage" class="stage">盲听</div><div class="blind"><h1 id="title">只根据耳朵判断</h1><p id="meta" class="muted"></p><audio id="audio" class="audio" controls preload="metadata"></audio><div id="blindForm" class="grid"><label class="field"><span>你听到的词或音</span><input id="heardText" autocomplete="off"></label><label class="field"><span>尽力写 IPA（可空）</span><input id="heardIpa" autocomplete="off"></label><label class="field"><span>把握程度</span><select id="confidence"><option value="high">高</option><option value="medium" selected>中</option><option value="low">低</option></select></label><label class="field full"><span>盲听备注</span><textarea id="blindNotes"></textarea></label></div><div id="blindActions" class="actions"><button id="submitBlind">提交盲听，再揭示答案</button></div></div><div id="reveal" class="reveal hidden"><div id="word" class="word"></div><div id="ipa" class="ipa"></div><p id="relations" class="muted"></p><div class="actions"><button id="alternate" class="secondary hidden">播放另一声线</button></div><pre id="signals" class="signals"></pre><div class="grid"><label class="field"><span>最终结论</span><select id="status"><option value="verified-auditory">完全正确</option><option value="verified-variant">合法变体</option><option value="metadata-error">IPA/页面元数据错误</option><option value="audio-quality-fix">仅音质需修复</option><option value="confirmed-audio-error">确认发音错误</option><option value="needs-native-review">需要母语者复核</option></select></label><label class="field"><span>问题类型</span><select id="problem"><option value="none">无</option><option value="wrong-word">错词</option><option value="wrong-target">错目标音</option><option value="wrong-stress">错重音</option><option value="truncated">截断</option><option value="level-or-silence">音量/静音</option><option value="uncertain">无法判断</option></select></label><label class="field full"><span>揭示后依据</span><textarea id="finalNotes"></textarea></label></div><div class="actions"><button id="saveFinal">保存结论并进入下一条</button></div></div></section></main><script>
let current=null;const $=id=>document.getElementById(id);async function api(url,options){const r=await fetch(url,options);const j=await r.json();if(!r.ok)throw new Error(j.error||'请求失败');return j}function machineText(m){return Object.entries(m||{}).map(([k,v])=>k+': '+(v?(v.heardText||v.outcome||'有记录'):'待运行')).join('\n')}async function refresh(){const p=await api('/api/progress');$('progress').textContent='盲听 '+p.blindCompleted+'/'+p.totalReviewItems+' · 定稿 '+p.finalCompleted+'/'+p.primaryAssetCount;$('break').classList.toggle('hidden',!p.breakSuggested);if(!p.nextReviewId){$('title').textContent='全部审听项已完成';$('meta').textContent='请运行最终门禁并处理争议项。';$('audio').classList.add('hidden');$('blindForm').classList.add('hidden');$('blindActions').classList.add('hidden');return}await load(p.nextReviewId)}async function load(id){current=await api('/api/item?reviewId='+encodeURIComponent(id));$('stage').textContent=current.phase==='blind'?'盲听':'揭示核对';$('title').textContent=current.duplicate?'匿名一致性复核':'只根据耳朵判断';$('meta').textContent=current.languageId+' · '+(current.voiceGender==='masculine'?'男声':current.voiceGender==='feminine'?'女声':'音标锚点')+' · '+current.role;$('audio').src='/audio/'+current.reviewId;$('audio').classList.remove('hidden');$('blindForm').classList.toggle('hidden',current.phase!=='blind');$('blindActions').classList.toggle('hidden',current.phase!=='blind');$('reveal').classList.toggle('hidden',current.phase==='blind');if(current.phase!=='blind')showReveal()}function showReveal(){const r=current.reveal;$('stage').textContent='揭示核对';$('word').textContent=r.text||'音标锚点';$('ipa').textContent=[r.canonicalIpa,r.currentIpa&&r.currentIpa!==r.canonicalIpa?'项目：'+r.currentIpa:''].filter(Boolean).join(' · ');$('relations').textContent=(r.pageRelations||[]).map(x=>x.pageId+' → '+x.targetIpa).join('；')+' · '+r.referenceStatus;$('signals').textContent=machineText(r.machine);$('alternate').classList.toggle('hidden',!r.hasAlternate);$('alternate').onclick=()=>{const a=new Audio('/audio/'+current.reviewId+'?alternate=1');a.play()};if(current.duplicate){$('saveFinal').textContent='一致性复核已记录，进入下一条';$('status').closest('.field').classList.add('hidden');$('problem').closest('.field').classList.add('hidden');$('finalNotes').closest('.field').classList.add('hidden')}else{$('saveFinal').textContent='保存结论并进入下一条';$('status').closest('.field').classList.remove('hidden');$('problem').closest('.field').classList.remove('hidden');$('finalNotes').closest('.field').classList.remove('hidden')}}$('submitBlind').onclick=async()=>{const heardText=$('heardText').value.trim();const heardIpa=$('heardIpa').value.trim();if(!heardText&&!heardIpa){$('heardText').focus();return}current=await api('/api/blind',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reviewId:current.reviewId,heardText,heardIpa,confidence:$('confidence').value,notes:$('blindNotes').value})});$('blindForm').classList.add('hidden');$('blindActions').classList.add('hidden');$('reveal').classList.remove('hidden');showReveal()};$('saveFinal').onclick=async()=>{if(!current.duplicate)await api('/api/final',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reviewId:current.reviewId,status:$('status').value,problemType:$('problem').value,notes:$('finalNotes').value,canonicalIpa:current.reveal.canonicalIpa})});$('heardText').value='';$('heardIpa').value='';$('blindNotes').value='';$('finalNotes').value='';await refresh()};refresh().catch(e=>{$('title').textContent='加载失败';$('meta').textContent=e.message});
</script></body></html>`;

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${host}:${port}`);
  const requestHost = request.headers.host?.split(":")[0];
  if (requestHost !== host) {
    response.writeHead(403);
    response.end("Loopback host required");
    return;
  }
  try {
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
      const asset =
        requestUrl.searchParams.get("alternate") === "1"
          ? alternateFor(resolved.asset)
          : resolved.asset;
      if (!asset) {
        response.writeHead(404);
        response.end();
        return;
      }
      streamAudio(response, asset);
      return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/api/blind") {
      const body = await readBody(request);
      const resolved = resolveReview(body.reviewId);
      if (!resolved) {
        responseJson(response, 404, { error: "Unknown review item" });
        return;
      }
      decisions.blindReviews[body.reviewId] = {
        version: 1,
        reviewId: body.reviewId,
        assetId: resolved.asset.assetId,
        duplicateOf: resolved.queueItem.duplicateOf,
        heardText: String(body.heardText ?? "").slice(0, 200),
        heardIpa: String(body.heardIpa ?? "").slice(0, 200),
        confidence: ["low", "medium", "high"].includes(body.confidence)
          ? body.confidence
          : "medium",
        notes: String(body.notes ?? "").slice(0, 2000),
        createdAt: new Date().toISOString(),
      };
      saveDecisions();
      responseJson(response, 200, publicItem(body.reviewId));
      return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/api/final") {
      const body = await readBody(request);
      const resolved = resolveReview(body.reviewId);
      if (!resolved || !decisions.blindReviews[body.reviewId]) {
        responseJson(response, 409, {
          error: "Blind decision is required before reveal decision",
        });
        return;
      }
      if (!WORD_AUDIT_FINAL_STATUSES.includes(body.status)) {
        responseJson(response, 400, { error: "Invalid final status" });
        return;
      }
      const gold = resolved.asset.text
        ? goldByKey.get(
            `${resolved.asset.languageId}\u0000${normalizeAuditText(
              resolved.asset.text,
              resolved.asset.languageId,
            )}`,
          )
        : null;
      if (
        ["verified-auditory", "verified-variant"].includes(body.status) &&
        resolved.asset.text &&
        !["two-source-confirmed", "variant-confirmed"].includes(gold?.status)
      ) {
        responseJson(response, 409, {
          error:
            "该单词的权威参考尚未完成双来源定稿，暂时不能标记为听觉验证通过。",
        });
        return;
      }
      decisions.assets[resolved.asset.assetId] = {
        version: 1,
        assetId: resolved.asset.assetId,
        status: body.status,
        problemType: String(body.problemType ?? "none").slice(0, 100),
        notes: String(body.notes ?? "").slice(0, 4000),
        canonicalIpa: String(body.canonicalIpa ?? "").slice(0, 200) || null,
        blindReviewId: body.reviewId,
        createdAt: new Date().toISOString(),
      };
      saveDecisions();
      responseJson(response, 200, progressPayload());
      return;
    }
    responseJson(response, 404, { error: "Not found" });
  } catch (error) {
    responseJson(response, 500, { error: String(error?.message ?? error) });
  }
});

server.listen(port, host, () => {
  console.log(`SpeakRight auditory reviewer: http://${host}:${port}`);
  console.log(`Decisions: ${decisionsPath}`);
});
