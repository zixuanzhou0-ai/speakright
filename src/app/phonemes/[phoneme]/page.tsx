import { getAllSlugs } from "@/lib/phoneme-data";
import { PhonemeDetailPage } from "./phoneme-detail-page";

export function generateStaticParams() {
  return getAllSlugs().map((phoneme) => ({ phoneme }));
}

export default function Page() {
  return <PhonemeDetailPage />;
}
