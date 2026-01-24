import { Copy, ExternalLink, Link2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface ContractData {
  address: string;
  decimals?: number | null;
}

interface TokenContractsProps {
  contracts: Record<string, ContractData | string> | null;
  primaryChain: string | null;
  website: string | null;
  twitter: string | null;
  discord: string | null;
  telegram: string | null;
  github: string | null;
  coingeckoId: string | null;
}

export function TokenContracts({
  contracts,
  primaryChain,
  website,
  twitter,
  discord,
  telegram,
  github,
  coingeckoId,
}: TokenContractsProps) {
  const formatChainName = (chain: string): string => {
    const chainNames: Record<string, string> = {
      'ethereum': 'Ethereum',
      'binance-smart-chain': 'BNB Chain',
      'bsc': 'BNB Chain',
      'polygon-pos': 'Polygon',
      'polygon': 'Polygon',
      'solana': 'Solana',
      'avalanche': 'Avalanche',
      'arbitrum-one': 'Arbitrum',
      'arbitrum': 'Arbitrum',
      'optimistic-ethereum': 'Optimism',
      'optimism': 'Optimism',
      'base': 'Base',
      'fantom': 'Fantom',
      'cronos': 'Cronos',
      'near': 'NEAR',
      'cosmos': 'Cosmos',
      'tron': 'Tron',
    };
    return chainNames[chain.toLowerCase()] || chain.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const getExplorerUrl = (address: string, chain: string): string | null => {
    const explorers: Record<string, string> = {
      'ethereum': `https://etherscan.io/token/${address}`,
      'binance-smart-chain': `https://bscscan.com/token/${address}`,
      'bsc': `https://bscscan.com/token/${address}`,
      'polygon-pos': `https://polygonscan.com/token/${address}`,
      'polygon': `https://polygonscan.com/token/${address}`,
      'solana': `https://solscan.io/token/${address}`,
      'avalanche': `https://snowtrace.io/token/${address}`,
      'arbitrum-one': `https://arbiscan.io/token/${address}`,
      'arbitrum': `https://arbiscan.io/token/${address}`,
      'optimistic-ethereum': `https://optimistic.etherscan.io/token/${address}`,
      'optimism': `https://optimistic.etherscan.io/token/${address}`,
      'base': `https://basescan.org/token/${address}`,
      'fantom': `https://ftmscan.com/token/${address}`,
      'cronos': `https://cronoscan.com/token/${address}`,
    };
    return explorers[chain.toLowerCase()] || null;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Address copied to clipboard');
  };

  const hasContracts = contracts && Object.keys(contracts).length > 0;
  const hasLinks = website || twitter || discord || telegram || github;

  if (!hasContracts && !hasLinks) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Token Info
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Contract Addresses */}
        {hasContracts && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">Contract Addresses</div>
            {Object.entries(contracts).map(([chain, contractData]) => {
              // Handle both nested object and flat string formats
              const address = typeof contractData === 'string' 
                ? contractData 
                : contractData?.address;
              
              if (!address) return null;

              return (
                <div key={chain} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="capitalize">
                      {formatChainName(chain)}
                      {primaryChain === chain && (
                        <span className="ml-1 text-primary">•</span>
                      )}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-muted rounded text-xs font-mono truncate">
                      {address}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => copyToClipboard(address)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    {getExplorerUrl(address, chain) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => window.open(getExplorerUrl(address, chain)!, '_blank')}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Links */}
        {hasLinks && (
          <div className="pt-2 border-t">
            <div className="text-sm text-muted-foreground mb-2">Links</div>
            <div className="flex flex-wrap gap-2">
              {website && (
                <Button variant="outline" size="sm" onClick={() => window.open(website, '_blank')}>
                  Website
                </Button>
              )}
              {twitter && (
                <Button variant="outline" size="sm" onClick={() => window.open(twitter.startsWith('http') ? twitter : `https://twitter.com/${twitter}`, '_blank')}>
                  Twitter
                </Button>
              )}
              {discord && (
                <Button variant="outline" size="sm" onClick={() => window.open(discord, '_blank')}>
                  Discord
                </Button>
              )}
              {telegram && (
                <Button variant="outline" size="sm" onClick={() => window.open(telegram.startsWith('http') ? telegram : `https://t.me/${telegram}`, '_blank')}>
                  Telegram
                </Button>
              )}
              {github && (
                <Button variant="outline" size="sm" onClick={() => window.open(github, '_blank')}>
                  GitHub
                </Button>
              )}
              {coingeckoId && (
                <Button variant="outline" size="sm" onClick={() => window.open(`https://www.coingecko.com/en/coins/${coingeckoId}`, '_blank')}>
                  CoinGecko
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
