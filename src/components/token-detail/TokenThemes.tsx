import { Lightbulb, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TokenThemesProps {
  keyThemes: string[] | null;
}

// Generate a gradient based on theme index
const getThemeGradient = (index: number) => {
  const gradients = [
    'from-primary/20 to-primary/5',
    'from-blue-500/20 to-blue-500/5',
    'from-purple-500/20 to-purple-500/5',
    'from-orange-500/20 to-orange-500/5',
    'from-green-500/20 to-green-500/5',
  ];
  return gradients[index % gradients.length];
};

const getThemeAccent = (index: number) => {
  const accents = [
    'border-primary/30',
    'border-blue-500/30',
    'border-purple-500/30',
    'border-orange-500/30',
    'border-green-500/30',
  ];
  return accents[index % accents.length];
};

export function TokenThemes({ keyThemes }: TokenThemesProps) {
  if (!keyThemes || keyThemes.length === 0) {
    return null; // Don't render anything if no themes
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-yellow-500" />
          <span>Mindshare</span>
          <Sparkles className="h-3 w-3 text-yellow-500" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {keyThemes.slice(0, 6).map((theme, i) => (
            <div
              key={i}
              className={`p-3 rounded-lg border bg-gradient-to-br ${getThemeGradient(i)} ${getThemeAccent(i)} transition-transform hover:scale-[1.02]`}
            >
              <div className="text-sm font-medium line-clamp-2">{theme}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
