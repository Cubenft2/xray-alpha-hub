import React, { useState } from 'react';
import { useLayoutSearch } from '@/components/Layout';
import { WatchlistManager } from '@/components/WatchlistManager';

export default function Watchlist() {
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearch = (term: string) => {
    setSearchTerm(term);
  };

  return (
    <div className="container mx-auto py-6">
      <WatchlistManager />
    </div>
  );
}