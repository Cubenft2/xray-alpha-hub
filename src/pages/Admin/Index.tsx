import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SymbolAdmin } from './SymbolAdmin';
import { PendingTickerMappings } from './PendingTickerMappings';
import { GenerateBrief } from './GenerateBrief';
import { PolygonSync } from './PolygonSync';

export default function AdminIndex() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8">Admin Dashboard</h1>
      
      <Tabs defaultValue="generate-brief" className="space-y-6">
        <TabsList>
          <TabsTrigger value="generate-brief">Generate Brief</TabsTrigger>
          <TabsTrigger value="missing-tickers">Missing Tickers</TabsTrigger>
          <TabsTrigger value="symbol-intelligence">Symbol Intelligence</TabsTrigger>
          <TabsTrigger value="polygon-sync">Polygon Sync</TabsTrigger>
        </TabsList>

        <TabsContent value="generate-brief">
          <GenerateBrief />
        </TabsContent>

        <TabsContent value="missing-tickers">
          <PendingTickerMappings />
        </TabsContent>

        <TabsContent value="symbol-intelligence">
          <SymbolAdmin />
        </TabsContent>

        <TabsContent value="polygon-sync">
          <PolygonSync />
        </TabsContent>
      </Tabs>
    </div>
  );
}
