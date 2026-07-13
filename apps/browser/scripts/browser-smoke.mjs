const baseUrl = (
  process.env.SPEAKRIGHT_BROWSER_SMOKE_URL || "http://127.0.0.1:3000"
).replace(/\/$/, "");

const routes = [
  {
    path: "/",
    includes: ["SpeakRight"],
  },
  {
    path: "/settings",
    includes: [
      'data-smoke="settings-page"',
      'data-smoke="api-key-persistence"',
      'data-smoke="language-option"',
      "基础设置",
    ],
  },
  {
    path: "/phonemes/ee?smokeScoreSummary=1",
    includes: [
      'data-smoke="phoneme-detail-left-column"',
      'aria-label="开始录音"',
    ],
  },
  {
    path: "/phonemes/es-a",
    includes: ['data-smoke="phoneme-detail-page"', "西语"],
  },
  {
    path: "/phonemes/fr-i",
    includes: ['data-smoke="phoneme-detail-page"', "法语"],
  },
  {
    path: "/phonemes/ru-a",
    includes: ['data-smoke="phoneme-detail-page"', "俄语"],
  },
  {
    path: "/sentences",
    includes: [
      'data-smoke="sentences-page"',
      'data-smoke="sentence-recording-card"',
      "开始录音",
    ],
  },
  {
    path: "/assessment",
    includes: [
      'data-smoke="assessment-page"',
      'data-smoke="assessment-start-button"',
    ],
  },
  {
    path: "/drill",
    includes: [
      'data-smoke="drill-page"',
      'data-smoke="browser-readiness-checklist"',
    ],
  },
];

const assetPaths = ["/audio/ipa/normal/cat.mp3", "/images/ipa/cat.png"];

async function checkRoute({ path, includes }) {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}`);
  }
  const html = await response.text();
  if (html.includes("__TAURI__") || html.includes("tauri://localhost")) {
    throw new Error(`${path} appears to depend on the desktop Tauri runtime`);
  }
  for (const token of includes) {
    if (!html.includes(token)) {
      throw new Error(`${path} did not render expected marker: ${token}`);
    }
  }
}

async function checkAsset(path) {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${path} asset returned HTTP ${response.status}`);
  }
}

for (const route of routes) {
  await checkRoute(route);
}

for (const assetPath of assetPaths) {
  await checkAsset(assetPath);
}

console.log(
  `Browser smoke passed for ${routes.length} routes and ${assetPaths.length} assets at ${baseUrl}.`,
);
