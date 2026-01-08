-- Delete stale wrapped/suspicious tokens from lunarcrush_ai_summaries
DELETE FROM lunarcrush_ai_summaries 
WHERE canonical_symbol IN (
  'WETH', 'WBTC', 'STETH', 'WSTETH', 
  'WBETH', 'WEETH', 'MGC', 'BZR', 'CVXCRV',
  'USDS', 'SOLZILLA'
);