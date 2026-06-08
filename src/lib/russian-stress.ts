const RUSSIAN_VOWELS = "аеёиоуыэюя";

export function countRussianVowels(text: string): number {
  return Array.from(text.toLowerCase()).filter((char) =>
    RUSSIAN_VOWELS.includes(char),
  ).length;
}

export function hasVisibleRussianStress(text?: string): boolean {
  return Boolean(text && (/[\u0301]/u.test(text) || text.toLowerCase().includes("ё")));
}

export function needsVisibleRussianStress(text: string): boolean {
  return (
    /[А-Яа-яЁё]/.test(text) &&
    !/\s/.test(text) &&
    countRussianVowels(text) > 1 &&
    !text.toLowerCase().includes("ё")
  );
}
