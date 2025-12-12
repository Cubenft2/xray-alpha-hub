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
  MessageSquare,
  Dog,
  Activity,
  Database,
  Wrench,
  Download
} from 'lucide-react';
import { GenerateBrief } from './GenerateBrief';
import QuoteLibraryAdmin from './QuoteLibraryAdmin';
import { ZombieDogAnalytics } from './ZombieDogAnalytics';
import { SystemHealth } from './SystemHealth';
import { DataSources } from './DataSources';
import { Diagnostics } from './Diagnostics';
import { DataExport } from './DataExport';

function AdminContent() {
  const [activeView, setActiveView] = useState('dashboard');
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
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton 
                onClick={() => handleViewChange('dashboard')}
                isActive={activeView === 'dashboard'}
              >
                <Activity className="mr-2 h-4 w-4" />
                <span>Dashboard</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
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
                onClick={() => handleViewChange('quote-library')}
                isActive={activeView === 'quote-library'}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                <span>Quote Library</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton 
                onClick={() => handleViewChange('data-sources')}
                isActive={activeView === 'data-sources'}
              >
                <Database className="mr-2 h-4 w-4" />
                <span>Data Sources</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton 
                onClick={() => handleViewChange('zombiedog-analytics')}
                isActive={activeView === 'zombiedog-analytics'}
              >
                <Dog className="mr-2 h-4 w-4" />
                <span>ZombieDog Analytics</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton 
                onClick={() => handleViewChange('diagnostics')}
                isActive={activeView === 'diagnostics'}
              >
                <Wrench className="mr-2 h-4 w-4" />
                <span>Diagnostics</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton 
                onClick={() => handleViewChange('data-export')}
                isActive={activeView === 'data-export'}
              >
                <Download className="mr-2 h-4 w-4" />
                <span>Data Export</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
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
          {activeView === 'dashboard' && <SystemHealth />}
          {activeView === 'generate-brief' && <GenerateBrief />}
          {activeView === 'quote-library' && <QuoteLibraryAdmin />}
          {activeView === 'data-sources' && <DataSources />}
          {activeView === 'zombiedog-analytics' && <ZombieDogAnalytics />}
          {activeView === 'diagnostics' && <Diagnostics />}
          {activeView === 'data-export' && <DataExport />}
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
