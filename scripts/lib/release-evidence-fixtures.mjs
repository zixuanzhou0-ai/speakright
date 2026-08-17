export const RELEASE_EVIDENCE_VERSION = "1.1.0";

export const BROWSER_EVIDENCE_VIEWPORTS = [
  { id: "1280x800", width: 1280, height: 800 },
  { id: "390x844", width: 390, height: 844 },
  { id: "360x800", width: 360, height: 800 },
];

export const DESKTOP_EVIDENCE_VIEWPORTS = [
  { id: "1280x920", width: 1280, height: 920 },
  { id: "1024x800", width: 1024, height: 800 },
];

export const RELEASE_EVIDENCE_SHOTS = [
  {
    id: "guided-repeat",
    route: "/phonemes/ee",
    readySelector: '[data-smoke="guided-repeat-setup"]',
    bannerKind: "demo",
  },
  {
    id: "free-practice",
    route: "/sentences",
    readySelector: '[data-smoke="sentence-input-card"]',
    bannerKind: "demo",
  },
  {
    id: "diagnosis-example",
    route: "/assessment",
    readySelector: '[data-smoke="assessment-report-actions"]',
    bannerKind: "example-score",
  },
  {
    id: "settings",
    route: "/settings?section=labs",
    readySelector: '[data-smoke="release-status"]',
    bannerKind: "demo",
  },
  {
    id: "progress-example",
    route: "/progress",
    readySelector: '[data-smoke="learning-evidence-ladder"]',
    bannerKind: "example-score",
  },
  {
    id: "no-key",
    route: "/settings?section=services",
    readySelector: '[data-smoke="azure-missing-key-guidance"]',
    bannerKind: "no-key",
  },
];

export const EXAMPLE_SCORE_DISCLOSURE =
  "示例数据 / Example data — not a live Azure score";

export const FREE_PRACTICE_DEMO_TEXT =
  "Clear speech grows through deliberate listening and repeatable practice.";

export const DESKTOP_EVIDENCE_BROWSER_ARGUMENTS = [
  "--remote-debugging-port=0",
  "--remote-allow-origins=*",
  "--disable-background-networking",
].join(" ");

export const DESKTOP_EVIDENCE_APPLICATION_ORIGINS = Object.freeze([
  "tauri://localhost",
  "http://tauri.localhost",
]);

export const DESKTOP_EVIDENCE_INTERNAL_RESPONSE_ORIGINS = Object.freeze([
  "http://tauri.localhost",
  "http://asset.localhost",
  "http://ipc.localhost",
]);

const FIXED_TIMESTAMP = Date.UTC(2026, 7, 16, 12, 0, 0);

const diagnosisReport = {
  version: 2,
  languageId: "en-US",
  source: "quick-word-check",
  timestamp: FIXED_TIMESTAMP,
  overallScore: 72,
  scoreStatus: "scored",
  dimensions: {
    vowels: 72,
    consonants: 74,
    stress: 65,
    rhythm: 68,
    fluency: 80,
    connectedSpeech: 70,
  },
  phonemeScores: {
    th: { score: 62, sampleCount: 2 },
    ih: { score: 70, sampleCount: 2 },
  },
  issues: [
    {
      id: "demo-s-th",
      severity: "major",
      type: "contrast",
      title: "/θ/ 需要更稳定的齿间气流",
      targetPhonemes: ["th"],
      evidence: [
        {
          text: "think",
          score: 62,
          detail: "确定性演示样本：目标音的齿间摩擦需要加强。",
        },
      ],
      impact: "think、three、mouth 的清晰度可能受到影响。",
      fixCue: "舌尖轻放齿间，保持连续气流，再从单词过渡到短句。",
      recommendedPackIds: ["s-th"],
      confidence: "medium",
      evidenceStrength: "fair",
      nextLesson: {
        packId: "s-th",
        levelId: "sentence-bridge",
        reason: "先稳定目标音，再放回短句。",
      },
    },
  ],
  prescription: {
    generatedAt: FIXED_TIMESTAMP,
    source: "diagnosis",
    days: [
      {
        day: 1,
        title: "第 1 天",
        items: [
          {
            packId: "s-th",
            levelId: "sentence-bridge",
            reason: "演示诊断命中目标音",
            priority: "major",
            estimatedMinutes: 8,
            currentMasteryState: "controlled",
            nextRequiredLayer: "sentence",
            stageScore: 3,
            stageCeiling: 5,
            learningObjective: "把目标音稳定地放回短句。",
          },
        ],
      },
    ],
  },
  rawEvidence: [
    {
      text: "think",
      score: 62,
      detail: "确定性演示样本，不来自实时 Azure 请求。",
      phoneme: "th",
      ipa: "θ",
      position: "initial",
      evidenceStrength: "fair",
      recommendedAction: "use-with-caution",
      supportLevel: "independent",
      source: "word",
    },
  ],
  evidenceSummary: {
    overallStrength: "fair",
    recommendedAction: "use-with-caution",
    usableRecordings: 3,
    invalidRecordings: 0,
    totalExpectedWords: 3,
    totalObservedWords: 3,
    wordLevelEvidenceCount: 3,
    matchedReferenceWords: 3,
    referenceMatchRatio: 1,
    omissionCount: 0,
    insertionCount: 0,
    mispronunciationCount: 1,
    thinFeatureCount: 0,
    lowConfidenceFeatures: [],
    notes: ["Deterministic release-evidence fixture."],
    independentWordRecordings: 3,
    previewAssistedWordRecordings: 0,
  },
};

const masteryProfile = {
  version: 2,
  updatedAt: FIXED_TIMESTAMP,
  packs: {
    "s-th": {
      packId: "s-th",
      status: "stable",
      masteryState: "integrated",
      levelProgress: {},
      bestTargetScore: 86,
      perceptionBestRate: 0.8,
      completedSessions: 2,
      failureStreak: 0,
      lastPracticedAt: FIXED_TIMESTAMP,
    },
  },
  phonemes: {},
  errorPatterns: {},
  sessions: [
    {
      id: "release-evidence-session-1",
      packId: "s-th",
      startedAt: FIXED_TIMESTAMP - 90_000,
      completedAt: FIXED_TIMESTAMP - 30_000,
      perceptionCorrect: 4,
      perceptionTotal: 5,
      targetScores: [74, 80, 86],
      wordScores: [78, 84],
      sentenceScores: [82],
      mastered: false,
      masteryStateAfter: "integrated",
    },
  ],
};

const learningEvidence = {
  version: 3,
  updatedAt: FIXED_TIMESTAMP,
  evidence: [
    {
      id: "release-evidence-retention-s-th",
      version: 3,
      languageId: "en-US",
      taskType: "delayed-retention",
      targetUnits: ["s-th"],
      observations: [
        { metric: "target-unit", score: 86, source: "task" },
        {
          metric: "task-completion",
          text: "Deterministic example evidence; not a live assessment.",
          source: "task",
        },
      ],
      recordingQuality: { status: "good", score: 0.9, reasons: [] },
      alignmentQuality: { status: "good", score: 0.9, reasons: [] },
      sampleCount: 3,
      contextCount: 2,
      source: "training",
      confidence: "medium",
      evidenceStage: "retention_observed",
      calibrationVersion: "release-evidence-fixture-v1",
      createdAt: FIXED_TIMESTAMP,
    },
    {
      id: "release-evidence-transfer-ee-ih",
      version: 3,
      languageId: "en-US",
      taskType: "guided-transfer",
      targetUnits: ["ee-ih"],
      observations: [{ metric: "target-unit", score: 82, source: "task" }],
      recordingQuality: { status: "good", score: 0.88, reasons: [] },
      alignmentQuality: { status: "good", score: 0.87, reasons: [] },
      sampleCount: 3,
      contextCount: 2,
      source: "training",
      confidence: "medium",
      evidenceStage: "transfer_observed",
      calibrationVersion: "release-evidence-fixture-v1",
      createdAt: FIXED_TIMESTAMP - 86_400_000,
    },
    {
      id: "release-evidence-varied-l-r",
      version: 3,
      languageId: "en-US",
      taskType: "controlled-word",
      targetUnits: ["l-r"],
      observations: [{ metric: "target-unit", score: 78, source: "task" }],
      recordingQuality: { status: "good", score: 0.85, reasons: [] },
      alignmentQuality: { status: "good", score: 0.86, reasons: [] },
      sampleCount: 4,
      contextCount: 3,
      source: "training",
      confidence: "medium",
      evidenceStage: "varied",
      calibrationVersion: "release-evidence-fixture-v1",
      createdAt: FIXED_TIMESTAMP - 172_800_000,
    },
  ],
};

export const RELEASE_EVIDENCE_STORAGE = {
  theme: "light",
  speakright_language_config: JSON.stringify({ languageId: "en-US" }),
  "speakright_assessment_result_v2:en-US": JSON.stringify(diagnosisReport),
  speakright_mastery_profile_v2: JSON.stringify(masteryProfile),
  speakright_training_sessions_v2: JSON.stringify(masteryProfile.sessions),
  speakright_learning_evidence_v3: JSON.stringify(learningEvidence),
};

export function storageSeedExpression() {
  return `
(() => {
  localStorage.clear();
  sessionStorage.clear();
  const entries = ${JSON.stringify(Object.entries(RELEASE_EVIDENCE_STORAGE))};
  for (const [key, value] of entries) localStorage.setItem(key, value);
  return { ok: true, keys: entries.map(([key]) => key) };
})()
`;
}

export function evidenceBannerExpression(kind, shotId, readySelector) {
  const copy =
    kind === "example-score"
      ? EXAMPLE_SCORE_DISCLOSURE
      : kind === "no-key"
        ? "无 API Key / No API keys configured — no live provider calls"
        : "演示构建 / Deterministic demo — no live API calls";
  const palette =
    kind === "example-score"
      ? {
          background: "#7c2d12",
          border: "#fdba74",
          color: "#fff7ed",
        }
      : {
          background: "#0f766e",
          border: "#99f6e4",
          color: "#f0fdfa",
        };

  return `
(async () => {
  document.querySelector('[data-release-evidence-banner]')?.remove();
  const banner = document.createElement('div');
  banner.setAttribute('data-release-evidence-banner', ${JSON.stringify(kind)});
  banner.setAttribute('role', 'note');
  banner.textContent = ${JSON.stringify(copy)};
  Object.assign(banner.style, ${JSON.stringify({
    position: "relative",
    zIndex: "1",
    display: "block",
    width: "fit-content",
    maxWidth: "calc(100vw - 24px)",
    padding: "8px 14px",
    borderRadius: "999px",
    borderWidth: "1px",
    borderStyle: "solid",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.24)",
    fontFamily: "Inter, Arial, sans-serif",
    fontSize: "13px",
    fontWeight: "700",
    lineHeight: "1.25",
    letterSpacing: "0.01em",
    textAlign: "center",
    pointerEvents: "none",
    whiteSpace: "normal",
    background: palette.background,
    borderColor: palette.border,
    color: palette.color,
  })});
  const shotId = ${JSON.stringify(shotId)};
  const ready = document.querySelector(${JSON.stringify(readySelector)});
  let collisionRoot = document;
  if (shotId === 'guided-repeat') {
    const dialog = document.querySelector('[data-smoke="guided-repeat-dialog"]');
    const header = dialog?.firstElementChild;
    if (!dialog || !header) return { ok: false, reason: 'guided-repeat placement missing' };
    collisionRoot = dialog;
    header.insertAdjacentElement('afterend', banner);
    Object.assign(banner.style, { flexShrink: '0', margin: '8px auto 0' });
  } else if (shotId === 'no-key') {
    if (!ready?.parentElement) return { ok: false, reason: 'no-key placement missing' };
    ready.parentElement.insertBefore(banner, ready);
    Object.assign(banner.style, { margin: '0 auto 12px' });
    const main = document.querySelector('#main-content');
    const card = ready.closest('[data-smoke="azure-scoring-card"]');
    if (!main || !card) return { ok: false, reason: 'no-key scroll container missing' };
    const mainRect = main.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const centeredOffset = Math.max(12, (main.clientHeight - cardRect.height) / 2);
    main.scrollTo({
      top: Math.max(0, main.scrollTop + cardRect.top - mainRect.top - centeredOffset),
      behavior: 'instant',
    });
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  } else {
    const main = document.querySelector('#main-content');
    if (!main) return { ok: false, reason: 'main placement missing' };
    main.prepend(banner);
    Object.assign(banner.style, { margin: '10px auto 0' });
    main.scrollTop = 0;
  }

  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  if (shotId !== 'no-key') {
    document.querySelector('#main-content')?.scrollTo({ top: 0, behavior: 'instant' });
  }
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await new Promise((resolve) => setTimeout(resolve, 75));
  if (!banner.isConnected) {
    return { ok: false, reason: 'banner was replaced during client rendering' };
  }
  const bannerRect = banner.getBoundingClientRect();
  if (bannerRect.width <= 0 || bannerRect.height <= 0) {
    return { ok: false, reason: 'banner has no rendered rectangle' };
  }
  const withinViewport =
    bannerRect.left >= 0 &&
    bannerRect.top >= 0 &&
    bannerRect.right <= window.innerWidth &&
    bannerRect.bottom <= window.innerHeight;
  const previousPointerEvents = banner.style.pointerEvents;
  banner.style.pointerEvents = 'auto';
  const centerX = (bannerRect.left + bannerRect.right) / 2;
  const centerY = (bannerRect.top + bannerRect.bottom) / 2;
  const visibilityPoints = [
    [centerX, bannerRect.top + 3],
    [bannerRect.right - 3, centerY],
    [centerX, bannerRect.bottom - 3],
    [bannerRect.left + 3, centerY],
    [centerX, centerY],
  ];
  const occludedPoints = visibilityPoints.filter(([x, y]) => {
    const topElement = document.elementFromPoint(x, y);
    return !topElement || (topElement !== banner && !banner.contains(topElement));
  });
  banner.style.pointerEvents = previousPointerEvents;
  const protectedElements = [
    ...collisionRoot.querySelectorAll(
      'a,button,input,textarea,select,h1,h2,h3,h4,p,label,[role="status"],[role="alert"],[data-smoke]',
    ),
  ];
  const intersects = (left, right) =>
    Math.max(left.left, right.left) < Math.min(left.right, right.right) &&
    Math.max(left.top, right.top) < Math.min(left.bottom, right.bottom);
  const collisions = protectedElements
    .filter((element) => element !== banner)
    .filter((element) => !element.contains(banner) && !banner.contains(element))
    .filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        Number(style.opacity || 1) > 0 &&
        rect.width > 0 &&
        rect.height > 0 &&
        intersects(bannerRect, rect)
      );
    })
    .map((element) => ({
      tag: element.tagName.toLowerCase(),
      smoke: element.getAttribute('data-smoke'),
      text: (element.textContent ?? '').trim().slice(0, 80),
    }))
    .slice(0, 20);
  return {
    ok:
      collisions.length === 0 &&
      withinViewport &&
      occludedPoints.length === 0,
    text: banner.textContent,
    collisions,
    withinViewport,
    occludedPoints,
    rect: {
      left: bannerRect.left,
      top: bannerRect.top,
      right: bannerRect.right,
      bottom: bannerRect.bottom,
    },
  };
})()
`;
}
