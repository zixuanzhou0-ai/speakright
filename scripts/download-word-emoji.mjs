/**
 * Download Microsoft Fluent Emoji 3D PNGs for keyword words.
 *
 * URL pattern:
 *   https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/{DirName}/3D/{file_name}_3d.png
 *
 * Usage: node scripts/download-word-emoji.mjs
 */

import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { get } from "node:https";
import { join } from "node:path";

const OUT_DIR = join(process.cwd(), "public", "images", "words");
const BASE =
  "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets";

// word → [DirName, file_name] mapping to Fluent Emoji 3D
// DirName is the asset folder name (Title Case), file_name is the png prefix (snake_case)
const WORD_EMOJI_MAP = {
  // Animals
  animal: ["Paw prints", "paw_prints"],
  baby: ["Baby", "baby"],
  banana: ["Banana", "banana"],
  bath: ["Bathtub", "bathtub"],
  beach: ["Beach with umbrella", "beach_with_umbrella"],
  bed: ["Bed", "bed"],
  bird: ["Bird", "bird"],
  boat: ["Sailboat", "sailboat"],
  book: ["Open book", "open_book"],
  boy: ["Boy", "boy"],
  bridge: ["Bridge at night", "bridge_at_night"],
  brother: ["Man", "man"],
  bus: ["Bus", "bus"],
  butterfly: ["Butterfly", "butterfly"],
  buzz: ["Honeybee", "honeybee"],
  cake: ["Shortcake", "shortcake"],
  call: ["Telephone receiver", "telephone_receiver"],
  camera: ["Camera", "camera"],
  car: ["Automobile", "automobile"],
  cat: ["Cat", "cat"],
  cheese: ["Cheese wedge", "cheese_wedge"],
  church: ["Church", "church"],
  city: ["Cityscape", "cityscape"],
  class: ["School", "school"],
  clean: ["Broom", "broom"],
  cloud: ["Cloud", "cloud"],
  club: ["Clinking glasses", "clinking_glasses"],
  coffee: ["Hot beverage", "hot_beverage"],
  coin: ["Coin", "coin"],
  cold: ["Snowflake", "snowflake"],
  cook: ["Cook", "cook"],
  cool: ["Smiling face with sunglasses", "smiling_face_with_sunglasses"],
  cup: ["Hot beverage", "hot_beverage"],
  daddy: ["Man", "man"],
  dark: ["New moon", "new_moon"],
  day: ["Sun", "sun"],
  deep: ["Water wave", "water_wave"],
  dinner: ["Fork and knife", "fork_and_knife"],
  dog: ["Dog", "dog"],
  draw: ["Crayon", "crayon"],
  dream: ["Thought balloon", "thought_balloon"],
  dress: ["Dress", "dress"],
  drive: ["Automobile", "automobile"],
  earth: ["Globe showing Americas", "globe_showing_americas"],
  eat: ["Fork and knife", "fork_and_knife"],
  egg: ["Egg", "egg"],
  face: ["Slightly smiling face", "slightly_smiling_face"],
  fall: ["Fallen leaf", "fallen_leaf"],
  father: ["Man", "man"],
  fire: ["Fire", "fire"],
  fish: ["Fish", "fish"],
  fly: ["Airplane", "airplane"],
  food: ["Bento box", "bento_box"],
  foot: ["Foot", "foot"],
  fresh: ["Herb", "herb"],
  fun: ["Party popper", "party_popper"],
  funny: ["Face with tears of joy", "face_with_tears_of_joy"],
  garage: ["House", "house"],
  gift: ["Wrapped gift", "wrapped_gift"],
  glass: ["Tumbler glass", "tumbler_glass"],
  go: ["Green circle", "green_circle"],
  green: ["Green circle", "green_circle"],
  grab: ["Pinching hand", "pinching_hand"],
  half: ["Pie", "pie"],
  hand: ["Raised hand", "raised_hand"],
  happy: ["Grinning face", "grinning_face"],
  head: ["Brain", "brain"],
  heart: ["Red heart", "red_heart"],
  hello: ["Waving hand", "waving_hand"],
  hill: ["Mountain", "mountain"],
  him: ["Man", "man"],
  home: ["House", "house"],
  hope: ["Star", "star"],
  hot: ["Fire", "fire"],
  house: ["House", "house"],
  ice: ["Ice", "ice"],
  job: ["Briefcase", "briefcase"],
  judge: ["Judge", "judge"],
  juice: ["Beverage box", "beverage_box"],
  key: ["Key", "key"],
  king: ["Crown", "crown"],
  kitchen: ["Cook", "cook"],
  leaf: ["Leaf fluttering in wind", "leaf_fluttering_in_wind"],
  leg: ["Leg", "leg"],
  leisure: ["Person in lotus position", "person_in_lotus_position"],
  life: ["Seedling", "seedling"],
  light: ["Light bulb", "light_bulb"],
  little: ["Baby", "baby"],
  long: ["Straight ruler", "straight_ruler"],
  look: ["Eyes", "eyes"],
  love: ["Red heart", "red_heart"],
  luck: ["Four leaf clover", "four_leaf_clover"],
  lunch: ["Bento box", "bento_box"],
  magic: ["Sparkles", "sparkles"],
  man: ["Man", "man"],
  map: ["World map", "world_map"],
  measure: ["Straight ruler", "straight_ruler"],
  middle: ["Bullseye", "bullseye"],
  milk: ["Glass of milk", "glass_of_milk"],
  moon: ["Full moon", "full_moon"],
  mother: ["Woman", "woman"],
  movie: ["Movie camera", "movie_camera"],
  music: ["Musical notes", "musical_notes"],
  name: ["Name badge", "name_badge"],
  nation: ["Globe showing Americas", "globe_showing_americas"],
  nature: ["Deciduous tree", "deciduous_tree"],
  nice: ["Thumbs up", "thumbs_up"],
  noise: ["Loudspeaker", "loudspeaker"],
  noon: ["Sun", "sun"],
  north: ["Compass", "compass"],
  nose: ["Nose", "nose"],
  nurse: ["Health worker", "health_worker"],
  ocean: ["Water wave", "water_wave"],
  oil: ["Oil drum", "oil_drum"],
  open: ["Open mailbox with raised flag", "open_mailbox_with_raised_flag"],
  orange: ["Tangerine", "tangerine"],
  paper: ["Scroll", "scroll"],
  park: ["National park", "national_park"],
  pen: ["Pen", "pen"],
  people: ["People hugging", "people_hugging"],
  phone: ["Mobile phone", "mobile_phone"],
  place: ["Round pushpin", "round_pushpin"],
  play: ["Play button", "play_button"],
  point: ["Index pointing up", "index_pointing_up"],
  price: ["Money bag", "money_bag"],
  rain: ["Cloud with rain", "cloud_with_rain"],
  red: ["Red circle", "red_circle"],
  ring: ["Ring", "ring"],
  road: ["Motorway", "motorway"],
  room: ["Door", "door"],
  round: ["Blue circle", "blue_circle"],
  run: ["Person running", "person_running"],
  safe: ["Locked", "locked"],
  school: ["School", "school"],
  see: ["Eyes", "eyes"],
  seven: ["Keycap 7", "keycap_7"],
  she: ["Woman", "woman"],
  sheep: ["Ewe", "ewe"],
  ship: ["Ship", "ship"],
  shop: ["Shopping cart", "shopping_cart"],
  show: ["Television", "television"],
  side: ["Left-right arrow", "left-right_arrow"],
  sing: ["Microphone", "microphone"],
  sit: ["Chair", "chair"],
  sleep: ["Sleeping face", "sleeping_face"],
  slow: ["Turtle", "turtle"],
  small: ["Ant", "ant"],
  smile: ["Smiling face", "smiling_face"],
  smooth: ["Ice", "ice"],
  sofa: ["Couch and lamp", "couch_and_lamp"],
  sorry: ["Pensive face", "pensive_face"],
  star: ["Star", "star"],
  step: ["Footprints", "footprints"],
  stop: ["Stop sign", "stop_sign"],
  street: ["Motorway", "motorway"],
  strong: ["Flexed biceps", "flexed_biceps"],
  summer: ["Sun with face", "sun_with_face"],
  sun: ["Sun", "sun"],
  sure: ["Check mark button", "check_mark_button"],
  sweet: ["Candy", "candy"],
  swim: ["Person swimming", "person_swimming"],
  table: ["Table", "table"],
  take: ["Hand with fingers splayed", "hand_with_fingers_splayed"],
  tall: ["Giraffe", "giraffe"],
  tea: ["Teacup without handle", "teacup_without_handle"],
  teacher: ["Teacher", "teacher"],
  teeth: ["Tooth", "tooth"],
  ten: ["Keycap 10", "keycap_10"],
  think: ["Thinking face", "thinking_face"],
  three: ["Keycap 3", "keycap_3"],
  time: ["Alarm clock", "alarm_clock"],
  too: ["Heavy plus sign", "heavy_plus_sign"],
  town: ["Houses", "houses"],
  trap: ["Mouse trap", "mouse_trap"],
  treasure: ["Gem stone", "gem_stone"],
  tree: ["Deciduous tree", "deciduous_tree"],
  trip: ["Luggage", "luggage"],
  truck: ["Delivery truck", "delivery_truck"],
  true: ["Check mark button", "check_mark_button"],
  turn: ["Counterclockwise arrows button", "counterclockwise_arrows_button"],
  under: ["Down arrow", "down_arrow"],
  use: ["Wrench", "wrench"],
  usual: ["Repeat button", "repeat_button"],
  very: ["Hundred points", "hundred_points"],
  view: ["Telescope", "telescope"],
  vision: ["Eye", "eye"],
  voice: ["Speaking head", "speaking_head"],
  wait: ["Hourglass not done", "hourglass_not_done"],
  walk: ["Person walking", "person_walking"],
  want: ["Backhand index pointing right", "backhand_index_pointing_right"],
  warm: ["Fire", "fire"],
  wash: ["Soap", "soap"],
  watch: ["Watch", "watch"],
  water: ["Droplet", "droplet"],
  weather: ["Sun behind cloud", "sun_behind_cloud"],
  wide: ["Left-right arrow", "left-right_arrow"],
  wood: ["Wood", "wood"],
  word: ["Speech balloon", "speech_balloon"],
  world: ["Globe showing Americas", "globe_showing_americas"],
  wrong: ["Cross mark", "cross_mark"],
  year: ["Calendar", "calendar"],
  yellow: ["Yellow circle", "yellow_circle"],
  yes: ["Check mark button", "check_mark_button"],
  you: ["Index pointing at the viewer", "index_pointing_at_the_viewer"],
  young: ["Baby", "baby"],
  zoo: ["Lion", "lion"],
  blue: ["Blue circle", "blue_circle"],
};

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        download(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      res.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve();
      });
    }).on("error", reject);
  });
}

async function main() {
  if (!existsSync(OUT_DIR)) {
    mkdirSync(OUT_DIR, { recursive: true });
  }

  const entries = Object.entries(WORD_EMOJI_MAP);
  let success = 0;
  let failed = 0;

  for (const [word, [dirName, fileName]] of entries) {
    const dest = join(OUT_DIR, `${word}.png`);
    if (existsSync(dest)) {
      console.log(`SKIP ${word} (already exists)`);
      success++;
      continue;
    }

    const url = `${BASE}/${encodeURIComponent(dirName)}/3D/${fileName}_3d.png`;
    try {
      await download(url, dest);
      console.log(`OK   ${word}`);
      success++;
    } catch (err) {
      console.log(`FAIL ${word}: ${err.message}`);
      failed++;
    }

    // Rate limit
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(
    `\nDone: ${success} success, ${failed} failed out of ${entries.length}`,
  );
}

main();
