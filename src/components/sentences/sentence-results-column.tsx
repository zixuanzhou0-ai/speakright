"use client";

import { FeedbackDisplay } from "@/components/feedback/feedback-display";
import { PhonemeHighlight } from "@/components/scoring/phoneme-highlight";
import { WordHighlight } from "@/components/scoring/word-highlight";
import { Badge } from "@/components/ui/badge";
import type { FeedbackData } from "@/hooks/use-llm-feedback";
import type { FreePracticeTransferSummary } from "@/lib/free-practice-transfer";
import {
  getCenteredCompactTextClassName,
  getCenteredReadableTextClassName,
  getPracticeTextDensity,
} from "@/lib/practice-text-presentation";
import type {
  AzureAssessmentResult,
  AzureSyllable,
  AzureWord,
} from "@/types/azure";
import type { LanguageId } from "@/types/language";

interface SentenceResultsColumnProps {
  hasResult: boolean;
  languageId?: LanguageId;
  result: AzureAssessmentResult | null;
  selectedWord: AzureWord | null;
  stressedSyllables: AzureSyllable[];
  onWordClick: (word: AzureWord) => void;
  // LLM feedback
  feedback: FeedbackData;
  isStreaming: boolean;
  hasFeedback: boolean;
  llmError: string | null;
  onRetryFeedback?: () => void;
  transferSummary?: FreePracticeTransferSummary | null;
}

export function SentenceResultsColumn({
  hasResult,
  languageId = "en-US",
  result,
  selectedWord,
  stressedSyllables,
  onWordClick,
  feedback,
  isStreaming,
  hasFeedback,
  llmError,
  onRetryFeedback,
  transferSummary,
}: SentenceResultsColumnProps) {
  const breakdownLabel = languageId === "en-US" ? "音标拆解" : "发音拆解";
  const selectedWordDensity = getPracticeTextDensity(
    selectedWord?.word ?? "",
    "word",
  );

  if (!hasResult) {
    return (
      <div className="grid gap-3">
        <div className="flex h-24 items-center justify-center rounded-xl border border-dashed bg-muted/20">
          <p className="text-sm text-muted-foreground">逐词评分区</p>
        </div>
        <div className="flex h-24 items-center justify-center rounded-xl border border-dashed bg-muted/20">
          <p className="text-sm text-muted-foreground">AI 教练反馈区</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Word highlight + Phoneme detail — wrapped in card */}
      <div className="shrink-0 rounded-xl border bg-card px-4 py-4 shadow-sm">
        {result && (
          <section>
            <h2 className="mb-3 text-center text-sm font-semibold text-muted-foreground">
              逐词评分（点击查看音素详情）
            </h2>
            <WordHighlight words={result.words} onWordClick={onWordClick} />
          </section>
        )}

        {selectedWord && selectedWord.phonemes.length > 0 ? (
          <section className="mt-4 border-t pt-4">
            <h2 className="mb-3 text-center text-sm font-semibold text-muted-foreground">
              <span className="block">音素详情</span>
              <span
                className={`${getCenteredCompactTextClassName(
                  selectedWordDensity,
                )} mt-1 font-mono text-foreground`}
              >
                {selectedWord.word}
              </span>
            </h2>
            <PhonemeHighlight
              phonemes={selectedWord.phonemes}
              syllables={stressedSyllables}
              languageId={languageId}
            />
          </section>
        ) : result ? (
          <div className="mt-4 flex items-center justify-center rounded-lg border border-dashed bg-muted/20 p-4">
            <p className="text-center text-sm text-muted-foreground">
              点击上方单词查看{breakdownLabel}
            </p>
          </div>
        ) : null}
      </div>

      {transferSummary && transferSummary.evidences.length > 0 && (
        <TransferEvidenceCard summary={transferSummary} />
      )}

      {/* LLM Feedback */}
      {(hasFeedback || isStreaming || llmError) && (
        <div className="flex-1 min-h-0">
          <FeedbackDisplay
            feedback={feedback}
            isStreaming={isStreaming}
            error={llmError}
            onRetry={onRetryFeedback}
          />
        </div>
      )}
    </>
  );
}

function TransferEvidenceCard({
  summary,
}: {
  summary: FreePracticeTransferSummary;
}) {
  return (
    <div className="shrink-0 rounded-xl border bg-card px-4 py-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-center gap-2 text-center">
        <div className="max-w-full">
          <h2 className="text-sm font-semibold text-muted-foreground">
            迁移证据已回流
          </h2>
          <p className="mt-1 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
            这次自由练习命中了当前训练目标，已写入学习记忆和复习队列。
          </p>
        </div>
        <Badge variant={summary.recorded ? "default" : "secondary"}>
          {summary.recorded ? "已记录" : "仅分析"}
        </Badge>
      </div>
      <div className="grid gap-2">
        {summary.evidences.map((item) => (
          <div
            key={`${item.packId}-${item.levelId}`}
            className="rounded-lg border bg-background p-3"
          >
            <div className="flex flex-wrap items-start justify-center gap-2 text-center">
              <div className="max-w-full">
                <p className="break-words text-sm font-semibold [overflow-wrap:anywhere]">
                  {item.packTitle}
                </p>
                <p className="mt-1 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                  {item.reason}
                </p>
              </div>
              <Badge variant={item.passed ? "default" : "destructive"}>
                目标音 {item.targetScore}/{item.threshold}
              </Badge>
            </div>
            <div className="mt-2 grid gap-2 md:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-md bg-muted/40 p-2">
                <p className="text-xs font-semibold text-muted-foreground">
                  命中词
                </p>
                <p
                  className={`${getCenteredReadableTextClassName(
                    getPracticeTextDensity(
                      item.matchedWords.slice(0, 6).join(", "),
                      "phrase",
                    ),
                  )} mt-1 font-mono`}
                >
                  {item.matchedWords.slice(0, 6).join(", ")}
                </p>
              </div>
              <div className="rounded-md bg-primary/5 p-2">
                <p className="text-xs font-semibold text-muted-foreground">
                  下一次只改
                </p>
                <p className="mt-1 break-words text-center text-sm font-medium text-primary [overflow-wrap:anywhere]">
                  {item.passed
                    ? "这次能迁移到自己的句子里，下一轮换新句子复测。"
                    : item.nextCue}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
