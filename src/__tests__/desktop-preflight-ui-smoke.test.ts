import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();

function readProjectFile(path: string): string {
  return readFileSync(join(projectRoot, path), "utf8");
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
    expect(packageJson.scripts["validate:desktop"].indexOf("desktop:preflight"))
      .toBeLessThan(packageJson.scripts["validate:desktop"].indexOf("desktop:build"));
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
    expect(script).toContain("does not start localhost");
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
    expect(packageJson.scripts["validate:desktop"].indexOf("desktop:artifact-smoke"))
      .toBeLessThan(packageJson.scripts["validate:desktop"].indexOf("desktop:ui-smoke"));
  });

  it("opens key release routes without recording or ElevenLabs generation", () => {
    const script = readProjectFile("scripts/desktop-ui-smoke.mjs");

    expect(script).toContain("/settings");
    expect(script).toContain("/phonemes/ee");
    expect(script).toContain("/phonemes/es-a");
    expect(script).toContain("/phonemes/fr-i");
    expect(script).toContain("/phonemes/ru-a");
    expect(script).toContain("/drill");
    expect(script).toContain("/sentences");
    expect(script).toContain('selector: \'[data-smoke="sentences-page"]\'');
    expect(script).toContain("sentenceHooksReady");
    expect(script).toContain("sentence-input-card");
    expect(script).toContain("sentence-recording-card");
    expect(script).toContain("/assessment");
    expect(script).toContain("assessmentHooksReady");
    expect(script).toContain("assessment-intro-card");
    expect(script).toContain("assessment-start-button");
    expect(script).toContain("assessment-passage-link");
    expect(script).toContain("/progress");
    expect(script).toContain("direct: true");
    expect(script).toContain("progress-experimental-blocker");
    expect(script).toContain("routes=/drill,/sentences,/assessment,/progress");
    expect(script).toContain("releaseServedFromDevServer=false");
    expect(script).toContain("data-smoke=\"language-option\"");
    expect(script).toContain("textIsCentered");
    expect(script).toContain("textAlign === \"center\"");
    expect(script).toContain("assertNarrowViewportRoutes");
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
    expect(script).toContain("data-audio-max-duration-ms");
    expect(script).toContain("tileAudioPolicyReady");
    expect(script).toContain("hasPlayableExactHeaderClip");
    expect(script).toContain("hasLockedUnverifiedTile");
    expect(script).toContain("tilePoliciesAreStrict");
    expect(script).toContain("scoringTileAudioPolicy=ok");
    expect(script).toContain("usage-history-target");
    expect(script).toContain("pronunciation-test-row");
    expect(script).toContain("childrenDoNotOverlap");
    expect(script).toContain("pronunciationRowsWrap");
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
    expect(script).toContain("assessmentSmoke=ok");
    expect(script).toContain("aria-disabled");
    expect(script).toContain("videoSelectorReady");
    expect(script).toContain("videoSelectorCount");
    expect(script).toContain("headerAudioReady");
    expect(script).toContain(".includes(\"发音\")");
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
    const llmCard = readProjectFile(
      "src/components/settings/llm-config-card.tsx",
    );

    expect(languageCard).toContain('data-smoke="language-option-missing"');
    expect(languageCard).toContain("overflow-wrap:anywhere");
    expect(languageCard).not.toContain("line-clamp");
    expect(usageMonitor).toContain('data-smoke="usage-history-target"');
    expect(usageMonitor).toContain("overflow-wrap:anywhere");
    expect(usageMonitor).not.toContain("truncate");
    expect(pronunciationCard).toContain('data-smoke="pronunciation-test-row"');
    expect(pronunciationCard).toContain("flex flex-wrap items-center gap-3");
    expect(llmCard).toContain('data-smoke="llm-provider-chip"');
    expect(llmCard).toContain('data-smoke="llm-manual-provider-note"');
    expect(llmCard).toContain("break-words");
  });

  it("keeps quick assessment recording and scoring failures visible inline", () => {
    const assessmentPage = readProjectFile("src/app/assessment/page.tsx");
    const recorderAlerts =
      assessmentPage.match(/data-smoke="assessment-recorder-error"/g) ?? [];
    const azureAlerts =
      assessmentPage.match(/data-smoke="assessment-azure-error"/g) ?? [];

    expect(recorderAlerts).toHaveLength(2);
    expect(azureAlerts).toHaveLength(2);
    expect(assessmentPage).toContain('role="alert"');
    expect(assessmentPage).toContain("{recorder.error}");
    expect(assessmentPage).toContain("{azure.error}");
    expect(assessmentPage).not.toContain(
      'message: azure.error || "评估失败"',
    );
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
  });
});
