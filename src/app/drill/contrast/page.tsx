"use client";

import { ArrowLeft, Check, Loader2, SkipForward, Volume2 } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { RecordButton } from "@/components/audio/record-button";
import { WaveformDisplay } from "@/components/audio/waveform-display";
import { DrillSummaryCard } from "@/components/drill/drill-summary";
import { Button } from "@/components/ui/button";
import { useAzureAssessment } from "@/hooks/use-azure-assessment";
import { useCoachMode, useLanguageConfig } from "@/hooks/use-api-keys";
import { useWordPronunciation } from "@/hooks/use-word-pronunciation";
import { useRecorder } from "@/hooks/use-recorder";
import { getPhonemeAccuracy } from "@/lib/azure-phoneme-map";
import { computeDrillSummary, getPassThreshold } from "@/lib/drill-utils";
import { getLanguageProfile } from "@/lib/language-profiles";
import type { MinimalPairSet } from "@/lib/minimal-pairs";
import { MINIMAL_PAIR_SETS } from "@/lib/minimal-pairs";
import type {
  DrillProgressItem,
  DrillSessionConfig,
  DrillSummary,
} from "@/types/drill";

type ContrastPhase =
  | { type: "select" }
  | { type: "listen"; pairIndex: number }
  | { type: "recordA"; pairIndex: number }
  | { type: "recordB"; pairIndex: number }
  | {
      type: "result";
      pairIndex: number;
      scoreA: number;
      scoreB: number;
      passed: boolean;
    }
  | { type: "completed"; summary: DrillSummary };

export default function ContrastDrillPage() {
  const { languageId } = useLanguageConfig();
  const languageProfile = getLanguageProfile(languageId);
  const [selectedSet, setSelectedSet] = useState<MinimalPairSet | null>(null);
  const [phase, setPhase] = useState<ContrastPhase>({ type: "select" });
  const [progress, setProgress] = useState<DrillProgressItem[]>([]);
  const [startedAt] = useState(Date.now());
  const [pendingScoreA, setPendingScoreA] = useState<number>(0);

  const recorder = useRecorder();
  const azure = useAzureAssessment();
  const wordAudio = useWordPronunciation();
  const coachMode = useCoachMode();

  const threshold = getPassThreshold(coachMode);

  // De-dupe assessment trigger: remember the blob we've already processed
  // so the effect doesn't re-assess the same audio if re-rendered.
  const processedBlobRef = useRef<Blob | null>(null);

  const handleSelectSet = (set: MinimalPairSet) => {
    setSelectedSet(set);
    setProgress([]);
    setPhase({ type: "listen", pairIndex: 0 });
  };

  const currentPair =
    selectedSet && phase.type !== "select" && phase.type !== "completed"
      ? selectedSet.pairs[phase.pairIndex]
      : null;

  const handlePlayA = () => {
    if (currentPair) wordAudio.playWord(currentPair.wordA, "blue", languageId);
  };

  const handlePlayB = () => {
    if (currentPair) wordAudio.playWord(currentPair.wordB, "blue", languageId);
  };

  const handleStartRecordA = () => {
    if (phase.type !== "listen") return;
    recorder.reset();
    azure.reset();
    setPhase({ type: "recordA", pairIndex: phase.pairIndex });
  };

  const handleStopA = useCallback(() => {
    recorder.stopRecording();
  }, [recorder]);

  const handleStopB = useCallback(() => {
    recorder.stopRecording();
  }, [recorder]);

  // Auto-assess word A when blob is ready.
  //
  // Effect design notes:
  // - processedBlobRef dedupes so fast re-renders don't trigger duplicate
  //   assessments on the same audio blob.
  // - We read `threshold` / `currentPair` fresh inside the effect body
  //   (via deps), avoiding the stale-closure trap that the earlier
  //   silenced version hid.
  // - M5: uses `getPhonemeAccuracy` on the target phoneme (phonemeA) rather
  //   than the overall pronunciationScore — contrast training grades the
  //   specific sound, not the whole-word average.
  // - azure.assess / recorder.reset / azure.reset are stable useCallbacks;
  //   omitting them from deps avoids re-triggering on every render.
  // biome-ignore lint/correctness/useExhaustiveDependencies: stable callbacks intentionally omitted
  useEffect(() => {
    if (phase.type !== "recordA") return;
    if (!recorder.audioBlob || recorder.isRecording || azure.isLoading) return;
    if (!currentPair || !selectedSet) return;
    if (processedBlobRef.current === recorder.audioBlob) return;

    processedBlobRef.current = recorder.audioBlob;
    const blob = recorder.audioBlob;
    const targetWord = currentPair.wordA;
    const targetPhoneme = selectedSet.phonemeA;

    (async () => {
      const result = await azure.assess(
        blob,
        targetWord,
        languageProfile.azureLocale,
      );
      if (!result) return;
      const phonemeScore = getPhonemeAccuracy(result, targetPhoneme);
      const scoreA = phonemeScore ?? result.pronunciationScore;
      setPendingScoreA(scoreA);
      processedBlobRef.current = null;
      recorder.reset();
      azure.reset();
      setPhase((prev) =>
        prev.type === "recordA"
          ? { type: "recordB", pairIndex: prev.pairIndex }
          : prev,
      );
    })();
  }, [
    phase.type,
    recorder.audioBlob,
    recorder.isRecording,
    azure.isLoading,
    currentPair,
    selectedSet,
    languageProfile.azureLocale,
  ]);

  // Auto-assess word B — same structure as above.
  // biome-ignore lint/correctness/useExhaustiveDependencies: stable callbacks intentionally omitted
  useEffect(() => {
    if (phase.type !== "recordB") return;
    if (!recorder.audioBlob || recorder.isRecording || azure.isLoading) return;
    if (!currentPair || !selectedSet) return;
    if (processedBlobRef.current === recorder.audioBlob) return;

    processedBlobRef.current = recorder.audioBlob;
    const blob = recorder.audioBlob;
    const targetWord = currentPair.wordB;
    const targetPhoneme = selectedSet.phonemeB;
    // Capture threshold at trigger time so a coach-mode switch mid-recording
    // still uses the threshold the user committed to when they started.
    const currentThreshold = threshold;
    const priorScoreA = pendingScoreA;

    (async () => {
      const result = await azure.assess(
        blob,
        targetWord,
        languageProfile.azureLocale,
      );
      if (!result) return;
      const phonemeScore = getPhonemeAccuracy(result, targetPhoneme);
      const scoreB = phonemeScore ?? result.pronunciationScore;
      const passed =
        priorScoreA >= currentThreshold && scoreB >= currentThreshold;
      processedBlobRef.current = null;
      setPhase((prev) =>
        prev.type === "recordB"
          ? {
              type: "result",
              pairIndex: prev.pairIndex,
              scoreA: priorScoreA,
              scoreB,
              passed,
            }
          : prev,
      );
    })();
  }, [
    phase.type,
    recorder.audioBlob,
    recorder.isRecording,
    azure.isLoading,
    currentPair,
    selectedSet,
    pendingScoreA,
    threshold,
    languageProfile.azureLocale,
  ]);

  const handleNext = () => {
    if (phase.type !== "result" || !selectedSet || !currentPair) return;

    const item: DrillProgressItem = {
      item: {
        text: `${currentPair.wordA} / ${currentPair.wordB}`,
        phoneme: selectedSet.phonemeA,
      },
      attempts: [
        {
          attemptNumber: 1,
          score: {
            pronunciationScore: Math.min(phase.scoreA, phase.scoreB),
            accuracyScore: 0,
          },
          passed: phase.passed,
        },
      ],
      passed: phase.passed,
      skipped: false,
      bestScore: Math.min(phase.scoreA, phase.scoreB),
    };
    const newProgress = [...progress, item];
    setProgress(newProgress);

    const nextIndex = phase.pairIndex + 1;
    if (nextIndex >= selectedSet.pairs.length) {
      const config: DrillSessionConfig = {
        kind: "word",
        phonemeSlug: selectedSet.phonemeA,
        itemCount: selectedSet.pairs.length,
        passThreshold: threshold,
      };
      const summary = computeDrillSummary(config, newProgress, startedAt);
      setPhase({ type: "completed", summary });
    } else {
      processedBlobRef.current = null;
      recorder.reset();
      azure.reset();
      setPhase({ type: "listen", pairIndex: nextIndex });
    }
  };

  const handleReset = () => {
    processedBlobRef.current = null;
    setSelectedSet(null);
    setProgress([]);
    setPhase({ type: "select" });
    recorder.reset();
    azure.reset();
  };

  return (
    <div className="h-full flex flex-col px-6 py-4 overflow-y-auto scrollbar-thin">
      <div className="mb-4 flex items-center gap-3 shrink-0">
        <Link
          href="/drill"
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-bold">对比训练</h1>
        {selectedSet && (
          <span className="text-sm text-muted-foreground">
            {selectedSet.label}
          </span>
        )}
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full">
        {/* Select set */}
        {phase.type === "select" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              选择一组易混淆音标进行对比训练：
            </p>
            <div className="grid grid-cols-2 gap-3">
              {MINIMAL_PAIR_SETS.map((set) => (
                <motion.button
                  key={set.id}
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelectSet(set)}
                  className="rounded-xl border bg-card p-4 text-left shadow-sm hover:border-primary/50 transition-colors cursor-pointer"
                >
                  <span className="font-mono text-lg font-bold">
                    {set.label}
                  </span>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {set.pairs[0].wordA} / {set.pairs[0].wordB} ...
                  </p>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Listen phase */}
        {phase.type === "listen" && currentPair && selectedSet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {phase.pairIndex + 1} / {selectedSet.pairs.length}
              </span>
            </div>
            <div className="rounded-xl border bg-card p-8 shadow-sm">
              <div className="grid grid-cols-2 gap-6 text-center">
                <div className="space-y-2">
                  <span className="text-3xl font-bold">
                    {currentPair.wordA}
                  </span>
                  <span className="block font-mono text-sm text-muted-foreground">
                    {currentPair.ipaA}
                  </span>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    onClick={handlePlayA}
                    disabled={wordAudio.isLoading}
                    className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary cursor-pointer"
                  >
                    {wordAudio.isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Volume2 className="h-5 w-5" />
                    )}
                  </motion.button>
                </div>
                <div className="space-y-2">
                  <span className="text-3xl font-bold">
                    {currentPair.wordB}
                  </span>
                  <span className="block font-mono text-sm text-muted-foreground">
                    {currentPair.ipaB}
                  </span>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    onClick={handlePlayB}
                    disabled={wordAudio.isLoading}
                    className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary cursor-pointer"
                  >
                    {wordAudio.isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Volume2 className="h-5 w-5" />
                    )}
                  </motion.button>
                </div>
              </div>
              <div className="mt-6 text-center">
                <Button onClick={handleStartRecordA} className="cursor-pointer">
                  开始录音（先读 {currentPair.wordA}）
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Record A */}
        {phase.type === "recordA" && currentPair && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl border bg-card p-8 shadow-sm text-center space-y-4"
          >
            <p className="text-sm text-muted-foreground">请读：</p>
            <span className="text-4xl font-bold">{currentPair.wordA}</span>
            <RecordButton
              isRecording={recorder.isRecording}
              onStart={() => recorder.startRecording()}
              onStop={handleStopA}
              disabled={azure.isLoading}
            />
            <WaveformDisplay
              audioBlob={recorder.audioBlob}
              stream={recorder.stream}
            />
            {azure.isLoading && (
              <p className="text-sm text-muted-foreground">评分中...</p>
            )}
          </motion.div>
        )}

        {/* Record B */}
        {phase.type === "recordB" && currentPair && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl border bg-card p-8 shadow-sm text-center space-y-4"
          >
            <p className="text-sm text-muted-foreground">很好！现在请读：</p>
            <span className="text-4xl font-bold">{currentPair.wordB}</span>
            <RecordButton
              isRecording={recorder.isRecording}
              onStart={() => recorder.startRecording()}
              onStop={handleStopB}
              disabled={azure.isLoading}
            />
            <WaveformDisplay
              audioBlob={recorder.audioBlob}
              stream={recorder.stream}
            />
            {azure.isLoading && (
              <p className="text-sm text-muted-foreground">评分中...</p>
            )}
          </motion.div>
        )}

        {/* Result */}
        {phase.type === "result" && currentPair && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl border bg-card p-8 shadow-sm text-center space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xl font-bold">{currentPair.wordA}</span>
                <div
                  className={`mt-2 inline-flex h-16 w-16 items-center justify-center rounded-xl text-white ${phase.scoreA >= threshold ? "bg-primary" : "bg-red-500"}`}
                >
                  <span className="text-2xl font-bold">{phase.scoreA}</span>
                </div>
              </div>
              <div>
                <span className="text-xl font-bold">{currentPair.wordB}</span>
                <div
                  className={`mt-2 inline-flex h-16 w-16 items-center justify-center rounded-xl text-white ${phase.scoreB >= threshold ? "bg-primary" : "bg-red-500"}`}
                >
                  <span className="text-2xl font-bold">{phase.scoreB}</span>
                </div>
              </div>
            </div>
            {phase.passed ? (
              <p className="text-primary font-medium flex items-center justify-center gap-2">
                <Check className="h-5 w-5" /> 两个词都达标！
              </p>
            ) : (
              <p className="text-red-500 text-sm">
                需要两个词都达到 {threshold} 分
              </p>
            )}
            <Button onClick={handleNext} className="cursor-pointer">
              <SkipForward className="h-4 w-4 mr-2" />
              下一组
            </Button>
          </motion.div>
        )}

        {/* Completed */}
        {phase.type === "completed" && (
          <DrillSummaryCard
            summary={phase.summary}
            onRestart={() => selectedSet && handleSelectSet(selectedSet)}
            onBack={handleReset}
          />
        )}
      </div>
    </div>
  );
}
