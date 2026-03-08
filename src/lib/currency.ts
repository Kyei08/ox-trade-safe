/**
 * Format a number as South African Rand (ZAR) currency.
 */
export const formatZAR = (amount: number | null | undefined): string => {
  if (amount == null) return "N/A";
  return `R ${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
