import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isSentence(text: string): boolean {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length > 1;
}
