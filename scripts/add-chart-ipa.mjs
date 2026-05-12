import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(__dirname, "..", "src/lib/phoneme-data.ts");

let data = readFileSync(FILE, "utf-8");

const ipaData = {
  pig: ["/pɪɡ/", "p"],
  bear: ["/bɛɹ/", "b"],
  turtle: ["/ˈtɝ·təɫ/", "t"],
  dog: ["/dɔg/", "d"],
  cat: ["/kæt/", "k"],
  goat: ["/goʊt/", "g"],
  panther: ["/ˈpæn·θɝ/", "θ"],
  frog: ["/fɹɑg/", "f"],
  feather: ["/ˈfɛð·ɝ/", "ð"],
  beaver: ["/ˈbi·vɝ/", "v"],
  snake: ["/sneɪk/", "s"],
  zebra: ["/ˈzi·bɹə/", "z"],
  sheep: ["/ʃip/", "ʃ"],
  television: ["/ˈtɛɫ·əˌvɪʒ·ən/", "ʒ"],
  chicken: ["/ˈtʃɪk·ɪn/", "tʃ"],
  giraffe: ["/dʒəˈɹæf/", "dʒ"],
  mouse: ["/maʊs/", "m"],
  dinosaur: ["/ˈdɑɪ·nəˌsɔɹ/", "n"],
  penguin: ["/ˈpɛŋ·gwən/", "ŋ"],
  lion: ["/ˈɫɑɪ·ən/", "ɫ"],
  rabbit: ["/ˈɹæb·ɪt/", "ɹ"],
  wolf: ["/wʊɫf/", "w"],
  yak: ["/jæk/", "j"],
  horse: ["/hɔɹs/", "h"],
  green: ["/gɹin/", "i"],
  blue: ["/bɫu/", "u"],
  pink: ["/pɪnk/", "ɪ"],
  wood: ["/wʊd/", "ʊ"],
  dust: ["/dəst/", "ə"],
  red: ["/ɹɛd/", "ɛ"],
  purple: ["/ˈpɝ·pəɫ/", "ɝ"],
  mauve: ["/mɔv/", "ɔ"],
  sand: ["/sænd/", "æ"],
  coffee: ["/ˈkɑ·fi/", "ɑ"],
  jade: ["/dʒeɪd/", "eɪ"],
  lime: ["/ɫaɪm/", "aɪ"],
  brown: ["/bɹaʊn/", "aʊ"],
  gold: ["/goʊɫd/", "oʊ"],
  turquoise: ["/ˈtɝ·kɔɪz/", "ɔɪ"],
  cup: ["/kʌp/", "ʌ"],
};

for (const [word, [ipa, highlight]] of Object.entries(ipaData)) {
  const pattern = `chartWord: "${word}"`;
  const idx = data.indexOf(pattern);
  if (idx === -1) {
    console.log(`MISSING: ${word}`);
    continue;
  }
  const imageIdx = data.indexOf("chartImage:", idx);
  const lineEnd = data.indexOf(",\n", imageIdx);
  const insertion = `,\n    chartIpa: "${ipa}",\n    chartIpaHighlight: "${highlight}"`;
  data = data.substring(0, lineEnd) + insertion + data.substring(lineEnd);
}

writeFileSync(FILE, data);
console.log("Done! Added chartIpa to all phonemes.");
