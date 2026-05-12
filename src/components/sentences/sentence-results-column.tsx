"use client";

import { FeedbackDisplay } from "@/components/feedback/feedback-display";
import { PhonemeHighlight } from "@/components/scoring/phoneme-highlight";
import { WordHighlight } from "@/components/scoring/word-highlight";
import type { FeedbackData } from "@/hooks/use-llm-feedback";
import type {
  AzureAssessmentResult,
  AzureSyllable,
  AzureWord,
} from "@/types/azure";

interface SentenceResultsColumnProps {
  hasResult: boolean;
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
}

export function SentenceResultsColumn({
  hasResult,
  result,
  selectedWord,
  stressedSyllables,
  onWordClick,
  feedback,
  isStreaming,
  hasFeedback,
  llmError,
  onRetryFeedback,
}: SentenceResultsColumnProps) {
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
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
              逐词评分（点击查看音素详情）
            </h2>
            <WordHighlight words={result.words} onWordClick={onWordClick} />
          </section>
        )}

        {selectedWord && selectedWord.phonemes.length > 0 ? (
          <section className="mt-4 border-t pt-4">
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
              &quot;{selectedWord.word}&quot; 音素详情
            </h2>
            <PhonemeHighlight
              phonemes={selectedWord.phonemes}
              syllables={stressedSyllables}
            />
          </section>
        ) : result ? (
          <div className="mt-4 flex items-center justify-center rounded-lg border border-dashed bg-muted/20 p-4">
            <p className="text-center text-sm text-muted-foreground">
              点击上方单词查看音标拆解
            </p>
          </div>
        ) : null}
      </div>

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
