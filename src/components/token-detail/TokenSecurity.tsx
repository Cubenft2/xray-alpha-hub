import { Shield, AlertTriangle, CheckCircle, XCircle, Lock, Unlock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface TokenSecurityProps {
  securityScore: number | null;
  securityGrade: string | null;
  isHoneypot: boolean | null;
  honeypotReason: string | null;
  buyTax: number | null;
  sellTax: number | null;
  isOwnershipRenounced: boolean | null;
  hiddenOwner: boolean | null;
  canTakeBackOwnership: boolean | null;
  isMintable: boolean | null;
  isOpenSource: boolean | null;
  isProxy: boolean | null;
  holderCount: number | null;
  top10HolderPercent: number | null;
  isLpLocked: boolean | null;
  lpLockUntil: string | null;
  securityFlags: string[] | null;
  securityUpdatedAt: string | null;
}

export function TokenSecurity({
  securityScore,
  securityGrade,
  isHoneypot,
  honeypotReason,
  buyTax,
  sellTax,
  isOwnershipRenounced,
  hiddenOwner,
  canTakeBackOwnership,
  isMintable,
  isOpenSource,
  isProxy,
  holderCount,
  top10HolderPercent,
  isLpLocked,
  lpLockUntil,
  securityFlags,
  securityUpdatedAt,
}: TokenSecurityProps) {
  const hasData = securityScore !== null || isHoneypot !== null || buyTax !== null;

  if (!hasData) {
    return (
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Security Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Security data not available for this token
          </p>
        </CardContent>
      </Card>
    );
  }

  const getGradeColor = (grade: string | null) => {
    const colors: Record<string, string> = {
      'A': 'bg-green-500 text-white',
      'B': 'bg-lime-500 text-white',
      'C': 'bg-yellow-500 text-black',
      'D': 'bg-orange-500 text-white',
      'F': 'bg-destructive text-white',
    };
    return colors[grade?.toUpperCase() || ''] || 'bg-muted';
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-muted-foreground';
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-destructive';
  };

  const CheckItem = ({ label, value, inverted = false }: { label: string; value: boolean | null; inverted?: boolean }) => {
    if (value === null) return null;
    const isGood = inverted ? !value : value;
    return (
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        {isGood ? (
          <CheckCircle className="h-4 w-4 text-green-500" />
        ) : (
          <XCircle className="h-4 w-4 text-destructive" />
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Security Analysis
          </CardTitle>
          {securityGrade && (
            <Badge className={getGradeColor(securityGrade)}>
              Grade {securityGrade}
            </Badge>
          )}
        </div>
        {securityUpdatedAt && (
          <p className="text-xs text-muted-foreground">
            Updated {new Date(securityUpdatedAt).toLocaleDateString()}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Honeypot Warning */}
        {isHoneypot && (
          <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-destructive">Honeypot Detected</div>
              {honeypotReason && (
                <div className="text-xs text-muted-foreground">{honeypotReason}</div>
              )}
            </div>
          </div>
        )}

        {/* Security Score */}
        {securityScore !== null && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">Security Score</span>
              <span className={`text-xl font-bold ${getScoreColor(securityScore)}`}>
                {securityScore}/100
              </span>
            </div>
            <Progress value={securityScore} className="h-2" />
          </div>
        )}

        {/* Taxes */}
        {(buyTax !== null || sellTax !== null) && (
          <div className="grid grid-cols-2 gap-4">
            {buyTax !== null && (
              <div>
                <div className="text-xs text-muted-foreground">Buy Tax</div>
                <div className={`font-semibold ${buyTax > 5 ? 'text-destructive' : 'text-green-500'}`}>
                  {buyTax}%
                </div>
              </div>
            )}
            {sellTax !== null && (
              <div>
                <div className="text-xs text-muted-foreground">Sell Tax</div>
                <div className={`font-semibold ${sellTax > 5 ? 'text-destructive' : 'text-green-500'}`}>
                  {sellTax}%
                </div>
              </div>
            )}
          </div>
        )}

        {/* Security Checks */}
        <div className="space-y-2 pt-2 border-t">
          <CheckItem label="Ownership Renounced" value={isOwnershipRenounced} />
          <CheckItem label="Open Source" value={isOpenSource} />
          <CheckItem label="Hidden Owner" value={hiddenOwner} inverted />
          <CheckItem label="Can Take Back Ownership" value={canTakeBackOwnership} inverted />
          <CheckItem label="Mintable" value={isMintable} inverted />
          <CheckItem label="Is Proxy" value={isProxy} inverted />
        </div>

        {/* Holder Info */}
        {(holderCount !== null || top10HolderPercent !== null) && (
          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
            {holderCount !== null && (
              <div>
                <div className="text-xs text-muted-foreground">Holders</div>
                <div className="font-semibold">{holderCount.toLocaleString()}</div>
              </div>
            )}
            {top10HolderPercent !== null && (
              <div>
                <div className="text-xs text-muted-foreground">Top 10 Holders</div>
                <div className={`font-semibold ${top10HolderPercent > 50 ? 'text-destructive' : 'text-foreground'}`}>
                  {top10HolderPercent.toFixed(1)}%
                </div>
              </div>
            )}
          </div>
        )}

        {/* LP Lock */}
        {isLpLocked !== null && (
          <div className="flex items-center gap-2 pt-2 border-t">
            {isLpLocked ? (
              <>
                <Lock className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-500">LP Locked</span>
                {lpLockUntil && (
                  <span className="text-xs text-muted-foreground">
                    until {new Date(lpLockUntil).toLocaleDateString()}
                  </span>
                )}
              </>
            ) : (
              <>
                <Unlock className="h-4 w-4 text-destructive" />
                <span className="text-sm text-destructive">LP Not Locked</span>
              </>
            )}
          </div>
        )}

        {/* Security Flags */}
        {securityFlags && securityFlags.length > 0 && (
          <div className="pt-2 border-t">
            <div className="text-xs text-muted-foreground mb-2">Flags</div>
            <div className="flex flex-wrap gap-1">
              {securityFlags.map((flag, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {flag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
