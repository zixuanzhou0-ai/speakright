"use client";

import type { ReactNode } from "react";
import { LanguageCoreOnlyBoundary } from "@/components/common/language-core-only-boundary";

export default function AssessmentLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <LanguageCoreOnlyBoundary moduleName="发音诊断" capabilityRoute="diagnosis">
      {children}
    </LanguageCoreOnlyBoundary>
  );
}
