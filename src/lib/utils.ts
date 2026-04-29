import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// ============================================================================
// Tailwind CSS utility (existing)
// ============================================================================

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ============================================================================
// Date parsing utilities
// ============================================================================

/**
 * Safely parse DD/MM/YY or DD/MM/YYYY date strings.
 * 2-digit years like "15" → 2015, "99" → 1999.
 * Returns Date(0) for empty/invalid strings.
 */
export function parseDateSafe(dateStr: string): Date {
  if (!dateStr) return new Date(0)
  const parts = dateStr.split('/')
  if (parts.length === 3) {
    let year = parseInt(parts[2], 10)
    if (year < 100) year += year < 50 ? 2000 : 1900
    return new Date(year, parseInt(parts[1]) - 1, parseInt(parts[0]))
  }
  return new Date(dateStr)
}

// ============================================================================
// Math utilities
// ============================================================================

/**
 * Compute factorial(n). Returns 1 for n <= 1.
 */
export function factorial(n: number): number {
  if (n <= 1) return 1
  return n * factorial(n - 1)
}

// ============================================================================
// Parsing utilities
// ============================================================================

/**
 * Parse a string value to a number. Returns null for empty/undefined/NaN values.
 */
export function parseNumber(value: string | undefined): number | null {
  if (!value || value === '') return null
  const num = parseFloat(value)
  return isNaN(num) ? null : num
}
