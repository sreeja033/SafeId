/**
 * Explorer and transaction helper utilities
 */

export function getExplorerTxUrl(txHash?: string | null): string {
  if (!txHash) return '#';
  const clean = txHash.trim();
  // Standard Polygon Amoy testnet block explorer
  return `https://amoy.polygonscan.com/tx/${clean}`;
}

export function formatTxHashShort(txHash?: string | null): string {
  if (!txHash) return '';
  const clean = txHash.trim();
  if (clean.length <= 16) return clean;
  return `${clean.slice(0, 10)}...${clean.slice(-6)}`;
}
