"use client";

import { ChevronDown, MessageSquareText } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { FeedbackData } from "@/hooks/use-llm-feedback";

interface FeedbackDisplayProps {
  feedback: FeedbackData;
  isStreaming: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const expandTransition = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
};

const markdownComponents = {
  hr: () => <hr className="my-5 border-border/50" />,
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mt-6 mb-3 text-base font-bold border-l-2 border-primary pl-3">
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mt-5 mb-2 text-sm font-bold border-l-2 border-primary pl-3">
      {children}
    </h3>
  ),
};

function ExpandButton({
  label,
  expanded,
  onClick,
}: {
  label: string;
  expanded: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 15 }}
      className="mt-4 flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer"
    >
      <motion.span
        animate={{ rotate: expanded ? 180 : 0 }}
        transition={expandTransition}
        className="inline-flex"
      >
        <ChevronDown className="h-4 w-4" />
      </motion.span>
      {label}
    </motion.button>
  );
}

export function FeedbackDisplay({
  feedback,
  isStreaming,
  error,
  onRetry,
}: FeedbackDisplayProps) {
  const [layer2Open, setLayer2Open] = useState(false);
  const [layer3Open, setLayer3Open] = useState(false);

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30"
      >
        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 rounded-md bg-red-100 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-300 dark:hover:bg-red-900/70 cursor-pointer"
          >
            重试
          </button>
        )}
      </div>
    );
  }

  const hasContent = feedback.summary || feedback.topIssues || isStreaming;

  if (!hasContent) return null;

  return (
    <div className="flex flex-col h-full rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-5 py-4 flex items-center gap-2">
        <MessageSquareText className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">AI 教练反馈</h3>
        {isStreaming && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            生成中
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5 scrollbar-thin">
        {/* Layer 1: Summary + Top Issues (always visible) */}
        {feedback.summary && (
          <p className="text-base font-medium text-foreground leading-relaxed">
            {feedback.summary}
          </p>
        )}

        {feedback.topIssues && (
          <div className="mt-3 space-y-2">
            {feedback.topIssues
              .split("\n")
              .filter((line) => line.trim().startsWith("-"))
              .map((line) => (
                <div
                  key={line}
                  className="flex items-start gap-2 text-sm text-foreground/90 leading-relaxed"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{line.replace(/^-\s*/, "")}</span>
                </div>
              ))}
          </div>
        )}

        {/* Priority fixes — always visible, most actionable */}
        {feedback.priorityFixes && (
          <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
            <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-sm prose-headings:font-bold prose-headings:mt-3 prose-headings:mb-1 prose-p:my-1.5 prose-p:leading-relaxed prose-strong:text-primary">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
                {feedback.priorityFixes}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* Layer 2 toggle */}
        {feedback.dimensions && (
          <>
            <ExpandButton
              label={layer2Open ? "收起详细分析" : "查看详细分析"}
              expanded={layer2Open}
              onClick={() => setLayer2Open(!layer2Open)}
            />

            <AnimatePresence initial={false}>
              {layer2Open && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={expandTransition}
                  className="overflow-hidden"
                >
                  <div className="pt-3 prose prose-sm dark:prose-invert max-w-none prose-strong:text-primary prose-p:my-1.5 prose-p:leading-relaxed">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={markdownComponents}
                    >
                      {feedback.dimensions}
                    </ReactMarkdown>
                  </div>

                  {/* Layer 3 toggle */}
                  {feedback.details && (
                    <>
                      <ExpandButton
                        label={layer3Open ? "收起完整技术分析" : "完整技术分析"}
                        expanded={layer3Open}
                        onClick={() => setLayer3Open(!layer3Open)}
                      />

                      <AnimatePresence initial={false}>
                        {layer3Open && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={expandTransition}
                            className="overflow-hidden"
                          >
                            <div className="pt-3 prose prose-sm dark:prose-invert max-w-none prose-headings:border-l-2 prose-headings:border-primary prose-headings:pl-3 prose-headings:mt-6 prose-headings:mb-3 prose-headings:text-base prose-headings:font-bold prose-p:my-2 prose-p:leading-relaxed prose-hr:my-5 prose-hr:border-border/50 prose-li:marker:text-primary prose-strong:text-foreground">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={markdownComponents}
                              >
                                {feedback.details}
                              </ReactMarkdown>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* Streaming indicator when no content yet */}
        {isStreaming && !feedback.summary && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            正在分析你的发音...
          </div>
        )}
      </div>
    </div>
  );
}
