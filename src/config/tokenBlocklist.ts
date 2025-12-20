/**
 * Token Blocklist Configuration
 * 
 * Tokens listed here are blocked via is_scam=true flag in token_cards table.
 * This file serves as documentation and reference for blocked tokens.
 * 
 * To block a new token:
 * 1. Add entry to BLOCKED_TOKENS array below
 * 2. Run SQL: UPDATE token_cards SET is_scam = true WHERE canonical_symbol = 'SYMBOL';
 * 
 * Blocked tokens are filtered from:
 * - Crypto Universe screener (useTokenCards hook)
 * - PolygonTicker price ticker
 * - All public-facing token displays
 */

export interface BlockedToken {
  symbol: string;
  reason: string;
  blockedAt: string;
  reportedBy?: string;
}

export const BLOCKED_TOKENS: BlockedToken[] = [
  {
    symbol: 'SOLZILLA',
    reason: 'Deleted - Inconsistent data: $0 market cap with rank #2, unreliable data source',
    blockedAt: '2025-12-20',
  },
  {
    symbol: 'LILPEPE',
    reason: 'Deleted - Fake $1 quadrillion market cap with $18 volume, clearly manipulated LunarCrush data',
    blockedAt: '2025-12-20',
  },
  {
    symbol: 'BZR',
    reason: 'Suspicious $19B market cap with only $625K volume - likely manipulated LunarCrush data',
    blockedAt: '2025-12-16',
  },
  // Add more tokens as identified
];

// Helper to check if a symbol is in the blocklist (for reference only - actual filtering uses is_scam flag)
export const isBlockedToken = (symbol: string): boolean => {
  return BLOCKED_TOKENS.some(t => t.symbol.toUpperCase() === symbol.toUpperCase());
};
