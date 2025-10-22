export interface MarketData {
  // CoinGecko data
  topCoins: CoinData[];
  totalMarketCap: number;
  btcDominance: number;
  
  // LunarCrush social data
  socialSentiment: SocialData[];
  
  // Polygon stock data
  coinStock: StockData | null;
  mstrStock: StockData | null;
  spyStock: StockData | null;
  qqqStock: StockData | null;
  dxyIndex: StockData | null;
  
  // Fear & Greed Index
  fearGreedIndex: number;
  fearGreedLabel: string;
  
  // Binance funding rates
  btcFundingRate: number;
  ethFundingRate: number;
  
  // Price anchors
  btc: PriceAnchor;
  eth: PriceAnchor;
}

export interface CoinData {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
  total_volume: number;
}

export interface SocialData {
  symbol: string;
  name: string;
  social_volume: number;
  social_volume_24h_change: number;
  sentiment: number;
  galaxy_score: number;
}

export interface StockData {
  symbol: string;
  close: number;
  change_percent: number;
}

export interface PriceAnchor {
  price: number;
  change_24h: number;
  updated_at: string;
}
