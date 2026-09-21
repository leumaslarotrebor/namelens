/** Only ever render http(s) links from API data. */
export function safeHref(url: string): string | undefined {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function isCommonsAudio(url: string): boolean {
  return url.startsWith("https://commons.wikimedia.org/wiki/Special:FilePath/");
}

export const TYPE_LABEL: Record<string, string> = {
  structured_database: "Structured database",
  encyclopedia: "Encyclopedia",
  demo_fixture: "Curated demo data",
};

export const STRENGTH_LABEL: Record<string, string> = { none: "None", low: "Low", moderate: "Moderate" };

export const PROVIDER_LABEL: Record<string, string> = { wikidata: "Wikidata", wikipedia: "Wikipedia", demo: "Curated demo source" };

export interface Example { name: string; script: string }
/** Script labels are Unicode script names, matching what the backend reports for these strings. */
export const EXAMPLES: Example[] = [
  { name: "Siobhán Ní Bhriain", script: "Latin" },
  { name: "Nguyễn Thị Minh Khai", script: "Latin (diacritics)" },
  { name: "சுப்பிரமணியன்", script: "Tamil" },
  { name: "प्रिया शर्मा", script: "Devanagari" },
  { name: "محمد بن سلمان", script: "Arabic (right-to-left)" },
  { name: "Иван Петров", script: "Cyrillic" },
  { name: "Γιώργος Παπαδόπουλος", script: "Greek" },
  { name: "山田 太郎", script: "Han" },
  { name: "さくら", script: "Hiragana" },
  { name: "김민수", script: "Hangul" },
];
export const QUICK_EXAMPLES = ["Siobhán", "García", "山田 太郎", "محمد بن سلمان", "Ludwig van Beethoven"];
