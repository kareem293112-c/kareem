/**
 * Utility function to format numbers into clean abbreviations (K, M, B)
 * Example: 9943374 -> 9.94M, 7099 -> 7.1K, 150 -> 150
 */
export function formatCompactNumber(num: number): string {
  if (num === undefined || num === null || isNaN(num)) return '0';
  if (num >= 1e9) {
    const val = num / 1e9;
    return (val % 1 === 0 ? val.toFixed(0) : val.toFixed(2).replace(/\.?0+$/, '')) + 'B';
  }
  if (num >= 1e6) {
    const val = num / 1e6;
    return (val % 1 === 0 ? val.toFixed(0) : val.toFixed(2).replace(/\.?0+$/, '')) + 'M';
  }
  if (num >= 1e3) {
    const val = num / 1e3;
    return (val % 1 === 0 ? val.toFixed(0) : val.toFixed(1).replace(/\.?0+$/, '')) + 'K';
  }
  return num.toString();
}
