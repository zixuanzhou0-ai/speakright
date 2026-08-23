"use client";

import type { ReactNode } from "react";
import { LanguageCoreOnlyBoundary } from "@/components/common/language-core-only-boundary";

export default function DrillLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <LanguageCoreOnlyBoundary
      moduleName="刻意练习"
      capabilityRoute="guidedTraining"
    >
      {children}
    </LanguageCoreOnlyBoundary>
  );
}
