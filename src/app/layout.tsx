import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import { ErrorBoundary } from "@/components/common/error-boundary";
import { DevErrorOverlay } from "@/components/layout/dev-error-overlay";
import { KeyHydrator } from "@/components/layout/key-hydrator";
import { Sidebar } from "@/components/layout/sidebar";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { Titlebar } from "@/components/layout/titlebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const fontVariables = {
  "--font-manrope": '"Manrope", "Aptos Display", ui-sans-serif, system-ui, sans-serif',
  "--font-inter": '"Inter", "Microsoft YaHei UI", ui-sans-serif, system-ui, sans-serif',
  "--font-geist-mono": '"Geist Mono", "SFMono-Regular", Consolas, monospace',
} as CSSProperties;

export const metadata: Metadata = {
  title: "SpeakRight - 发音练习",
  description: "AI 驱动的美式英语发音矫正工具，帮助中国学生提升发音准确度",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className="h-full antialiased"
      style={fontVariables}
      suppressHydrationWarning
    >
      <body
        className="h-screen flex flex-col overflow-hidden"
        suppressHydrationWarning
      >
        <ThemeProvider>
          <DevErrorOverlay />
          <KeyHydrator />
          <TooltipProvider>
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
            >
              跳转到主内容
            </a>
            <Titlebar />
            <div className="flex flex-1 min-h-0 overflow-hidden">
              <Sidebar />
              <main id="main-content" className="flex-1 h-full overflow-hidden">
                <ErrorBoundary>{children}</ErrorBoundary>
              </main>
            </div>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
