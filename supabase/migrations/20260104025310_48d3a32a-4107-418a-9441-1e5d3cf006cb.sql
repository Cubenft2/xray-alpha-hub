-- Insert Platinum and Palladium into forex_cards
INSERT INTO forex_cards (pair, base_currency, quote_currency, display_name, is_major, is_active)
VALUES 
  ('XPTUSD', 'XPT', 'USD', 'Platinum/USD', false, true),
  ('XPDUSD', 'XPD', 'USD', 'Palladium/USD', false, true)
ON CONFLICT (pair) DO NOTHING;

-- Insert Platinum and Palladium futures into futures_cards
INSERT INTO futures_cards (symbol, name, underlying, exchange, contract_size, is_active)
VALUES 
  ('PL1!', 'Platinum Futures (Front Month)', 'XPT', 'NYMEX', 50, true),
  ('PA1!', 'Palladium Futures (Front Month)', 'XPD', 'NYMEX', 100, true)
ON CONFLICT (symbol) DO NOTHING;