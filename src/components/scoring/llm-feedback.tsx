"use client";

import { MessageSquareText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface LlmFeedbackProps {
  feedback: string;
  isStreaming: boolean;
  error?: string | null;
}

export function LlmFeedback({
  feedback,
  isStreaming,
  error,
}: LlmFeedbackProps) {
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
        {error}
      </div>
    );
  }

  if (!feedback && !isStreaming) return null;

  return (
    <div className="flex flex-col h-full rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="shrink-0 px-5 pt-5 pb-3 flex items-center gap-2">
        <MessageSquareText className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">AI 教练反馈</h3>
        {isStreaming && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            生成中
          </span>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5 scrollbar-thin">
        <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:border-l-2 prose-headings:border-primary prose-headings:pl-3 prose-headings:mt-6 prose-headings:mb-3 prose-headings:text-base prose-headings:font-bold prose-p:my-2 prose-p:leading-relaxed prose-hr:my-5 prose-hr:border-border/50 prose-li:marker:text-primary prose-strong:text-foreground">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              hr: () => <hr className="my-5 border-border/50" />,
              h2: ({ children }) => (
                <h2 className="mt-6 mb-3 text-base font-bold border-l-2 border-primary pl-3">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="mt-5 mb-2 text-sm font-bold border-l-2 border-primary pl-3">
                  {children}
                </h3>
              ),
            }}
          >
            {feedback}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
