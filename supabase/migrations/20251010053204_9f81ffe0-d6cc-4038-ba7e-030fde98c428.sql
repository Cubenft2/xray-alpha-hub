-- Update MOMO token with Solana address
UPDATE ticker_mappings 
SET 
  dex_address = 'G4zwEA9NSd3nMBbEj31MMPq2853Brx2oGsKzex3ebonk',
  dex_chain = 'Solana',
  updated_at = now()
WHERE symbol = 'MOMO' AND type = 'crypto';