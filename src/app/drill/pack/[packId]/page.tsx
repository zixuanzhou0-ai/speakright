import { Suspense } from "react";
import { TRAINING_PACKS } from "@/lib/training-packs";
import PackRunnerClient from "./pack-runner-client";

export function generateStaticParams() {
  return TRAINING_PACKS.map((pack) => ({ packId: pack.id }));
}

export default function PackPage() {
  return (
    <Suspense fallback={null}>
      <PackRunnerClient />
    </Suspense>
  );
}
