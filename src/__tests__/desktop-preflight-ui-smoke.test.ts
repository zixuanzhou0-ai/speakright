import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();

function readProjectFile(path: string): string {
  return readFileSync(join(projectRoot, path), "utf8");
}

function expectSmokeAlertWraps(source: string, smokeId: string) {
  const marker = `data-smoke="${smokeId}"`;
  const markerIndex = source.indexOf(marker);
  expect(markerIndex, `${smokeId} marker`).toBeGreaterThanOrEqual(0);

  const alertSource = source.slice(
    Math.max(0, markerIndex - 300),
    markerIndex + 500,
  );
  expect(alertSource, `${smokeId} break-words`).toContain("break-words");
  expect(alertSource, `${smokeId} overflow-wrap`).toContain(
    "[overflow-wrap:anywhere]",
  );
}

function expectSmokeElementUsesWrapSafeClass(
  source: string,
  smokeId: string,
  className: string,
) {
  const marker = `data-smoke="${smokeId}"`;
  const markerIndex = source.indexOf(marker);
  expect(markerIndex, `${smokeId} marker`).toBeGreaterThanOrEqual(0);

  const elementSource = source.slice(
    Math.max(0, markerIndex - 260),
    markerIndex + 260,
  );
  expect(elementSource, `${smokeId} wrap-safe class`).toContain(className);
  expect(elementSource, `${smokeId} no nowrap`).not.toContain(
    "whitespace-nowrap",
  );
}

describe("desktop preflight and UI smoke", () => {
  it("wires a preflight command before desktop release builds", () => {
    const packageJson = JSON.parse(readProjectFile("package.json")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["desktop:preflight"]).toContain(
      "desktop-preflight.mjs",
    );
    expect(packageJson.scripts["desktop:preflight:build"]).toContain(
      "--allow-missing-release-exe",
    );
    expect(packageJson.scripts["validate:desktop"]).toContain(
      "desktop:preflight:build",
    );
    expect(
      packageJson.scripts["validate:desktop"].indexOf("desktop:preflight"),
    ).toBeLessThan(
      packageJson.scripts["validate:desktop"].indexOf("desktop:build"),
    );
  });

  it("fails preflight with a clear prompt when speakright.exe is running", () => {
    const script = readProjectFile("scripts/desktop-preflight.mjs");

    expect(script).toContain("tasklist.exe");
    expect(script).toContain("IMAGENAME eq speakright.exe");
    expect(script).toContain("speakright.exe is already running");
    expect(script).toContain("Close the desktop app before building");
    expect(script).not.toContain("taskkill");
    expect(script).not.toContain("Stop-Process");
  });

  it("checks the release executable and static desktop configuration", () => {
    const script = readProjectFile("scripts/desktop-preflight.mjs");

    expect(script).toContain("E:\\\\SpeakRightDesktopRepo");
    expect(script).toContain("com.speakright.desktop");
    expect(script).toContain("../out");
    expect(script).toContain("release executable is missing");
    expect(script).toContain(
      "release executable is older than the static export",
    );
    expect(script).toContain(
      "Run npm run desktop:build before Release EXE validation or launch",
    );
    expect(script).toContain("releaseFreshnessToleranceMs");
    expect(script).toContain("newestFileMtimeMs");
    expect(script).toContain("!allowMissingReleaseExe");
    expect(script).toContain("does not start localhost");
  });

  it("launch-release refuses stale static-export packages before opening the app", () => {
    const script = readProjectFile("scripts/desktop-launch-release.mjs");

    expect(script).toContain(
      "release executable is older than the static export",
    );
    expect(script).toContain(
      "Run npm run desktop:build before launching the Release EXE",
    );
    expect(script).toContain("Do not use localhost/dev server as a substitute");
    expect(script).toContain("assertReleaseExecutableFresh();");
    expect(script.indexOf("assertReleaseExecutableFresh();")).toBeLessThan(
      script.indexOf("const running = await runningSpeakRightProcesses();"),
    );
  });

  it("wires a release UI smoke command into local desktop validation", () => {
    const packageJson = JSON.parse(readProjectFile("package.json")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["desktop:ui-smoke"]).toContain(
      "desktop-ui-smoke.mjs",
    );
    expect(packageJson.scripts["validate:desktop"]).toContain(
      "desktop:ui-smoke",
    );
    expect(
      packageJson.scripts["validate:desktop"].indexOf("desktop:artifact-smoke"),
    ).toBeLessThan(
      packageJson.scripts["validate:desktop"].indexOf("desktop:ui-smoke"),
    );
  });

  it("opens key release routes without recording or ElevenLabs generation", () => {
    const script = readProjectFile("scripts/desktop-ui-smoke.mjs");

    expect(script).toContain("/settings");
    expect(script).toContain("/phonemes/ee");
    expect(script).toContain("/phonemes/es-a");
    expect(script).toContain("/phonemes/fr-i");
    expect(script).toContain("/phonemes/ru-a");
    expect(script).toContain("/drill");
    expect(script).toContain("/drill/word");
    expect(script).toContain("/drill/sentence");
    expect(script).toContain("/drill/contrast");
    expect(script).toContain("assertEnglishCoreDrillRoutes");
    expect(script).toContain("englishCoreDrillRoutes=ok");
    expect(script).toContain("word-drill-config-card");
    expect(script).toContain("sentence-drill-config-card");
    expect(script).toContain("contrast-config-card");
    expect(script).toContain("/drill/prosody");
    expect(script).toContain("prosodyHooksReady");
    expect(script).toContain("prosody-exercise-header");
    expect(script).toContain("/drill/perception");
    expect(script).toContain("perceptionHooksReady");
    expect(script).toContain("perception-experimental-blocker");
    expect(script).toContain("/drill/scenarios");
    expect(script).toContain("/drill/spontaneous");
    expect(script).toContain("assertEnglishTransferRoutes");
    expect(script).toContain("englishTransferRoutes=ok");
    expect(script).toContain("scenario-prompt-card");
    expect(script).toContain("spontaneous-recording-card");
    expect(script).toContain("/drill/evidence");
    expect(script).toContain("/drill/pack/ee-ih");
    expect(script).toContain("evidence-page");
    expect(script).toContain("evidence-experimental-blocker");
    expect(script).toContain("pack-runner-page");
    expect(script).toContain("pack-runner-intro-card");
    expect(script).toContain("pack-runner-course-map");
    expect(script).toContain("pack-runner-experimental-blocker");
    expect(script).toContain("assertAdvancedDirectRoutes");
    expect(script).toContain("advancedDirectRoutes=ok");
    expect(script).toContain("assertCorruptLocalDataWarnings");
    expect(script).toContain("corruptLocalDataWarnings=ok");
    expect(script).toContain("/sentences");
    expect(script).toContain("selector: '[data-smoke=\"sentences-page\"]'");
    expect(script).toContain("sentenceHooksReady");
    expect(script).toContain("sentence-input-card");
    expect(script).toContain("sentence-recording-card");
    expect(script).toContain("/assessment");
    expect(script).toContain("assessmentHooksReady");
    expect(script).toContain("assessment-intro-card");
    expect(script).toContain("assessment-start-button");
    expect(script).toContain("assessment-passage-link");
    expect(script).toContain("/assessment/passage");
    expect(script).toContain("assessment-passage-page");
    expect(script).toContain("assessment-passage-intro-card");
    expect(script).toContain("assessment-passage-experimental-blocker");
    expect(script).toContain("/progress");
    expect(script).toContain("assertEnglishProgressArchive");
    expect(script).toContain("progress-benchmark-row");
    expect(script).toContain("progress-recent-session-row");
    expect(script).toContain("progress-recent-session-title");
    expect(script).toContain("speakright_mastery_profile_v2");
    expect(script).toContain("speakright_assessment_result_v2:en-US");
    expect(script).toContain("speakright_assessment_result_v2:coverage:en-US");
    expect(script).toContain("assessment-storage-warning");
    expect(script).toContain("drill-report-storage-warning");
    expect(script).toContain("progress-mastery-storage-warning");
    expect(script).toContain("evidence-mastery-storage-warning");
    expect(script).toContain("assessment-passage-storage-warning");
    expect(script).toContain("上次快速诊断报告无法读取");
    expect(script).toContain("本机训练进度数据无法读取");
    expect(script).toContain("上次诊断报告无法读取");
    expect(script).toContain("上次全音诊断报告无法读取");
    expect(script).toContain("重置本机学习数据");
    expect(script).toContain("speakright_benchmark_recordings_v1");
    expect(script).toContain("progress missing benchmark audio warning");
    expect(script).toContain("direct: true");
    expect(script).toContain("progress-experimental-blocker");
    expect(script).toContain("routes=");
    expect(script).toContain("smokeSummaryRoutes.join");
    expect(script).toContain('"/drill/scenarios"');
    expect(script).toContain('"/drill/spontaneous"');
    expect(script).toContain("releaseServedFromDevServer=false");
    expect(script).toContain('data-smoke="language-option"');
    expect(script).toContain("textIsCentered");
    expect(script).toContain('textAlign === "center"');
    expect(script).toContain("assertNarrowViewportRoutes");
    expect(script).toContain("experimentalDrillBoundaryReady");
    expect(script).toContain("drill-experimental-boundary-warning");
    expect(script).toContain("不会用整词分冒充掌握证据");
    expect(script).toContain("narrowViewport=ok");
    expect(script).toContain("assertLowHeightViewportRoutes");
    expect(script).toContain("lowHeightViewport=ok");
    expect(script).toContain("window.innerHeight === 560");
    expect(script).toContain("assessment-breakdown-placeholder");
    expect(script).toContain("assessment-target-ipa-reference");
    expect(script).toContain("breakdownSmokeReady");
    expect(script).toContain("breakdownViewportSmokeReady");
    expect(script).toContain("assertScoringTileAudioPolicy");
    expect(script).toContain("smokeAssessmentTiles=1");
    expect(script).toContain("assessment-phoneme-tile-fixture");
    expect(script).toContain("assessment-phoneme-tile");
    expect(script).toContain("assessment-phoneme-audio-hint");
    expect(script).toContain("sound-unit-header-audio");
    expect(script).toContain("headerPolicyIsStrict");
    expect(script).toContain("hasTileMatchingHeader");
    expect(script).toContain("有本地音频的片段可点击");
    expect(script).toContain("data-audio-max-duration-ms");
    expect(script).toContain("data-audio-start-ms");
    expect(script).toContain("headerPolicy.startMs <= 25");
    expect(script).toContain("tile.startMs === headerPolicy.startMs");
    expect(script).toContain("tileAudioPolicyReady");
    expect(script).toContain("hasPlayableExactHeaderClip");
    expect(script).toContain("hasLockedUnverifiedTile");
    expect(script).toContain("tilePoliciesAreStrict");
    expect(script).toContain('tile.role === ""');
    expect(script).toContain('tile.tabIndex === "-1"');
    expect(script).toContain('tile.role === "button"');
    expect(script).toContain('tile.tabIndex === "0"');
    expect(script).toContain("scoringTileAudioPolicy=ok");
    expect(script).toContain("usage-history-target");
    expect(script).toContain("pronunciation-test-row");
    expect(script).toContain("data-control-api-key-toggle-row");
    expect(script).toContain("data-control-corrupt-data-warning");
    expect(script).toContain("speakright_corrupt_data_v1");
    expect(script).toContain("默认不会删除 API keys");
    expect(script).toContain("settings reset-data dialog toggle row");
    expect(script).toContain("azure-config-actions");
    expect(script).toContain("tts-config-actions");
    expect(script).toContain("llm-config-actions");
    expect(script).toContain("tts-voice-select");
    expect(script).toContain("tts-model-select");
    expect(script).toContain("ttsSelectsWrap");
    expect(script).toContain("settingsBadgesWrap");
    expect(script).toContain("settingsTextButtonsWrap");
    expect(script).toContain("childrenDoNotOverlap");
    expect(script).toContain("pronunciationRowsWrap");
    expect(script).toContain("settingsActionRowsWrap");
    expect(script).toContain("llm-provider-chip");
    expect(script).toContain("GLM / Z.ai");
    expect(script).toContain("Xiaomi MiMo");
    expect(script).toContain("llmProvidersWrap");
    expect(script).toContain("practice-voice-selector");
    expect(script).toContain("voiceSelectorReady");
    expect(script).toContain("practice-word-audio");
    expect(script).toContain("wordAudioReady");
    expect(script).toContain("expectPracticeAudioLabelIncludes");
    expect(script).toContain("expectedPracticeAudioLabelIncludes");
    expect(script).toContain('ariaLabel !== "播放单词发音"');
    expect(script).toContain("practiceAudioLabels=ok");
    expect(script).toContain("freePracticeSmoke=ok");
    const sentencesPage = readProjectFile("src/app/sentences/page.tsx");
    expect(sentencesPage).toContain('data-smoke="sentences-page"');
    expect(sentencesPage).toContain('data-smoke="free-practice-clear-session"');
    expect(sentencesPage).toContain(
      "mb-2 flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
    );
    expect(sentencesPage).toContain("break-words text-2xl font-bold");
    expect(sentencesPage).toContain(
      "inline-flex h-auto min-h-7 max-w-full items-center justify-center gap-1 whitespace-normal break-words",
    );
    expect(sentencesPage).toContain(
      "break-words text-muted-foreground [overflow-wrap:anywhere]",
    );
    expect(sentencesPage).toContain(
      "break-words rounded-lg border border-amber-300/60",
    );
    const sentenceInputCard = readProjectFile(
      "src/components/sentences/sentence-input-card.tsx",
    );
    expect(sentenceInputCard).toContain("free-practice-word-audio-error");
    expect(sentenceInputCard).toContain("free-practice-tts-error");
    expect(sentenceInputCard).toContain("free-practice-target-pack-badge");
    expect(sentenceInputCard).toContain("free-practice-suggestion-pack-badge");
    expect(sentenceInputCard).toContain(
      "h-auto min-h-5 max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]",
    );
    const sentenceRecordingCard = readProjectFile(
      "src/components/sentences/sentence-recording-card.tsx",
    );
    expect(sentenceRecordingCard).toContain("free-practice-recorder-error");
    expect(sentenceRecordingCard).toContain("free-practice-assess-error");
    expectSmokeAlertWraps(
      sentenceRecordingCard,
      "free-practice-recorder-error",
    );
    expectSmokeAlertWraps(sentenceRecordingCard, "free-practice-assess-error");
    expectSmokeAlertWraps(
      sentenceRecordingCard,
      "free-practice-local-save-error",
    );
    const sentenceResultsColumn = readProjectFile(
      "src/components/sentences/sentence-results-column.tsx",
    );
    expect(sentenceResultsColumn).toContain("WRAP_SAFE_BADGE_CLASS");
    expect(sentenceResultsColumn).toContain(
      'data-smoke="free-practice-transfer-status-badge"',
    );
    expect(sentenceResultsColumn).toContain(
      'data-smoke="free-practice-transfer-score-badge"',
    );
    expect(sentenceResultsColumn).toContain(
      'data-smoke="free-practice-transfer-matched-words"',
    );
    expect(sentenceResultsColumn).toContain("matchedWordsText");
    expect(sentenceResultsColumn).not.toContain("matchedWords.slice(0, 6)");
    expect(sentenceResultsColumn).toContain(
      "h-auto min-h-5 max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]",
    );
    const freePracticeTransfer = readProjectFile(
      "src/lib/free-practice-transfer.ts",
    );
    expect(freePracticeTransfer).toContain("const matchedWords = unique(targetWords);");
    expect(freePracticeTransfer).not.toContain("unique(targetWords).slice(0, 6)");
    const drillPhonemeLesson = readProjectFile(
      "src/components/drill/drill-phoneme-lesson.tsx",
    );
    expect(drillPhonemeLesson).toContain("示例文本（点击听发音）");
    expect(drillPhonemeLesson).toContain(
      'data-smoke="drill-lesson-example-list"',
    );
    expect(drillPhonemeLesson).toContain(
      'data-smoke="drill-lesson-example"',
    );
    expect(drillPhonemeLesson).toContain("phoneme.keywords.map");
    expect(drillPhonemeLesson).not.toContain("phoneme.keywords.slice(0, 6)");
    expect(drillPhonemeLesson).not.toContain("示例单词（点击听发音）");
    const wordPronunciationHook = readProjectFile(
      "src/hooks/use-word-pronunciation.ts",
    );
    expect(wordPronunciationHook).toContain("isStaleRequest");
    expect(wordPronunciationHook).toContain("playRequestIdRef.current");
    expect(wordPronunciationHook).toContain(
      "if (isStaleRequest(requestId)) return;",
    );
    expect(script).toContain("assessmentSmoke=ok");
    expect(script).toContain("aria-disabled");
    expect(script).toContain("videoSelectorReady");
    expect(script).toContain("videoSelectorCount");
    expect(script).toContain("headerAudioReady");
    expect(script).toContain('.includes("发音")');
    expect(script).not.toContain("MediaRecorder");
    expect(script).not.toContain("elevenlabs");
    expect(script).not.toContain("generate-word-audio");
  });

  it("keeps Settings and usage text from falling back to ellipsis", () => {
    const languageCard = readProjectFile(
      "src/components/settings/language-config-card.tsx",
    );
    const usageMonitor = readProjectFile(
      "src/components/settings/usage-monitor.tsx",
    );
    const pronunciationCard = readProjectFile(
      "src/components/settings/pronunciation-config-card.tsx",
    );
    const languageAvailabilityCard = readProjectFile(
      "src/components/settings/language-availability-card.tsx",
    );
    const releaseCard = readProjectFile(
      "src/components/settings/release-card.tsx",
    );
    const llmCard = readProjectFile(
      "src/components/settings/llm-config-card.tsx",
    );
    const azureCard = readProjectFile(
      "src/components/settings/azure-config-card.tsx",
    );
    const elevenLabsCard = readProjectFile(
      "src/components/settings/elevenlabs-config-card.tsx",
    );
    const connectionStatus = readProjectFile(
      "src/components/settings/connection-status.tsx",
    );
    const select = readProjectFile("src/components/ui/select.tsx");
    const badge = readProjectFile("src/components/ui/badge.tsx");
    const button = readProjectFile("src/components/ui/button.tsx");

    expect(languageCard).toContain('data-smoke="language-option-missing"');
    expect(languageCard).toContain("overflow-wrap:anywhere");
    expect(languageCard).toContain('audit.missingCapabilities.join("、")');
    expect(languageCard).not.toContain("missingPreview");
    expect(languageCard).not.toContain("…");
    expect(languageCard).not.toContain("line-clamp");
    expect(usageMonitor).toContain('data-smoke="usage-history-target"');
    expect(usageMonitor).toContain('data-smoke="elevenlabs-usage-empty"');
    expect(usageMonitor).toContain("未配置 ElevenLabs API Key");
    expect(usageMonitor).toContain("ElevenLabs 用量查询失败");
    expect(usageMonitor).toContain("本地单词音频");
    expect(usageMonitor).toContain(
      'role={isNotConfigured ? "status" : "alert"}',
    );
    expect(usageMonitor).toContain("overflow-wrap:anywhere");
    expect(usageMonitor).toContain("flex flex-wrap items-center gap-4");
    expect(usageMonitor).toContain(
      "flex flex-wrap items-center justify-between gap-2",
    );
    expect(usageMonitor).toContain(
      "h-auto min-h-6 max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]",
    );
    expect(usageMonitor).not.toContain("truncate");
    expect(pronunciationCard).toContain('data-smoke="pronunciation-test-row"');
    expect(pronunciationCard).toContain("flex flex-wrap items-center gap-3");
    expect(pronunciationCard).toContain(
      "WRAP_SAFE_SETTINGS_ACTION_BUTTON_CLASS",
    );
    expect(pronunciationCard).toContain(
      "h-auto min-h-8 max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]",
    );
    expect(azureCard).toContain('data-smoke="azure-config-actions"');
    expect(azureCard).toContain("flex flex-wrap items-center gap-3");
    expect(azureCard).toContain("WRAP_SAFE_SETTINGS_ACTION_BUTTON_CLASS");
    expect(azureCard).toContain(
      "h-auto min-h-8 max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]",
    );
    expect(elevenLabsCard).toContain('data-smoke="tts-config-actions"');
    expect(elevenLabsCard).toContain('data-smoke="tts-voice-select"');
    expect(elevenLabsCard).toContain('data-smoke="tts-model-select"');
    expect(elevenLabsCard).toContain("flex flex-wrap items-center gap-3");
    expect(elevenLabsCard).toContain(
      "WRAP_SAFE_SETTINGS_ACTION_BUTTON_CLASS",
    );
    expect(elevenLabsCard).toContain(
      "h-auto min-h-8 max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]",
    );
    expect(languageAvailabilityCard).toContain(
      "data-smoke={`language-availability-",
    );
    expect(languageAvailabilityCard).toContain("检查中");
    expect(languageAvailabilityCard).toContain("缺失或不可读");
    expect(languageAvailabilityCard).toContain("重新安装最新版桌面端");
    expect(languageAvailabilityCard).toContain("overflow-wrap:anywhere");
    expect(languageAvailabilityCard).toContain("WRAP_SAFE_LANGUAGE_BADGE_CLASS");
    expect(languageAvailabilityCard).toContain(
      'data-smoke="language-availability-status-badge"',
    );
    expect(languageAvailabilityCard).toContain(
      'data-smoke="language-availability-recommendation"',
    );
    expect(languageAvailabilityCard).toContain(
      "h-auto min-h-5 max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]",
    );
    expect(releaseCard).toContain("WRAP_SAFE_RELEASE_BADGE_CLASS");
    expect(releaseCard).toContain("WRAP_SAFE_RELEASE_LINK_CLASS");
    expect(releaseCard).toContain('data-smoke="release-version-badge"');
    expect(releaseCard).toContain('data-smoke="release-channel-badge"');
    expect(releaseCard).toContain('data-smoke="release-repository-link"');
    expect(releaseCard).toContain('data-smoke="release-notes-link"');
    expect(releaseCard).toContain(
      "h-auto min-h-7 max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]",
    );
    expect(llmCard).toContain('data-smoke="llm-provider-chip"');
    expect(llmCard).toContain('data-smoke="llm-manual-provider-note"');
    expect(llmCard).toContain('data-smoke="llm-config-actions"');
    expect(llmCard).toContain("flex flex-wrap items-center gap-3");
    expect(llmCard).toContain("WRAP_SAFE_SETTINGS_ACTION_BUTTON_CLASS");
    expect(llmCard).toContain(
      "h-auto min-h-8 max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]",
    );
    expect(llmCard).toContain("break-words");
    expect(connectionStatus).toContain(
      'data-smoke="settings-connection-status"',
    );
    expect(connectionStatus).toContain(
      'role={state === "error" ? "alert" : "status"}',
    );
    expect(connectionStatus).toContain("aria-live");
    expect(connectionStatus).toContain("basis-48");
    expect(connectionStatus).toContain("overflow-wrap:anywhere");
    expect(select).toContain("data-slot=\"select-trigger\"");
    expect(select).toContain("data-slot=\"select-value\"");
    expect(select).toContain("min-h-8 w-full max-w-full");
    expect(select).toContain("whitespace-normal");
    expect(select).toContain("break-words");
    expect(select).toContain("[overflow-wrap:anywhere]");
    expect(select).not.toContain("line-clamp");
    expect(select).not.toContain("whitespace-nowrap");
    expect(badge).toContain("data-slot");
    expect(badge).toContain("min-h-5");
    expect(badge).toContain("max-w-full");
    expect(badge).toContain("text-center");
    expect(badge).toContain("break-words");
    expect(badge).toContain("whitespace-normal");
    expect(badge).toContain("[overflow-wrap:anywhere]");
    expect(badge).not.toContain("overflow-hidden");
    expect(badge).not.toContain("whitespace-nowrap");
    expect(button).toContain("data-slot=\"button\"");
    expect(button).toContain("text-center");
    expect(button).toContain("break-words");
    expect(button).toContain("whitespace-normal");
    expect(button).toContain("[overflow-wrap:anywhere]");
    expect(button).toContain("min-h-8");
    expect(button).toContain("min-h-7");
    expect(button).toContain("min-h-9");
    expect(button).toContain('icon: "size-8"');
    expect(button).not.toContain("whitespace-nowrap");
  });

  it("keeps Settings data-control operation results visible inline", () => {
    const dataControlCard = readProjectFile(
      "src/components/settings/data-control-card.tsx",
    );
    const dataRegistry = readProjectFile("src/lib/data-registry.ts");

    expect(dataControlCard).toContain('data-smoke="data-control-status"');
    expect(dataControlCard).toContain(
      'data-smoke="data-control-dialog-status"',
    );
    expect(dataControlCard).toContain(
      'data-smoke="data-control-api-key-toggle-row"',
    );
    expect(dataControlCard).toContain(
      'data-smoke="data-control-corrupt-data-warning"',
    );
    expect(dataControlCard).toContain(
      'data-smoke="data-control-summary-warning"',
    );
    expect(dataControlCard).toContain(
      "flex flex-col gap-3 rounded-lg border bg-muted/25 p-3 sm:flex-row sm:items-center sm:justify-between",
    );
    expect(dataControlCard).toContain(
      'role={status.tone === "error" ? "alert" : "status"}',
    );
    expect(dataControlCard).toContain("getDataControlErrorMessage");
    expect(dataControlCard).toContain("导出学习数据失败");
    expect(dataControlCard).toContain("删除 API keys 失败");
    expect(dataControlCard).toContain("本机安全存储或设置存储不可用");
    expect(dataControlCard).toContain("已隔离 {summary.corruptItems}");
    expect(dataControlCard).toContain("导出学习数据或诊断包");
    expect(dataControlCard).toContain("清空 benchmark 音频");
    expect(dataControlCard).toContain(
      "h-auto min-h-8 max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]",
    );
    expect(dataControlCard).toContain("LOCAL_DATA_SUMMARY_UNAVAILABLE_MESSAGE");
    expect(dataRegistry).toContain("本机数据摘要暂时无法读取");
    expect(dataControlCard).toContain("默认不会删除 API keys");
    expect(dataControlCard).toContain("overflow-wrap:anywhere");
    expect(dataControlCard).toContain("toast.error(message)");
    expect(dataControlCard).toContain("toast.success(message)");
  });

  it("keeps standard TTS errors user-facing before rendering them", () => {
    const useTts = readProjectFile("src/hooks/use-tts.ts");
    const useTtsAligned = readProjectFile("src/hooks/use-tts-aligned.ts");
    const ttsErrors = readProjectFile("src/lib/tts-errors.ts");

    expect(useTts).toContain("normalizeStandardTtsError");
    expect(useTtsAligned).toContain("normalizeStandardTtsError");
    expect(useTts).not.toContain("e.message");
    expect(useTtsAligned).not.toContain("e.message");
    expect(ttsErrors).toContain("无法连接 ElevenLabs");
    expect(ttsErrors).toContain("本地标准示范缓存不可用");
  });

  it("keeps quick assessment recording and scoring failures visible inline", () => {
    const assessmentPage = readProjectFile("src/app/assessment/page.tsx");
    const assessmentReportStorage = readProjectFile(
      "src/lib/assessment-report-storage.ts",
    );
    const assessmentReport = readProjectFile(
      "src/components/assessment/assessment-report.tsx",
    );
    const passagePage = readProjectFile("src/app/assessment/passage/page.tsx");
    const azureHook = readProjectFile("src/hooks/use-azure-assessment.ts");
    const recorderAlerts =
      assessmentPage.match(/data-smoke="assessment-recorder-error"/g) ?? [];
    const azureAlerts =
      assessmentPage.match(/data-smoke="assessment-azure-error"/g) ?? [];

    expect(recorderAlerts).toHaveLength(2);
    expect(azureAlerts).toHaveLength(2);
    expect(assessmentPage).toContain('role="alert"');
    expect(assessmentPage).toContain("{recorder.error}");
    expect(assessmentPage).toContain("{azure.error}");
    expect(assessmentPage).toContain("{wordAudio.error}");
    expect(assessmentPage).toContain("{paragraphAudio.error}");
    expect(assessmentPage).toContain(
      "flex min-w-0 flex-wrap justify-center gap-1.5",
    );
    expect(assessmentPage).toContain(
      "max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]",
    );
    expect(assessmentPage).toContain("WRAP_SAFE_ACTION_BUTTON_CLASS");
    expect(assessmentPage).toContain(
      "h-auto min-h-8 max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]",
    );
    expect(assessmentPage).toContain(
      "break-words text-xs text-muted-foreground [overflow-wrap:anywhere]",
    );
    expect(
      assessmentPage.match(
        /max-w-md break-words text-center text-sm text-destructive \[overflow-wrap:anywhere\]/g,
      ) ?? [],
    ).toHaveLength(4);
    expect(assessmentPage).toContain(
      "mx-auto max-w-md break-words text-center text-xs text-destructive [overflow-wrap:anywhere]",
    );
    expect(assessmentPage).toContain(
      "mx-auto mt-2 max-w-md break-words text-center text-xs text-destructive [overflow-wrap:anywhere]",
    );
    expect(assessmentPage).toContain(
      "break-words text-red-700 [overflow-wrap:anywhere]",
    );
    expect(assessmentPage).toContain('data-smoke="assessment-storage-warning"');
    expect(assessmentPage).toContain("loadAssessmentReportForLanguage");
    expect(assessmentReportStorage).toContain("上次快速诊断报告无法读取");
    expect(assessmentReport).toContain(
      'data-smoke="assessment-report-evidence-row"',
    );
    expect(assessmentReport).toContain(
      'data-smoke="assessment-report-issue-card"',
    );
    expect(assessmentReport).toContain(
      'data-smoke="assessment-report-issue-evidence"',
    );
    expect(assessmentReport).toContain("result.rawEvidence.map");
    expect(assessmentReport).toContain("result.issues.map");
    expect(assessmentReport).toContain("issue.evidence.map");
    expect(assessmentReport).toContain("issue.errorPatternIds?.map");
    expect(assessmentReport).not.toContain("result.issues.slice(0, 3)");
    expect(assessmentReport).not.toContain("issue.evidence[0]");
    expect(assessmentReport).not.toContain("rawEvidence.slice(0, 8)");
    expect(assessmentReport).not.toContain("errorPatternIds?.slice(0, 2)");
    expect(assessmentPage).not.toContain('message: azure.error || "评估失败"');

    expect(passagePage).toContain(
      'data-smoke="assessment-passage-recorder-error"',
    );
    expect(passagePage).toContain('data-smoke="assessment-passage-page"');
    expect(passagePage).toContain('data-smoke="assessment-passage-intro-card"');
    expect(passagePage).toContain('data-smoke="assessment-passage-text-card"');
    expect(passagePage).toContain(
      'data-smoke="assessment-passage-target-pack-badge"',
    );
    expect(passagePage).toContain(
      'data-smoke="assessment-passage-feature-badge"',
    );
    expect(passagePage).toContain(
      'data-smoke="assessment-passage-evidence-word-badge"',
    );
    expect(passagePage).toContain(
      "h-auto min-h-5 max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]",
    );
    expect(passagePage).toContain('data-smoke="assessment-passage-prompt-text"');
    expect(passagePage).toContain(
      "break-words rounded-xl bg-muted/35 p-5 text-xl leading-9 [overflow-wrap:anywhere]",
    );
    expect(passagePage).toContain(
      "break-words text-sm text-muted-foreground [overflow-wrap:anywhere]",
    );
    expect(passagePage).toContain(
      "mt-2 break-words text-xl font-bold [overflow-wrap:anywhere]",
    );
    expect(passagePage).toContain("mt-3 flex flex-wrap justify-center gap-2");
    expect(passagePage).toContain(
      'data-smoke="assessment-passage-start-button"',
    );
    expect(passagePage).toContain(
      'data-smoke="assessment-passage-experimental-blocker"',
    );
    expect(passagePage).toContain(
      'data-smoke="assessment-passage-storage-warning"',
    );
    expect(passagePage).toContain("上次全音诊断报告无法读取");
    expect(passagePage).toContain("重置本机学习数据");
    expect(passagePage).toContain("canRecordFormalMastery(languageId)");
    expect(passagePage).toContain("英语全音覆盖文章");
    expect(passagePage).toContain('data-smoke="assessment-passage-error"');
    expect(passagePage).toContain("azure.getLastError()");
    expect(passagePage).toContain("Azure Speech API 密钥、区域、网络或代理");
    expect(passagePage).toContain('role="alert"');
    expect(passagePage).not.toContain('message: azure.error || "评估失败"');

    expect(azureHook).toContain("getLastError");
    expect(azureHook).toContain("errorRef.current");
    expect(azureHook).toContain("normalizeAzureSpeechError");
  });

  it("keeps recorder runtime failures from silently producing partial audio", () => {
    const recorderHook = readProjectFile("src/hooks/use-recorder.ts");

    expect(recorderHook).toContain("recorder.onerror");
    expect(recorderHook).toContain("getRecorderRuntimeErrorMessage");
    expect(recorderHook).toContain("runtimeErrorRef.current");
    expect(recorderHook).toContain("setRawBlob(null)");
    expect(recorderHook).toContain("setAudioBlob(null)");
    expect(recorderHook).toContain("录音过程中");
  });

  it("keeps waveform rendering failures visible without blocking recording", () => {
    const waveformDisplay = readProjectFile(
      "src/components/audio/waveform-display.tsx",
    );

    expect(waveformDisplay).toContain("LIVE_WAVEFORM_WARNING");
    expect(waveformDisplay).toContain("SAVED_WAVEFORM_WARNING");
    expect(waveformDisplay).toContain("录音波形暂时不可用");
    expect(waveformDisplay).toContain("录音仍会继续");
    expect(waveformDisplay).toContain("录音已保留");
    expect(waveformDisplay).toContain('data-smoke="waveform-display-warning"');
    expect(waveformDisplay).toContain('role="status"');
    expect(waveformDisplay).toContain("getAudioContextConstructor");
    expect(waveformDisplay).toContain('ws.on("error"');
  });

  it("keeps local playback load failures visible instead of silent no-ops", () => {
    const audioHook = readProjectFile("src/hooks/use-audio-player.ts");
    const playButton = readProjectFile(
      "src/components/phoneme/phoneme-play-button.tsx",
    );
    const phonemeGrid = readProjectFile(
      "src/components/phoneme/phoneme-grid.tsx",
    );
    const studyCard = readProjectFile(
      "src/components/phoneme/phoneme-study-card.tsx",
    );
    const phonemeHighlight = readProjectFile(
      "src/components/scoring/phoneme-highlight.tsx",
    );

    expect(audioHook).toContain("getAudioPlaybackErrorMessage");
    expect(audioHook).toContain("Release EXE 音频缺口");
    expect(audioHook).toContain("onplayerror");
    expect(playButton).toContain('data-smoke="phoneme-header-audio-error"');
    expect(phonemeGrid).toContain('data-smoke="phoneme-grid-audio-error"');
    expect(studyCard).toContain('data-smoke="practice-chart-audio-error"');
    expect(studyCard).toContain('data-smoke="practice-word-audio-error"');
    expect(studyCard).toContain(
      "mt-2 break-words text-center text-xs text-destructive [overflow-wrap:anywhere]",
    );
    expect(phonemeHighlight).toContain(
      'data-smoke="assessment-phoneme-audio-error"',
    );
    expect(phonemeHighlight).toContain("本地音标音频加载失败");
  });

  it("keeps blocking recording-quality failures exposed as alerts", () => {
    const qualityPanel = readProjectFile(
      "src/components/audio/recording-quality-panel.tsx",
    );

    expect(qualityPanel).toContain('data-smoke="recording-quality-panel"');
    expect(qualityPanel).toContain(
      'role={report.canSubmit ? "status" : "alert"}',
    );
    expect(qualityPanel).toContain("建议重录");
    expect(qualityPanel).toContain("录音质量");
  });

  it("keeps session-state persistence failures visible on practice pages", () => {
    const sessionHook = readProjectFile("src/hooks/use-session-state.ts");
    const sentencesPage = readProjectFile("src/app/sentences/page.tsx");
    const phonemePage = readProjectFile(
      "src/app/phonemes/[phoneme]/phoneme-detail-page.tsx",
    );

    expect(sessionHook).toContain("SESSION_STORAGE_WARNING");
    expect(sessionHook).toContain("onPersistenceError");
    expect(sessionHook).toContain("本页临时状态无法保存或恢复");
    expect(sentencesPage).toContain(
      'data-smoke="free-practice-session-storage-warning"',
    );
    expect(sentencesPage).toContain("handleSessionStorageError");
    expect(sentencesPage).toContain('role="alert"');
    expect(phonemePage).toContain(
      'data-smoke="phoneme-session-storage-warning"',
    );
    expect(phonemePage).toContain("handleSessionStorageError");
    expect(phonemePage).toContain('data-smoke="phoneme-recorder-error"');
    expect(phonemePage).toContain('data-smoke="phoneme-azure-error"');
    expect(phonemePage).toContain('data-smoke="local-practice-save-error"');
    expect(phonemePage).toContain(
      "break-words rounded-lg border border-amber-300/60",
    );
    expect(phonemePage).toContain(
      "max-w-full break-words text-center text-sm text-red-500 [overflow-wrap:anywhere]",
    );
    expect(phonemePage).toContain(
      "max-w-full break-words text-center text-sm text-amber-600 [overflow-wrap:anywhere]",
    );
    expect(phonemePage).toContain('role="alert"');
  });

  it("keeps advanced drill provider failures visible inline", () => {
    const drillPage = readProjectFile("src/app/drill/page.tsx");
    const drillReportStorage = readProjectFile(
      "src/lib/drill-report-storage.ts",
    );
    const prosodyPage = readProjectFile("src/app/drill/prosody/page.tsx");
    const wordPage = readProjectFile("src/app/drill/word/page.tsx");
    const sentencePage = readProjectFile("src/app/drill/sentence/page.tsx");
    const scenariosPage = readProjectFile("src/app/drill/scenarios/page.tsx");
    const spontaneousPage = readProjectFile(
      "src/app/drill/spontaneous/page.tsx",
    );
    const azureHook = readProjectFile("src/hooks/use-azure-assessment.ts");
    const drillSessionHook = readProjectFile("src/hooks/use-drill-session.ts");

    expect(drillPage).toContain('data-smoke="drill-report-storage-warning"');
    expect(drillPage).toContain(
      'data-smoke="drill-experimental-boundary-warning"',
    );
    expect(drillPage).toContain('role="alert"');
    expect(drillPage).toContain('role="status"');
    expect(drillPage).toContain("不生成正式");
    expect(drillPage).toContain("不会用整词分冒充掌握证据");
    expect(drillPage).toContain("loadDrillReportForLanguage(languageId)");
    expect(drillPage).toContain("WRAP_SAFE_ACTION_BUTTON_CLASS");
    expect(drillPage).toContain("WRAP_SAFE_BADGE_CLASS");
    expect(drillPage).toContain(
      "const reviewItems = reviewQueue.map(prescriptionFromReviewTask);",
    );
    expect(drillPage).toContain("{reviewQueue.map((task) => {");
    expect(drillPage).toContain('data-smoke="drill-review-task-card"');
    expect(drillPage).toContain('data-smoke="drill-today-item-card"');
    expect(drillPage).not.toContain("reviewQueue.slice(0, 2)");
    expect(drillPage).not.toContain(".slice(0, 2)");
    expect(drillPage).toContain(
      "h-auto min-h-8 max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]",
    );
    expect(drillPage).toContain(
      "h-auto min-h-5 max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]",
    );
    expect(drillPage).toContain(
      "mb-5 flex flex-col gap-3 shrink-0 sm:flex-row sm:items-start sm:justify-between",
    );
    expect(drillPage).toContain('<div className="min-w-0">');
    for (const smokeId of [
      "drill-settings-action",
      "drill-evidence-action",
      "drill-diagnosis-action",
      "drill-primary-action",
      "drill-secondary-diagnosis-action",
    ]) {
      expectSmokeElementUsesWrapSafeClass(
        drillPage,
        smokeId,
        "WRAP_SAFE_ACTION_BUTTON_CLASS",
      );
    }
    for (const smokeId of [
      "drill-readiness-badge",
      "drill-duration-badge",
      "drill-priority-badge",
      "drill-prescription-source-badge",
      "drill-review-source-badge",
      "drill-today-duration-badge",
      "drill-today-state-badge",
      "drill-today-stage-badge",
      "drill-memory-count-badge",
      "drill-memory-severity-badge",
      "drill-pack-status-badge",
      "drill-pack-phoneme-badge",
      "drill-pack-duration-badge",
      "drill-pack-level-count-badge",
    ]) {
      expectSmokeElementUsesWrapSafeClass(
        drillPage,
        smokeId,
        "WRAP_SAFE_BADGE_CLASS",
      );
    }
    expect(drillReportStorage).toContain("DRILL_REPORT_STORAGE_WARNING");
    expect(drillReportStorage).toContain("上次诊断报告无法读取");
    expect(drillReportStorage).toContain("重置本机学习数据");

    expect(prosodyPage).toContain('data-smoke="prosody-demo-audio-error"');
    expect(prosodyPage).toContain('data-smoke="prosody-assessment-error"');
    expectSmokeAlertWraps(prosodyPage, "prosody-demo-audio-error");
    expectSmokeAlertWraps(prosodyPage, "prosody-assessment-error");
    expectSmokeAlertWraps(prosodyPage, "prosody-benchmark-archive-warning");
    expectSmokeAlertWraps(prosodyPage, "prosody-local-save-warning");
    expect(prosodyPage).toContain('data-smoke="prosody-page"');
    expect(prosodyPage).toContain('data-smoke="prosody-exercise-header"');
    expect(prosodyPage).toContain(
      "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
    );
    expect(prosodyPage).toContain("{tts.error}");
    expect(prosodyPage).toContain("{recorder.error ?? assessment.error}");
    expect(prosodyPage).toContain('role="alert"');

    expect(wordPage).toContain('data-smoke="word-drill-page"');
    expect(wordPage).toContain('data-smoke="word-drill-config-card"');
    expect(wordPage).toContain("flex flex-wrap items-start gap-3");
    expect(wordPage).toContain("min-w-0 flex-1");

    expect(sentencePage).toContain('data-smoke="sentence-drill-page"');
    expect(sentencePage).toContain('data-smoke="sentence-drill-config-card"');
    expect(sentencePage).toContain("flex flex-wrap items-start gap-3");
    expect(sentencePage).toContain("min-w-0 flex-1");

    expect(scenariosPage).toContain('data-smoke="scenario-demo-audio-error"');
    expect(scenariosPage).toContain('data-smoke="scenario-assessment-error"');
    expectSmokeAlertWraps(scenariosPage, "scenario-demo-audio-error");
    expectSmokeAlertWraps(scenariosPage, "scenario-assessment-error");
    expectSmokeAlertWraps(
      scenariosPage,
      "scenario-benchmark-archive-warning",
    );
    expectSmokeAlertWraps(scenariosPage, "scenario-local-save-warning");
    expect(scenariosPage).toContain('data-smoke="scenario-page"');
    expect(scenariosPage).toContain('data-smoke="scenario-prompt-card"');
    expect(scenariosPage).toContain('data-smoke="scenario-recording-card"');
    expect(scenariosPage).toContain("flex flex-wrap items-start gap-3");
    expect(scenariosPage).toContain("min-w-0 flex-1");
    expect(scenariosPage).toContain("WRAP_SAFE_ACTION_BUTTON_CLASS");
    expect(scenariosPage).toContain("WRAP_SAFE_BADGE_CLASS");
    expect(scenariosPage).toContain('data-smoke="scenario-kind-badge"');
    expect(scenariosPage).toContain(
      'data-smoke="scenario-evidence-score-badge"',
    );
    expect(scenariosPage).toContain(
      "h-auto min-h-8 max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]",
    );
    expect(scenariosPage).toContain(
      "h-auto min-h-5 max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]",
    );
    expect(scenariosPage).toContain("{tts.error}");
    expect(scenariosPage).toContain("{recorder.error ?? assessment.error}");
    expect(scenariosPage).toContain('role="alert"');

    expect(spontaneousPage).toContain(
      'data-smoke="spontaneous-processing-error"',
    );
    expectSmokeAlertWraps(spontaneousPage, "spontaneous-processing-error");
    expectSmokeAlertWraps(
      spontaneousPage,
      "spontaneous-benchmark-archive-warning",
    );
    expectSmokeAlertWraps(spontaneousPage, "spontaneous-local-save-warning");
    expect(spontaneousPage).toContain('data-smoke="spontaneous-page"');
    expect(spontaneousPage).toContain('data-smoke="spontaneous-prompt-card"');
    expect(spontaneousPage).toContain(
      'data-smoke="spontaneous-recording-card"',
    );
    expect(spontaneousPage).toContain("flex flex-wrap items-start gap-3");
    expect(spontaneousPage).toContain("min-w-0 flex-1");
    expect(spontaneousPage).toContain("WRAP_SAFE_ACTION_BUTTON_CLASS");
    expect(spontaneousPage).toContain("WRAP_SAFE_BADGE_CLASS");
    expect(spontaneousPage).toContain(
      'data-smoke="spontaneous-target-status-badge"',
    );
    expect(spontaneousPage).toContain(
      'data-smoke="spontaneous-evidence-score-badge"',
    );
    expect(spontaneousPage).toContain(
      "flex flex-wrap items-center justify-center gap-2 break-words text-center text-sm text-muted-foreground [overflow-wrap:anywhere]",
    );
    expect(spontaneousPage).toContain("{recorder.error ?? error}");
    expect(spontaneousPage).toContain("Azure Speech API 密钥和区域");
    expect(spontaneousPage).toContain("normalizeAzureSpeechError");
    expect(spontaneousPage).not.toContain("caught.message");
    expect(spontaneousPage).toContain('role="alert"');

    expect(azureHook).toContain("Azure Speech API 密钥和区域");
    expect(azureHook).toContain("回到本页重新评分");
    expect(azureHook).toContain("normalizeAzureSpeechError");

    expect(drillSessionHook).toContain("azure.getLastError()");
    expect(drillSessionHook).toContain(
      "评分失败：请检查 Azure Speech API 密钥、区域、网络或代理后重试。",
    );
    expect(drillSessionHook).not.toContain('azure.error || "评分失败，请重试"');
  });

  it("keeps contrast, perception, and pack-runner failures visible inline", () => {
    const contrastPage = readProjectFile("src/app/drill/contrast/page.tsx");
    const perceptionPage = readProjectFile("src/app/drill/perception/page.tsx");
    const packRunner = readProjectFile(
      "src/app/drill/pack/[packId]/pack-runner-client.tsx",
    );

    expect(contrastPage).toContain('data-smoke="contrast-word-audio-error"');
    expect(contrastPage).toContain('data-smoke="contrast-page"');
    expect(contrastPage).toContain('data-smoke="contrast-config-card"');
    expect(contrastPage).toContain('data-smoke="contrast-pair-preview"');
    expect(contrastPage).toContain("flex flex-wrap items-start gap-3");
    expect(contrastPage).toContain("grid grid-cols-1 gap-3 sm:grid-cols-2");
    expect(contrastPage).toContain("set.pairs.map((pair)");
    expect(contrastPage).not.toContain("set.pairs[0].wordA} / {set.pairs[0].wordB} ...");
    expect(contrastPage).toContain('data-smoke="contrast-assessment-error"');
    expect(contrastPage).toContain('data-smoke="contrast-assessment-retry"');
    expect(contrastPage).toContain("CONTRAST_ASSESSMENT_FALLBACK_MESSAGE");
    expect(contrastPage).toContain("azure.getLastError()");
    expect(contrastPage).toContain("setAssessmentRetryToken");
    expect(contrastPage).toContain("{assessmentErrorMessage}");
    expect(contrastPage).toContain('role="alert"');

    expect(perceptionPage).toContain('data-smoke="perception-audio-error"');
    expect(perceptionPage).toContain('data-smoke="perception-page"');
    expect(perceptionPage).toContain(
      'data-smoke="perception-experimental-blocker"',
    );
    expect(perceptionPage).toContain(
      "h-auto min-h-8 max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]",
    );
    expect(perceptionPage).toContain(
      "mt-3 break-words text-2xl font-bold [overflow-wrap:anywhere]",
    );
    expect(perceptionPage).toContain(
      'data-smoke="perception-focused-review-actions"',
    );
    expect(perceptionPage).toContain(
      'data-smoke="perception-completed-actions"',
    );
    expect(perceptionPage).toContain(
      "flex flex-wrap justify-center gap-3 sm:justify-end",
    );
    expect(perceptionPage).toContain("{pronunciation.error}");
    expect(perceptionPage).toContain("pronunciation.clearError()");
    expect(perceptionPage).toContain("setActiveSlot(null)");
    expect(perceptionPage).toContain('role="alert"');

    expect(packRunner).toContain(
      'data-smoke="pack-runner-perception-audio-error"',
    );
    expect(packRunner).toContain('data-smoke="pack-runner-page"');
    expect(packRunner).toContain('data-smoke="pack-runner-intro-card"');
    expect(packRunner).toContain('data-smoke="pack-runner-course-map"');
    expect(packRunner).toContain("WRAP_SAFE_BADGE_CLASS");
    expect(packRunner).toContain('data-smoke="pack-runner-intro-phoneme-badge"');
    expect(packRunner).toContain(
      'data-smoke="pack-runner-course-map-status-badge"',
    );
    expect(packRunner).toContain('data-smoke="pack-runner-level-title-badge"');
    expect(packRunner).toContain(
      'data-smoke="pack-runner-debrief-next-level-badge"',
    );
    expect(packRunner).toContain(
      "h-auto min-h-5 max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]",
    );
    expect(packRunner).toContain(
      "h-auto min-h-8 max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]",
    );
    expect(packRunner).toContain(
      'data-smoke="pack-runner-reference-audio-error"',
    );
    expect(packRunner).toContain('data-smoke="pack-runner-assessment-error"');
    expect(packRunner).toContain('data-smoke="pack-runner-submit-score"');
    expect(packRunner).toContain(
      'data-smoke="pack-runner-remediation-submit-score"',
    );
    expect(packRunner).toContain('assessmentError ? "重新评分" : "提交评分"');
    expect(packRunner).toContain("remediationScoreButtonLabel");
    expect(packRunner).toContain("重新评分这一步");
    expect(packRunner).toContain(
      "referenceError={wordAudio.error ?? tts.error}",
    );
    expect(packRunner).toContain(
      "assessmentError={recorder.error ?? azure.error}",
    );
    expect(packRunner).toContain("clearReferenceAudioState");
    expect(packRunner).toContain("wordAudio.clearError()");
    expect(packRunner).toContain("tts.reset()");
    expect(packRunner).toContain("flex flex-wrap items-start gap-3 shrink-0");
    expect(packRunner).toContain("min-w-0 flex-1");
    expect(packRunner).toContain('role="alert"');
  });

  it("keeps direct evidence and coverage-passage routes smokeable", () => {
    const evidencePage = readProjectFile("src/app/drill/evidence/page.tsx");
    const passagePage = readProjectFile("src/app/assessment/passage/page.tsx");
    const languageModuleGate = readProjectFile(
      "src/components/common/language-module-gate.tsx",
    );

    expect(evidencePage).toContain('data-smoke="evidence-page"');
    expect(evidencePage).toContain('data-smoke="evidence-summary-stats"');
    expect(evidencePage).toContain(
      'data-smoke="evidence-mastery-storage-warning"',
    );
    expect(evidencePage).toContain('data-smoke="evidence-empty-state"');
    expect(evidencePage).toContain(
      'data-smoke="evidence-experimental-blocker"',
    );
    expect(evidencePage).toContain('data-smoke="evidence-card-row"');
    expect(evidencePage).toContain('data-smoke="evidence-pattern-row"');
    expect(evidencePage).toContain('data-smoke="evidence-remediation-row"');
    expect(evidencePage).toContain("evidenceBook.cards.map");
    expect(evidencePage).toContain("evidenceBook.patterns.map");
    expect(evidencePage).toContain("evidenceBook.remediations.map");
    expect(evidencePage).not.toContain("topCards");
    expect(evidencePage).not.toContain("topPatterns");
    expect(evidencePage).not.toContain("remediations = evidenceBook.remediations.slice");
    expect(evidencePage).not.toContain("evidenceBook.cards.slice(0, 8)");
    expect(evidencePage).not.toContain("evidenceBook.patterns.slice(0, 6)");
    expect(evidencePage).toContain(
      "h-auto min-h-8 max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]",
    );
    expect(evidencePage).toContain("flex flex-wrap items-start gap-3");
    expect(evidencePage).toContain("min-w-0 flex-1");

    expect(passagePage).toContain('data-smoke="assessment-passage-page"');
    expect(passagePage).toContain(
      'data-smoke="assessment-passage-storage-warning"',
    );
    expect(passagePage).toContain('data-smoke="assessment-passage-intro-card"');
    expect(passagePage).toContain('data-smoke="assessment-passage-text-card"');
    expect(passagePage).toContain(
      'data-smoke="assessment-passage-start-button"',
    );
    expect(passagePage).toContain(
      'data-smoke="assessment-passage-experimental-blocker"',
    );
    expect(passagePage).toContain(
      "h-auto min-h-8 max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]",
    );
    expect(passagePage).toContain("flex shrink-0 flex-wrap");
    expect(passagePage).toContain("min-w-0 flex-1");

    expect(languageModuleGate).toContain(
      "h-auto min-h-8 max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]",
    );
    expect(languageModuleGate).toContain("min-w-0 flex-1");
    expect(languageModuleGate).toContain(
      'data-smoke="language-module-missing-capabilities"',
    );
    expect(languageModuleGate).toContain(
      'data-smoke="language-module-known-gaps"',
    );
    expect(languageModuleGate).toContain(
      'audit.missingCapabilities.join("、")',
    );
    expect(languageModuleGate).toContain("profile.knownGaps.map");
    expect(languageModuleGate).not.toContain("missingCapabilities.slice");
    expect(languageModuleGate).not.toContain("knownGaps.slice");
  });

  it("keeps recording and benchmark replay on the shared audio player hook", () => {
    const replayPages = [
      "src/app/drill/prosody/page.tsx",
      "src/app/drill/scenarios/page.tsx",
      "src/app/drill/spontaneous/page.tsx",
      "src/app/progress/page.tsx",
    ];

    for (const pagePath of replayPages) {
      const source = readProjectFile(pagePath);
      expect(source, pagePath).toContain("useAudioPlayer");
      expect(source, pagePath).toContain("playBlob");
      expect(source, pagePath).not.toContain("new Audio(");
    }

    const progressPage = readProjectFile("src/app/progress/page.tsx");
    expect(progressPage).toContain(
      'data-smoke="progress-benchmark-archive-status"',
    );
    expect(progressPage).toContain('data-smoke="progress-benchmark-row"');
    expect(progressPage).toContain('data-smoke="progress-benchmark-title"');
    expect(progressPage).toContain('data-smoke="progress-benchmark-meta"');
    expect(progressPage).toContain('data-smoke="progress-benchmark-text"');
    expect(progressPage).toContain('data-smoke="progress-benchmark-date"');
    expect(progressPage).toContain('data-smoke="progress-recent-session-row"');
    expect(progressPage).toContain(
      'data-smoke="progress-recent-session-title"',
    );
    expect(progressPage).toContain('data-smoke="progress-recent-session-meta"');
    expect(progressPage).toContain('data-smoke="progress-session-count"');
    expect(progressPage).toContain(
      "const trainingSessions = profile?.sessions ?? []",
    );
    expect(progressPage).not.toContain("profile?.sessions.slice(0, 6)");
    expect(progressPage).toContain("flex flex-col gap-3");
    expect(progressPage).toContain(
      "sm:flex-row sm:items-center sm:justify-between",
    );
    expect(progressPage).toContain("本机音频数据缺失");
    expect(progressPage).toContain("getProgressArchiveErrorMessage");
    expect(progressPage).toContain(
      'role={archiveStatus.tone === "success" ? "status" : "alert"}',
    );
    expect(progressPage).toContain("aria-label={`播放 benchmark 录音");
    expect(progressPage).toContain("aria-label={`删除 benchmark 录音");
  });

  it("keeps benchmark archive save failures visible without blocking scoring", () => {
    const benchmarkArchive = readProjectFile("src/lib/benchmark-archive.ts");
    const prosodyPage = readProjectFile("src/app/drill/prosody/page.tsx");
    const scenariosPage = readProjectFile("src/app/drill/scenarios/page.tsx");
    const spontaneousPage = readProjectFile(
      "src/app/drill/spontaneous/page.tsx",
    );

    expect(benchmarkArchive).toContain("getBenchmarkArchiveSaveErrorMessage");
    expect(benchmarkArchive).toContain("本次评分已完成");
    expect(benchmarkArchive).toContain("本机存储空间不足");

    for (const [pagePath, source, smokeId] of [
      [
        "src/app/drill/prosody/page.tsx",
        prosodyPage,
        'data-smoke="prosody-benchmark-archive-warning"',
      ],
      [
        "src/app/drill/scenarios/page.tsx",
        scenariosPage,
        'data-smoke="scenario-benchmark-archive-warning"',
      ],
      [
        "src/app/drill/spontaneous/page.tsx",
        spontaneousPage,
        'data-smoke="spontaneous-benchmark-archive-warning"',
      ],
    ] as const) {
      expect(source, pagePath).toContain(smokeId);
      expect(source, pagePath).toContain("getBenchmarkArchiveSaveErrorMessage");
      expect(source, pagePath).toContain("archiveWarning");
      expect(source, pagePath).toContain('role="alert"');
    }

    expect(spontaneousPage).toContain("benchmark 录音未保存");
    expect(spontaneousPage).toContain("录音已作为 benchmark 保存。");
    expect(spontaneousPage).toContain('? "这次即兴内容没有命中当前弱点词');
  });
});
