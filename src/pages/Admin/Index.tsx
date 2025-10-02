import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SymbolAdmin } from './SymbolAdmin';
import { PendingTickerMappings } from './PendingTickerMappings';

export default function AdminIndex() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8">Admin Dashboard</h1>
      
      <Tabs defaultValue="missing-tickers" className="space-y-6">
        <TabsList>
          <TabsTrigger value="missing-tickers">Missing Tickers</TabsTrigger>
          <TabsTrigger value="symbol-intelligence">Symbol Intelligence</TabsTrigger>
        </TabsList>

        <TabsContent value="missing-tickers">
          <PendingTickerMappings />
        </TabsContent>

        <TabsContent value="symbol-intelligence">
          <SymbolAdmin />
        </TabsContent>
      </Tabs>
    </div>
  );
}
