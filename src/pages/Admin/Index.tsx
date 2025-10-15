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
  SidebarTrigger 
} from '@/components/ui/sidebar';
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

export default function AdminIndex() {
  const [activeView, setActiveView] = useState('generate-brief');

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar className="border-r">
          <div className="p-4 border-b">
            <SidebarTrigger />
          </div>
          
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Content Management</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    onClick={() => setActiveView('generate-brief')}
                    isActive={activeView === 'generate-brief'}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    <span>Generate Brief</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    onClick={() => setActiveView('social-card')}
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
                    onClick={() => setActiveView('missing-tickers')}
                    isActive={activeView === 'missing-tickers'}
                  >
                    <Target className="mr-2 h-4 w-4" />
                    <span>Pending Ticker Mappings</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    onClick={() => setActiveView('symbol-intelligence')}
                    isActive={activeView === 'symbol-intelligence'}
                  >
                    <Brain className="mr-2 h-4 w-4" />
                    <span>Symbol Intelligence</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    onClick={() => setActiveView('coingecko-enrich')}
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
                    onClick={() => setActiveView('polygon-diagnostics')}
                    isActive={activeView === 'polygon-diagnostics'}
                  >
                    <BarChart3 className="mr-2 h-4 w-4" />
                    <span>Polygon Diagnostics</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    onClick={() => setActiveView('lunarcrush-diagnostics')}
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
                    onClick={() => setActiveView('polygon-sync')}
                    isActive={activeView === 'polygon-sync'}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    <span>Polygon Sync</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    onClick={() => setActiveView('polygon-data')}
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
        
        <main className="flex-1 p-8 overflow-auto">
          <h1 className="text-4xl font-bold mb-8">Admin Dashboard</h1>
          
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
    </SidebarProvider>
  );
}
