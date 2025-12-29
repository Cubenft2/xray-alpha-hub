import React, { useState } from 'react';
import { SEOHead } from '@/components/SEOHead';
import { useLayoutSearch } from '@/components/Layout';
import { WatchlistManager } from '@/components/WatchlistManager';

export default function Watchlist() {
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearch = (term: string) => {
    setSearchTerm(term);
  };

  return (
    <>
      <SEOHead
        title="Your Watchlist - Track Favorite Tokens"
        description="Create and manage your personal cryptocurrency watchlist. Track prices and metrics for your favorite tokens and stocks in real-time."
      />
      <div className="container mx-auto py-6">
        <WatchlistManager />
      </div>
    </>
  );
}