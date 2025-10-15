import React, { useState } from 'react';
import { 
  Sidebar, 
  SidebarContent, 
  SidebarGroup, 
  SidebarGroupLabel, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton, 
  SidebarProvider,
  SidebarTrigger,
  useSidebar
} from '@/components/ui/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  FileText, 
  Target, 
  Brain, 
  Coins, 
  BarChart3, 
  Moon, 
  RefreshCw, 
  Database, 
  Image 
} from 'lucide-react';
import { SymbolAdmin } from './SymbolAdmin';
import { PendingTickerMappings } from './PendingTickerMappings';
import { GenerateBrief } from './GenerateBrief';
import { PolygonSync } from './PolygonSync';
import { PolygonDataAdmin } from './PolygonDataAdmin';
import { PolygonDiagnostics } from './PolygonDiagnostics';
import { LunarCrushDiagnostics } from './LunarCrushDiagnostics';
import { CoinGeckoEnrich } from './CoinGeckoEnrich';
import { SocialSentimentCard } from './SocialSentimentCard';

function AdminContent() {
  const [activeView, setActiveView] = useState('generate-brief');
  const { setOpenMobile } = useSidebar();
  const isMobile = useIsMobile();

  const handleViewChange = (view: string) => {
    setActiveView(view);
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <>
      <Sidebar className="border-r">
        <SidebarContent className="pt-4">
          <SidebarGroup>
            <SidebarGroupLabel>Content Management</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={() => handleViewChange('generate-brief')}
                  isActive={activeView === 'generate-brief'}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  <span>Generate Brief</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={() => handleViewChange('social-card')}
                  isActive={activeView === 'social-card'}
                >
                  <Image className="mr-2 h-4 w-4" />
                  <span>Social Sentiment Card</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
          
          <SidebarGroup>
            <SidebarGroupLabel>Data Operations</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={() => handleViewChange('missing-tickers')}
                  isActive={activeView === 'missing-tickers'}
                >
                  <Target className="mr-2 h-4 w-4" />
                  <span>Pending Ticker Mappings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={() => handleViewChange('symbol-intelligence')}
                  isActive={activeView === 'symbol-intelligence'}
                >
                  <Brain className="mr-2 h-4 w-4" />
                  <span>Symbol Intelligence</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={() => handleViewChange('coingecko-enrich')}
                  isActive={activeView === 'coingecko-enrich'}
                >
                  <Coins className="mr-2 h-4 w-4" />
                  <span>CoinGecko Enrich</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
          
          <SidebarGroup>
            <SidebarGroupLabel>Diagnostics</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={() => handleViewChange('polygon-diagnostics')}
                  isActive={activeView === 'polygon-diagnostics'}
                >
                  <BarChart3 className="mr-2 h-4 w-4" />
                  <span>Polygon Diagnostics</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={() => handleViewChange('lunarcrush-diagnostics')}
                  isActive={activeView === 'lunarcrush-diagnostics'}
                >
                  <Moon className="mr-2 h-4 w-4" />
                  <span>LunarCrush Diagnostics</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
          
          <SidebarGroup>
            <SidebarGroupLabel>Sync Operations</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={() => handleViewChange('polygon-sync')}
                  isActive={activeView === 'polygon-sync'}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  <span>Polygon Sync</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={() => handleViewChange('polygon-data')}
                  isActive={activeView === 'polygon-data'}
                >
                  <Database className="mr-2 h-4 w-4" />
                  <span>Polygon Data Admin</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-2 p-3">
            <SidebarTrigger className="ml-1" />
            <h1 className="text-lg font-semibold">Admin Dashboard</h1>
          </div>
        </header>
        
        <main className="flex-1 p-8 overflow-auto">
          {activeView === 'generate-brief' && <GenerateBrief />}
          {activeView === 'social-card' && <SocialSentimentCard />}
          {activeView === 'missing-tickers' && <PendingTickerMappings />}
          {activeView === 'symbol-intelligence' && <SymbolAdmin />}
          {activeView === 'coingecko-enrich' && <CoinGeckoEnrich />}
          {activeView === 'polygon-diagnostics' && <PolygonDiagnostics />}
          {activeView === 'lunarcrush-diagnostics' && <LunarCrushDiagnostics />}
          {activeView === 'polygon-sync' && <PolygonSync />}
          {activeView === 'polygon-data' && <PolygonDataAdmin />}
        </main>
      </div>
    </>
  );
}

export default function AdminIndex() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AdminContent />
      </div>
    </SidebarProvider>
  );
}
