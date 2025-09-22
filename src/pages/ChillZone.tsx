import React from 'react';
import { ChillZone as ChillZoneComponent } from '@/components/ChillZone';
import { XRHeader } from '@/components/XRHeader';
import { XRFooter } from '@/components/XRFooter';

export default function ChillZone() {
  return (
    <div className="min-h-screen bg-background">
      <XRHeader currentPage="chill" />
      <main className="container mx-auto py-8">
        <ChillZoneComponent />
      </main>
      <XRFooter />
    </div>
  );
}