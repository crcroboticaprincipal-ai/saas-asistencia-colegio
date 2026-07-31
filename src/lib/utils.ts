import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converts a 24-hour time string (e.g. "14:30" or "07:15:00") to 12-hour AM/PM format (e.g. "02:30 PM" or "07:15 AM").
 */
export function formatHora12(timeStr?: string | null): string {
  if (!timeStr) return "—";
  const clean = timeStr.trim();
  const parts = clean.split(":");
  if (parts.length < 2) return clean;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  if (isNaN(hours)) return clean;
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const hoursStr = hours.toString().padStart(2, "0");
  return `${hoursStr}:${minutes} ${ampm}`;
}
