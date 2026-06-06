import { getAllLanguagePhonemeSlugs } from "@/lib/language-phonemes";
import { PhonemeDetailPage } from "./phoneme-detail-page";

export function generateStaticParams() {
  return getAllLanguagePhonemeSlugs().map((phoneme) => ({ phoneme }));
}

export default function Page() {
  return <PhonemeDetailPage />;
}
