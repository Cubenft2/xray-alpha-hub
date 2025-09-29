-- Add additional major cryptocurrencies and tokens to ticker_mappings

-- Exchange Tokens
INSERT INTO public.ticker_mappings (symbol, display_name, type, exchange, tradingview_symbol) VALUES
('BNB', 'Binance Coin (BNB)', 'crypto', 'BINANCE', 'BINANCE:BNBUSDT'),
('OKB', 'OKX Token (OKB)', 'crypto', 'OKX', 'BINANCE:OKBUSDT'),
('CRO', 'Cronos (CRO)', 'crypto', 'CRYPTO.COM', 'BINANCE:CROUSDT'),
('KCS', 'KuCoin Token (KCS)', 'crypto', 'KUCOIN', 'BINANCE:KCSUSDT'),
('HT', 'Huobi Token (HT)', 'crypto', 'HUOBI', 'BINANCE:HTUSDT'),
('LEO', 'UNUS SED LEO (LEO)', 'crypto', 'BITFINEX', 'BINANCE:LEOUSDT'),
('MX', 'MX Token (MX)', 'crypto', 'MEXC', 'MEXC:MXUSDT'),

-- Layer 1 Blockchains
('NEAR', 'NEAR Protocol (NEAR)', 'crypto', 'BINANCE', 'BINANCE:NEARUSDT'),
('ALGO', 'Algorand (ALGO)', 'crypto', 'BINANCE', 'BINANCE:ALGOUSDT'),
('FTM', 'Fantom (FTM)', 'crypto', 'BINANCE', 'BINANCE:FTMUSDT'),
('ONE', 'Harmony (ONE)', 'crypto', 'BINANCE', 'BINANCE:ONEUSDT'),
('EGLD', 'MultiversX (EGLD)', 'crypto', 'BINANCE', 'BINANCE:EGLDUSDT'),
('ICP', 'Internet Computer (ICP)', 'crypto', 'BINANCE', 'BINANCE:ICPUSDT'),
('APT', 'Aptos (APT)', 'crypto', 'BINANCE', 'BINANCE:APTUSDT'),
('SEI', 'Sei (SEI)', 'crypto', 'BINANCE', 'BINANCE:SEIUSDT'),
('INJ', 'Injective (INJ)', 'crypto', 'BINANCE', 'BINANCE:INJUSDT'),
('TIA', 'Celestia (TIA)', 'crypto', 'BINANCE', 'BINANCE:TIAUSDT'),

-- Layer 2 Solutions
('ARB', 'Arbitrum (ARB)', 'crypto', 'BINANCE', 'BINANCE:ARBUSDT'),
('OP', 'Optimism (OP)', 'crypto', 'BINANCE', 'BINANCE:OPUSDT'),
('IMX', 'Immutable X (IMX)', 'crypto', 'BINANCE', 'BINANCE:IMXUSDT'),
('LRC', 'Loopring (LRC)', 'crypto', 'BINANCE', 'BINANCE:LRCUSDT'),

-- DeFi Tokens
('MKR', 'Maker (MKR)', 'dex', 'BINANCE', 'BINANCE:MKRUSDT'),
('SNX', 'Synthetix (SNX)', 'dex', 'BINANCE', 'BINANCE:SNXUSDT'),
('YFI', 'Yearn Finance (YFI)', 'dex', 'BINANCE', 'BINANCE:YFIUSDT'),
('RUNE', 'THORChain (RUNE)', 'dex', 'BINANCE', 'BINANCE:RUNEUSDT'),
('LDO', 'Lido DAO (LDO)', 'dex', 'BINANCE', 'BINANCE:LDOUSDT'),

-- Meme Coins
('SHIB', 'Shiba Inu (SHIB)', 'crypto', 'BINANCE', 'BINANCE:SHIBUSDT'),
('PEPE', 'Pepe (PEPE)', 'crypto', 'BINANCE', 'BINANCE:PEPEUSDT'),
('BONK', 'Bonk (BONK)', 'crypto', 'BINANCE', 'BINANCE:BONKUSDT'),
('WIF', 'dogwifhat (WIF)', 'crypto', 'BINANCE', 'BINANCE:WIFUSDT'),
('FLOKI', 'Floki Inu (FLOKI)', 'crypto', 'BINANCE', 'BINANCE:FLOKIUSDT'),

-- Classic Cryptocurrencies
('LTC', 'Litecoin (LTC)', 'crypto', 'BINANCE', 'BINANCE:LTCUSDT'),
('BCH', 'Bitcoin Cash (BCH)', 'crypto', 'BINANCE', 'BINANCE:BCHUSDT'),
('ETC', 'Ethereum Classic (ETC)', 'crypto', 'BINANCE', 'BINANCE:ETCUSDT'),
('XLM', 'Stellar (XLM)', 'crypto', 'BINANCE', 'BINANCE:XLMUSDT'),
('VET', 'VeChain (VET)', 'crypto', 'BINANCE', 'BINANCE:VETUSDT'),
('XMR', 'Monero (XMR)', 'crypto', 'BINANCE', 'BINANCE:XMRUSDT'),
('EOS', 'EOS (EOS)', 'crypto', 'BINANCE', 'BINANCE:EOSUSDT'),

-- Stablecoins
('USDC', 'USD Coin (USDC)', 'crypto', 'COINBASE', 'COINBASE:USDCUSD'),
('DAI', 'Dai (DAI)', 'crypto', 'BINANCE', 'BINANCE:DAIUSDT'),
('BUSD', 'Binance USD (BUSD)', 'crypto', 'BINANCE', 'BINANCE:BUSDUSDT'),
('TUSD', 'TrueUSD (TUSD)', 'crypto', 'BINANCE', 'BINANCE:TUSDUSDT'),

-- AI & Gaming Tokens
('FET', 'Fetch.ai (FET)', 'crypto', 'BINANCE', 'BINANCE:FETUSDT'),
('AGIX', 'SingularityNET (AGIX)', 'crypto', 'BINANCE', 'BINANCE:AGIXUSDT'),
('SAND', 'The Sandbox (SAND)', 'crypto', 'BINANCE', 'BINANCE:SANDUSDT'),
('MANA', 'Decentraland (MANA)', 'crypto', 'BINANCE', 'BINANCE:MANAUSDT'),
('AXS', 'Axie Infinity (AXS)', 'crypto', 'BINANCE', 'BINANCE:AXSUSDT'),
('GALA', 'Gala (GALA)', 'crypto', 'BINANCE', 'BINANCE:GALAUSDT'),

-- Other Popular Tokens
('GRT', 'The Graph (GRT)', 'crypto', 'BINANCE', 'BINANCE:GRTUSDT'),
('FIL', 'Filecoin (FIL)', 'crypto', 'BINANCE', 'BINANCE:FILUSDT'),
('THETA', 'Theta Network (THETA)', 'crypto', 'BINANCE', 'BINANCE:THETAUSDT'),
('HBAR', 'Hedera (HBAR)', 'crypto', 'BINANCE', 'BINANCE:HBARUSDT'),
('QNT', 'Quant (QNT)', 'crypto', 'BINANCE', 'BINANCE:QNTUSDT'),
('TON', 'Toncoin (TON)', 'crypto', 'BINANCE', 'BINANCE:TONUSDT');