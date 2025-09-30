import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SymbolAdmin } from './SymbolAdmin';
import { GenerateBrief } from './GenerateBrief';

export default function AdminIndex() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8">Admin Dashboard</h1>
      
      <Tabs defaultValue="symbol-intelligence" className="space-y-6">
        <TabsList>
          <TabsTrigger value="symbol-intelligence">Symbol Intelligence</TabsTrigger>
          <TabsTrigger value="generate-brief">Generate Brief</TabsTrigger>
        </TabsList>

        <TabsContent value="symbol-intelligence">
          <SymbolAdmin />
        </TabsContent>

        <TabsContent value="generate-brief">
          <GenerateBrief />
        </TabsContent>
      </Tabs>
    </div>
  );
}
