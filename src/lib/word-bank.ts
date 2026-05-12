import type { KeywordEntry } from "@/types/phoneme";

/**
 * Extended word pool per phoneme slug.
 * These supplement the 8 static keywords in phoneme-data.ts.
 * IPA aligned to 欧陆词典美式音标 conventions.
 */
export const WORD_BANK: Record<string, KeywordEntry[]> = {
  // ===== Vowels =====

  // /iː/ — close front unrounded
  ee: [
    { word: "feel", ipa: "/fiːl/" },
    { word: "meet", ipa: "/miːt/" },
    { word: "clean", ipa: "/kliːn/" },
    { word: "team", ipa: "/tiːm/" },
    { word: "read", ipa: "/riːd/" },
    { word: "keep", ipa: "/kiːp/" },
    { word: "need", ipa: "/niːd/" },
    { word: "week", ipa: "/wiːk/" },
    { word: "speed", ipa: "/spiːd/" },
    { word: "cream", ipa: "/kriːm/" },
    { word: "sweet", ipa: "/swiːt/" },
    { word: "freeze", ipa: "/friːz/" },
  ],

  // /ɪ/ — near-close near-front unrounded
  ih: [
    { word: "swim", ipa: "/swɪm/" },
    { word: "thin", ipa: "/θɪn/" },
    { word: "trick", ipa: "/trɪk/" },
    { word: "skip", ipa: "/skɪp/" },
    { word: "fill", ipa: "/fɪl/" },
    { word: "stick", ipa: "/stɪk/" },
    { word: "click", ipa: "/klɪk/" },
    { word: "drink", ipa: "/drɪŋk/" },
    { word: "wish", ipa: "/wɪʃ/" },
    { word: "print", ipa: "/prɪnt/" },
    { word: "grin", ipa: "/ɡrɪn/" },
    { word: "brick", ipa: "/brɪk/" },
  ],

  // /eɪ/ — diphthong
  ey: [
    { word: "face", ipa: "/feɪs/" },
    { word: "take", ipa: "/teɪk/" },
    { word: "safe", ipa: "/seɪf/" },
    { word: "shape", ipa: "/ʃeɪp/" },
    { word: "break", ipa: "/breɪk/" },
    { word: "place", ipa: "/pleɪs/" },
    { word: "train", ipa: "/treɪn/" },
    { word: "taste", ipa: "/teɪst/" },
    { word: "blame", ipa: "/bleɪm/" },
    { word: "grade", ipa: "/ɡreɪd/" },
    { word: "flame", ipa: "/fleɪm/" },
    { word: "chase", ipa: "/tʃeɪs/" },
  ],

  // /e/ — open-mid front unrounded
  eh: [
    { word: "ten", ipa: "/ten/" },
    { word: "check", ipa: "/tʃek/" },
    { word: "spend", ipa: "/spend/" },
    { word: "fresh", ipa: "/freʃ/" },
    { word: "test", ipa: "/test/" },
    { word: "desk", ipa: "/desk/" },
    { word: "neck", ipa: "/nek/" },
    { word: "next", ipa: "/nekst/" },
    { word: "bread", ipa: "/bred/" },
    { word: "spell", ipa: "/spel/" },
    { word: "press", ipa: "/pres/" },
    { word: "blend", ipa: "/blend/" },
  ],

  // /æ/ — near-open front unrounded
  ae: [
    { word: "back", ipa: "/bæk/" },
    { word: "glass", ipa: "/ɡlæs/" },
    { word: "match", ipa: "/mætʃ/" },
    { word: "crash", ipa: "/kræʃ/" },
    { word: "grab", ipa: "/ɡræb/" },
    { word: "stamp", ipa: "/stæmp/" },
    { word: "flag", ipa: "/flæɡ/" },
    { word: "snap", ipa: "/snæp/" },
    { word: "track", ipa: "/træk/" },
    { word: "clap", ipa: "/klæp/" },
    { word: "math", ipa: "/mæθ/" },
    { word: "ranch", ipa: "/ræntʃ/" },
  ],

  // /ɑː/ — open back unrounded
  ah: [
    { word: "rock", ipa: "/rɑːk/" },
    { word: "box", ipa: "/bɑːks/" },
    { word: "drop", ipa: "/drɑːp/" },
    { word: "clock", ipa: "/klɑːk/" },
    { word: "shop", ipa: "/ʃɑːp/" },
    { word: "lock", ipa: "/lɑːk/" },
    { word: "calm", ipa: "/kɑːm/" },
    { word: "palm", ipa: "/pɑːm/" },
    { word: "job", ipa: "/dʒɑːb/" },
    { word: "cop", ipa: "/kɑːp/" },
    { word: "dot", ipa: "/dɑːt/" },
    { word: "stock", ipa: "/stɑːk/" },
  ],

  // /ɔː/ — open-mid back rounded
  aw: [
    { word: "door", ipa: "/dɔːr/" },
    { word: "more", ipa: "/mɔːr/" },
    { word: "sort", ipa: "/sɔːrt/" },
    { word: "born", ipa: "/bɔːrn/" },
    { word: "cause", ipa: "/kɔːz/" },
    { word: "sauce", ipa: "/sɔːs/" },
    { word: "force", ipa: "/fɔːrs/" },
    { word: "sport", ipa: "/spɔːrt/" },
    { word: "floor", ipa: "/flɔːr/" },
    { word: "storm", ipa: "/stɔːrm/" },
    { word: "warm", ipa: "/wɔːrm/" },
    { word: "horse", ipa: "/hɔːrs/" },
  ],

  // /oʊ/ — diphthong
  oh: [
    { word: "stone", ipa: "/stoʊn/" },
    { word: "phone", ipa: "/foʊn/" },
    { word: "close", ipa: "/kloʊz/" },
    { word: "smoke", ipa: "/smoʊk/" },
    { word: "grow", ipa: "/ɡroʊ/" },
    { word: "flow", ipa: "/floʊ/" },
    { word: "bone", ipa: "/boʊn/" },
    { word: "code", ipa: "/koʊd/" },
    { word: "note", ipa: "/noʊt/" },
    { word: "hope", ipa: "/hoʊp/" },
    { word: "throw", ipa: "/θroʊ/" },
    { word: "globe", ipa: "/ɡloʊb/" },
  ],

  // /ʊ/ — near-close near-back rounded
  uh: [
    { word: "pull", ipa: "/pʊl/" },
    { word: "full", ipa: "/fʊl/" },
    { word: "bull", ipa: "/bʊl/" },
    { word: "wolf", ipa: "/wʊlf/" },
    { word: "bush", ipa: "/bʊʃ/" },
    { word: "hook", ipa: "/hʊk/" },
    { word: "stood", ipa: "/stʊd/" },
    { word: "could", ipa: "/kʊd/" },
    { word: "would", ipa: "/wʊd/" },
    { word: "should", ipa: "/ʃʊd/" },
    { word: "sugar", ipa: "/ˈʃʊɡər/" },
    { word: "wool", ipa: "/wʊl/" },
  ],

  // /uː/ — close back rounded
  oo: [
    { word: "room", ipa: "/ruːm/" },
    { word: "choose", ipa: "/tʃuːz/" },
    { word: "pool", ipa: "/puːl/" },
    { word: "prove", ipa: "/pruːv/" },
    { word: "fruit", ipa: "/fruːt/" },
    { word: "smooth", ipa: "/smuːð/" },
    { word: "group", ipa: "/ɡruːp/" },
    { word: "loose", ipa: "/luːs/" },
    { word: "rule", ipa: "/ruːl/" },
    { word: "shoot", ipa: "/ʃuːt/" },
    { word: "boot", ipa: "/buːt/" },
    { word: "goose", ipa: "/ɡuːs/" },
  ],

  // /ʌ/ — open-mid back unrounded
  uh2: [
    { word: "dust", ipa: "/dʌst/" },
    { word: "jump", ipa: "/dʒʌmp/" },
    { word: "shut", ipa: "/ʃʌt/" },
    { word: "crush", ipa: "/krʌʃ/" },
    { word: "stuff", ipa: "/stʌf/" },
    { word: "club", ipa: "/klʌb/" },
    { word: "drum", ipa: "/drʌm/" },
    { word: "stuck", ipa: "/stʌk/" },
    { word: "brush", ipa: "/brʌʃ/" },
    { word: "trust", ipa: "/trʌst/" },
    { word: "blood", ipa: "/blʌd/" },
    { word: "month", ipa: "/mʌnθ/" },
  ],

  // /ə/ — mid central (schwa)
  schwa: [
    { word: "above", ipa: "/əˈbʌv/" },
    { word: "alone", ipa: "/əˈloʊn/" },
    { word: "begin", ipa: "/bɪˈɡɪn/" },
    { word: "common", ipa: "/ˈkɑːmən/" },
    { word: "happen", ipa: "/ˈhæpən/" },
    { word: "lesson", ipa: "/ˈlesn/" },
    { word: "support", ipa: "/səˈpɔːrt/" },
    { word: "perhaps", ipa: "/pərˈhæps/" },
    { word: "famous", ipa: "/ˈfeɪməs/" },
    { word: "suggest", ipa: "/səˈdʒest/" },
    { word: "supply", ipa: "/səˈplaɪ/" },
    { word: "suppose", ipa: "/səˈpoʊz/" },
  ],

  // /ɜːr/ — rhotacized mid central
  er: [
    { word: "work", ipa: "/wɜːrk/" },
    { word: "girl", ipa: "/ɡɜːrl/" },
    { word: "hurt", ipa: "/hɜːrt/" },
    { word: "search", ipa: "/sɜːrtʃ/" },
    { word: "world", ipa: "/wɜːrld/" },
    { word: "church", ipa: "/tʃɜːrtʃ/" },
    { word: "shirt", ipa: "/ʃɜːrt/" },
    { word: "curve", ipa: "/kɜːrv/" },
    { word: "third", ipa: "/θɜːrd/" },
    { word: "verb", ipa: "/vɜːrb/" },
    { word: "merge", ipa: "/mɜːrdʒ/" },
    { word: "worth", ipa: "/wɜːrθ/" },
  ],

  // /aɪ/ — diphthong
  ai: [
    { word: "life", ipa: "/laɪf/" },
    { word: "write", ipa: "/raɪt/" },
    { word: "find", ipa: "/faɪnd/" },
    { word: "mind", ipa: "/maɪnd/" },
    { word: "climb", ipa: "/klaɪm/" },
    { word: "bright", ipa: "/braɪt/" },
    { word: "prize", ipa: "/praɪz/" },
    { word: "knife", ipa: "/naɪf/" },
    { word: "tribe", ipa: "/traɪb/" },
    { word: "slide", ipa: "/slaɪd/" },
    { word: "stripe", ipa: "/straɪp/" },
    { word: "blind", ipa: "/blaɪnd/" },
  ],

  // /aʊ/ — diphthong
  au: [
    { word: "sound", ipa: "/saʊnd/" },
    { word: "mouth", ipa: "/maʊθ/" },
    { word: "crowd", ipa: "/kraʊd/" },
    { word: "ground", ipa: "/ɡraʊnd/" },
    { word: "proud", ipa: "/praʊd/" },
    { word: "shout", ipa: "/ʃaʊt/" },
    { word: "count", ipa: "/kaʊnt/" },
    { word: "found", ipa: "/faʊnd/" },
    { word: "scout", ipa: "/skaʊt/" },
    { word: "power", ipa: "/ˈpaʊər/" },
    { word: "flour", ipa: "/flaʊr/" },
    { word: "frown", ipa: "/fraʊn/" },
  ],

  // /ɔɪ/ — diphthong
  oi: [
    { word: "toy", ipa: "/tɔɪ/" },
    { word: "choice", ipa: "/tʃɔɪs/" },
    { word: "moist", ipa: "/mɔɪst/" },
    { word: "spoil", ipa: "/spɔɪl/" },
    { word: "royal", ipa: "/ˈrɔɪəl/" },
    { word: "loyal", ipa: "/ˈlɔɪəl/" },
    { word: "avoid", ipa: "/əˈvɔɪd/" },
    { word: "soil", ipa: "/sɔɪl/" },
    { word: "boil", ipa: "/bɔɪl/" },
    { word: "destroy", ipa: "/dɪˈstrɔɪ/" },
    { word: "employ", ipa: "/ɪmˈplɔɪ/" },
    { word: "joyful", ipa: "/ˈdʒɔɪfl/" },
  ],

  // ===== Consonants =====

  // /p/ — voiceless bilabial plosive
  p: [
    { word: "pick", ipa: "/pɪk/" },
    { word: "push", ipa: "/pʊʃ/" },
    { word: "drop", ipa: "/drɑːp/" },
    { word: "price", ipa: "/praɪs/" },
    { word: "spring", ipa: "/sprɪŋ/" },
    { word: "simple", ipa: "/ˈsɪmpl/" },
    { word: "clap", ipa: "/klæp/" },
    { word: "plant", ipa: "/plænt/" },
    { word: "proof", ipa: "/pruːf/" },
    { word: "sharp", ipa: "/ʃɑːrp/" },
    { word: "stamp", ipa: "/stæmp/" },
    { word: "split", ipa: "/splɪt/" },
  ],

  // /b/ — voiced bilabial plosive
  b: [
    { word: "best", ipa: "/best/" },
    { word: "bring", ipa: "/brɪŋ/" },
    { word: "brain", ipa: "/breɪn/" },
    { word: "rob", ipa: "/rɑːb/" },
    { word: "bold", ipa: "/boʊld/" },
    { word: "brand", ipa: "/brænd/" },
    { word: "blend", ipa: "/blend/" },
    { word: "globe", ipa: "/ɡloʊb/" },
    { word: "climb", ipa: "/klaɪm/" },
    { word: "block", ipa: "/blɑːk/" },
    { word: "tribe", ipa: "/traɪb/" },
    { word: "bulb", ipa: "/bʌlb/" },
  ],

  // /t/ — voiceless alveolar plosive
  t: [
    { word: "top", ipa: "/tɑːp/" },
    { word: "test", ipa: "/test/" },
    { word: "fast", ipa: "/fæst/" },
    { word: "trust", ipa: "/trʌst/" },
    { word: "street", ipa: "/striːt/" },
    { word: "plant", ipa: "/plænt/" },
    { word: "chest", ipa: "/tʃest/" },
    { word: "twist", ipa: "/twɪst/" },
    { word: "split", ipa: "/splɪt/" },
    { word: "tight", ipa: "/taɪt/" },
    { word: "treat", ipa: "/triːt/" },
    { word: "script", ipa: "/skrɪpt/" },
  ],

  // /d/ — voiced alveolar plosive
  d: [
    { word: "deep", ipa: "/diːp/" },
    { word: "drive", ipa: "/draɪv/" },
    { word: "build", ipa: "/bɪld/" },
    { word: "mind", ipa: "/maɪnd/" },
    { word: "speed", ipa: "/spiːd/" },
    { word: "blend", ipa: "/blend/" },
    { word: "slide", ipa: "/slaɪd/" },
    { word: "ground", ipa: "/ɡraʊnd/" },
    { word: "cloud", ipa: "/klaʊd/" },
    { word: "draft", ipa: "/dræft/" },
    { word: "judge", ipa: "/dʒʌdʒ/" },
    { word: "shade", ipa: "/ʃeɪd/" },
  ],

  // /k/ — voiceless velar plosive
  k: [
    { word: "cold", ipa: "/koʊld/" },
    { word: "click", ipa: "/klɪk/" },
    { word: "track", ipa: "/træk/" },
    { word: "stock", ipa: "/stɑːk/" },
    { word: "trick", ipa: "/trɪk/" },
    { word: "clock", ipa: "/klɑːk/" },
    { word: "skill", ipa: "/skɪl/" },
    { word: "crack", ipa: "/kræk/" },
    { word: "check", ipa: "/tʃek/" },
    { word: "knock", ipa: "/nɑːk/" },
    { word: "blank", ipa: "/blæŋk/" },
    { word: "strike", ipa: "/straɪk/" },
  ],

  // /ɡ/ — voiced velar plosive
  g: [
    { word: "grab", ipa: "/ɡræb/" },
    { word: "goal", ipa: "/ɡoʊl/" },
    { word: "glad", ipa: "/ɡlæd/" },
    { word: "grade", ipa: "/ɡreɪd/" },
    { word: "drag", ipa: "/dræɡ/" },
    { word: "flag", ipa: "/flæɡ/" },
    { word: "plug", ipa: "/plʌɡ/" },
    { word: "drug", ipa: "/drʌɡ/" },
    { word: "guess", ipa: "/ɡes/" },
    { word: "ghost", ipa: "/ɡoʊst/" },
    { word: "grind", ipa: "/ɡraɪnd/" },
    { word: "guide", ipa: "/ɡaɪd/" },
  ],

  // /f/ — voiceless labiodental fricative
  f: [
    { word: "fact", ipa: "/fækt/" },
    { word: "roof", ipa: "/ruːf/" },
    { word: "fruit", ipa: "/fruːt/" },
    { word: "chief", ipa: "/tʃiːf/" },
    { word: "flesh", ipa: "/fleʃ/" },
    { word: "flame", ipa: "/fleɪm/" },
    { word: "staff", ipa: "/stæf/" },
    { word: "draft", ipa: "/dræft/" },
    { word: "swift", ipa: "/swɪft/" },
    { word: "frost", ipa: "/frɔːst/" },
    { word: "shelf", ipa: "/ʃelf/" },
    { word: "cliff", ipa: "/klɪf/" },
  ],

  // /v/ — voiced labiodental fricative
  v: [
    { word: "vast", ipa: "/væst/" },
    { word: "give", ipa: "/ɡɪv/" },
    { word: "solve", ipa: "/sɑːlv/" },
    { word: "valve", ipa: "/vælv/" },
    { word: "vine", ipa: "/vaɪn/" },
    { word: "prove", ipa: "/pruːv/" },
    { word: "curve", ipa: "/kɜːrv/" },
    { word: "nerve", ipa: "/nɜːrv/" },
    { word: "vivid", ipa: "/ˈvɪvɪd/" },
    { word: "stove", ipa: "/stoʊv/" },
    { word: "shave", ipa: "/ʃeɪv/" },
    { word: "glove", ipa: "/ɡlʌv/" },
  ],

  // /θ/ — voiceless dental fricative
  th: [
    { word: "thick", ipa: "/θɪk/" },
    { word: "throw", ipa: "/θroʊ/" },
    { word: "truth", ipa: "/truːθ/" },
    { word: "fifth", ipa: "/fɪfθ/" },
    { word: "depth", ipa: "/depθ/" },
    { word: "cloth", ipa: "/klɔːθ/" },
    { word: "theme", ipa: "/θiːm/" },
    { word: "throat", ipa: "/θroʊt/" },
    { word: "thrill", ipa: "/θrɪl/" },
    { word: "growth", ipa: "/ɡroʊθ/" },
    { word: "strength", ipa: "/streŋθ/" },
    { word: "thumb", ipa: "/θʌm/" },
  ],

  // /ð/ — voiced dental fricative
  dh: [
    { word: "these", ipa: "/ðiːz/" },
    { word: "those", ipa: "/ðoʊz/" },
    { word: "there", ipa: "/ðer/" },
    { word: "then", ipa: "/ðen/" },
    { word: "though", ipa: "/ðoʊ/" },
    { word: "father", ipa: "/ˈfɑːðər/" },
    { word: "breathe", ipa: "/briːð/" },
    { word: "bathe", ipa: "/beɪð/" },
    { word: "clothe", ipa: "/kloʊð/" },
    { word: "soothe", ipa: "/suːð/" },
    { word: "within", ipa: "/wɪˈðɪn/" },
    { word: "rhythm", ipa: "/ˈrɪðəm/" },
  ],

  // /s/ — voiceless alveolar fricative
  s: [
    { word: "soft", ipa: "/sɔːft/" },
    { word: "stop", ipa: "/stɑːp/" },
    { word: "cross", ipa: "/krɔːs/" },
    { word: "space", ipa: "/speɪs/" },
    { word: "sense", ipa: "/sens/" },
    { word: "slice", ipa: "/slaɪs/" },
    { word: "strict", ipa: "/strɪkt/" },
    { word: "skill", ipa: "/skɪl/" },
    { word: "stress", ipa: "/stres/" },
    { word: "smooth", ipa: "/smuːð/" },
    { word: "switch", ipa: "/swɪtʃ/" },
    { word: "split", ipa: "/splɪt/" },
  ],

  // /z/ — voiced alveolar fricative
  z: [
    { word: "zone", ipa: "/zoʊn/" },
    { word: "size", ipa: "/saɪz/" },
    { word: "prize", ipa: "/praɪz/" },
    { word: "freeze", ipa: "/friːz/" },
    { word: "choose", ipa: "/tʃuːz/" },
    { word: "quiz", ipa: "/kwɪz/" },
    { word: "breeze", ipa: "/briːz/" },
    { word: "raise", ipa: "/reɪz/" },
    { word: "phase", ipa: "/feɪz/" },
    { word: "close", ipa: "/kloʊz/" },
    { word: "cause", ipa: "/kɔːz/" },
    { word: "bronze", ipa: "/brɑːnz/" },
  ],

  // /ʃ/ — voiceless postalveolar fricative
  sh: [
    { word: "shade", ipa: "/ʃeɪd/" },
    { word: "crash", ipa: "/kræʃ/" },
    { word: "brush", ipa: "/brʌʃ/" },
    { word: "shelf", ipa: "/ʃelf/" },
    { word: "shine", ipa: "/ʃaɪn/" },
    { word: "shape", ipa: "/ʃeɪp/" },
    { word: "shift", ipa: "/ʃɪft/" },
    { word: "crush", ipa: "/krʌʃ/" },
    { word: "flash", ipa: "/flæʃ/" },
    { word: "sharp", ipa: "/ʃɑːrp/" },
    { word: "shout", ipa: "/ʃaʊt/" },
    { word: "push", ipa: "/pʊʃ/" },
  ],

  // /ʒ/ — voiced postalveolar fricative
  zh: [
    { word: "rouge", ipa: "/ruːʒ/" },
    { word: "genre", ipa: "/ˈʒɑːnrə/" },
    { word: "massage", ipa: "/məˈsɑːʒ/" },
    { word: "mirage", ipa: "/mɪˈrɑːʒ/" },
    { word: "fusion", ipa: "/ˈfjuːʒn/" },
    { word: "version", ipa: "/ˈvɜːrʒn/" },
    { word: "decision", ipa: "/dɪˈsɪʒn/" },
    { word: "occasion", ipa: "/əˈkeɪʒn/" },
    { word: "explosion", ipa: "/ɪkˈsploʊʒn/" },
    { word: "invasion", ipa: "/ɪnˈveɪʒn/" },
    { word: "confusion", ipa: "/kənˈfjuːʒn/" },
    { word: "collision", ipa: "/kəˈlɪʒn/" },
  ],

  // /tʃ/ — voiceless postalveolar affricate
  ch: [
    { word: "child", ipa: "/tʃaɪld/" },
    { word: "chain", ipa: "/tʃeɪn/" },
    { word: "choice", ipa: "/tʃɔɪs/" },
    { word: "match", ipa: "/mætʃ/" },
    { word: "stretch", ipa: "/stretʃ/" },
    { word: "chest", ipa: "/tʃest/" },
    { word: "cheap", ipa: "/tʃiːp/" },
    { word: "switch", ipa: "/swɪtʃ/" },
    { word: "branch", ipa: "/bræntʃ/" },
    { word: "sketch", ipa: "/sketʃ/" },
    { word: "charm", ipa: "/tʃɑːrm/" },
    { word: "pitch", ipa: "/pɪtʃ/" },
  ],

  // /dʒ/ — voiced postalveolar affricate
  dj: [
    { word: "gym", ipa: "/dʒɪm/" },
    { word: "huge", ipa: "/hjuːdʒ/" },
    { word: "edge", ipa: "/edʒ/" },
    { word: "page", ipa: "/peɪdʒ/" },
    { word: "change", ipa: "/tʃeɪndʒ/" },
    { word: "stage", ipa: "/steɪdʒ/" },
    { word: "charge", ipa: "/tʃɑːrdʒ/" },
    { word: "pledge", ipa: "/pledʒ/" },
    { word: "range", ipa: "/reɪndʒ/" },
    { word: "lodge", ipa: "/lɑːdʒ/" },
    { word: "badge", ipa: "/bædʒ/" },
    { word: "wedge", ipa: "/wedʒ/" },
  ],

  // /m/ — bilabial nasal
  m: [
    { word: "storm", ipa: "/stɔːrm/" },
    { word: "farm", ipa: "/fɑːrm/" },
    { word: "cream", ipa: "/kriːm/" },
    { word: "flame", ipa: "/fleɪm/" },
    { word: "smooth", ipa: "/smuːð/" },
    { word: "prime", ipa: "/praɪm/" },
    { word: "charm", ipa: "/tʃɑːrm/" },
    { word: "match", ipa: "/mætʃ/" },
    { word: "might", ipa: "/maɪt/" },
    { word: "month", ipa: "/mʌnθ/" },
    { word: "stamp", ipa: "/stæmp/" },
    { word: "climb", ipa: "/klaɪm/" },
  ],

  // /n/ — alveolar nasal
  n: [
    { word: "nine", ipa: "/naɪn/" },
    { word: "note", ipa: "/noʊt/" },
    { word: "stone", ipa: "/stoʊn/" },
    { word: "brain", ipa: "/breɪn/" },
    { word: "shine", ipa: "/ʃaɪn/" },
    { word: "plane", ipa: "/pleɪn/" },
    { word: "skin", ipa: "/skɪn/" },
    { word: "scan", ipa: "/skæn/" },
    { word: "train", ipa: "/treɪn/" },
    { word: "green", ipa: "/ɡriːn/" },
    { word: "blend", ipa: "/blend/" },
    { word: "print", ipa: "/prɪnt/" },
  ],

  // /ŋ/ — velar nasal
  ng: [
    { word: "bring", ipa: "/brɪŋ/" },
    { word: "song", ipa: "/sɔːŋ/" },
    { word: "spring", ipa: "/sprɪŋ/" },
    { word: "hang", ipa: "/hæŋ/" },
    { word: "tongue", ipa: "/tʌŋ/" },
    { word: "swing", ipa: "/swɪŋ/" },
    { word: "sting", ipa: "/stɪŋ/" },
    { word: "cling", ipa: "/klɪŋ/" },
    { word: "among", ipa: "/əˈmʌŋ/" },
    { word: "along", ipa: "/əˈlɔːŋ/" },
    { word: "belong", ipa: "/bɪˈlɔːŋ/" },
    { word: "string", ipa: "/strɪŋ/" },
  ],

  // /l/ — alveolar lateral approximant
  l: [
    { word: "land", ipa: "/lænd/" },
    { word: "still", ipa: "/stɪl/" },
    { word: "spell", ipa: "/spel/" },
    { word: "shall", ipa: "/ʃæl/" },
    { word: "sleep", ipa: "/sliːp/" },
    { word: "split", ipa: "/splɪt/" },
    { word: "cloud", ipa: "/klaʊd/" },
    { word: "flame", ipa: "/fleɪm/" },
    { word: "blind", ipa: "/blaɪnd/" },
    { word: "float", ipa: "/floʊt/" },
    { word: "skill", ipa: "/skɪl/" },
    { word: "blame", ipa: "/bleɪm/" },
  ],

  // /r/ — alveolar approximant
  r: [
    { word: "bring", ipa: "/brɪŋ/" },
    { word: "proud", ipa: "/praʊd/" },
    { word: "trail", ipa: "/treɪl/" },
    { word: "fresh", ipa: "/freʃ/" },
    { word: "crowd", ipa: "/kraʊd/" },
    { word: "spring", ipa: "/sprɪŋ/" },
    { word: "strong", ipa: "/strɔːŋ/" },
    { word: "cream", ipa: "/kriːm/" },
    { word: "grand", ipa: "/ɡrænd/" },
    { word: "throw", ipa: "/θroʊ/" },
    { word: "shrink", ipa: "/ʃrɪŋk/" },
    { word: "stripe", ipa: "/straɪp/" },
  ],

  // /w/ — labial-velar approximant
  w: [
    { word: "wind", ipa: "/wɪnd/" },
    { word: "wish", ipa: "/wɪʃ/" },
    { word: "wait", ipa: "/weɪt/" },
    { word: "west", ipa: "/west/" },
    { word: "world", ipa: "/wɜːrld/" },
    { word: "watch", ipa: "/wɑːtʃ/" },
    { word: "swim", ipa: "/swɪm/" },
    { word: "twist", ipa: "/twɪst/" },
    { word: "twice", ipa: "/twaɪs/" },
    { word: "swing", ipa: "/swɪŋ/" },
    { word: "witch", ipa: "/wɪtʃ/" },
    { word: "wrap", ipa: "/ræp/" },
  ],

  // /j/ — palatal approximant
  y: [
    { word: "yet", ipa: "/jet/" },
    { word: "your", ipa: "/jʊr/" },
    { word: "cute", ipa: "/kjuːt/" },
    { word: "huge", ipa: "/hjuːdʒ/" },
    { word: "unit", ipa: "/ˈjuːnɪt/" },
    { word: "human", ipa: "/ˈhjuːmən/" },
    { word: "fuel", ipa: "/fjuːl/" },
    { word: "argue", ipa: "/ˈɑːrɡjuː/" },
    { word: "value", ipa: "/ˈvæljuː/" },
    { word: "rescue", ipa: "/ˈreskjuː/" },
    { word: "beauty", ipa: "/ˈbjuːti/" },
    { word: "abuse", ipa: "/əˈbjuːz/" },
  ],

  // /h/ — voiceless glottal fricative
  h: [
    { word: "hurt", ipa: "/hɜːrt/" },
    { word: "hide", ipa: "/haɪd/" },
    { word: "heart", ipa: "/hɑːrt/" },
    { word: "help", ipa: "/help/" },
    { word: "high", ipa: "/haɪ/" },
    { word: "huge", ipa: "/hjuːdʒ/" },
    { word: "heat", ipa: "/hiːt/" },
    { word: "hint", ipa: "/hɪnt/" },
    { word: "host", ipa: "/hoʊst/" },
    { word: "hunt", ipa: "/hʌnt/" },
    { word: "harm", ipa: "/hɑːrm/" },
    { word: "hook", ipa: "/hʊk/" },
  ],
};

export function getExtendedWords(slug: string): KeywordEntry[] {
  return WORD_BANK[slug] ?? [];
}
