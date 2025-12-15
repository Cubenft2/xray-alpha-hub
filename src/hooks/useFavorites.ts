import { useState, useEffect, useCallback } from 'react';

const FAVORITES_KEY = 'xraycrypto_favorites';

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);

  // Load favorites from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);
      if (stored) {
        setFavorites(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Error loading favorites:', e);
    }
  }, []);

  // Save to localStorage whenever favorites change
  const saveFavorites = useCallback((newFavorites: string[]) => {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
      setFavorites(newFavorites);
    } catch (e) {
      console.error('Error saving favorites:', e);
    }
  }, []);

  const addFavorite = useCallback((symbol: string) => {
    const upperSymbol = symbol.toUpperCase();
    setFavorites(prev => {
      if (prev.includes(upperSymbol)) return prev;
      const newFavorites = [...prev, upperSymbol];
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
      return newFavorites;
    });
  }, []);

  const removeFavorite = useCallback((symbol: string) => {
    const upperSymbol = symbol.toUpperCase();
    setFavorites(prev => {
      const newFavorites = prev.filter(s => s !== upperSymbol);
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
      return newFavorites;
    });
  }, []);

  const toggleFavorite = useCallback((symbol: string) => {
    const upperSymbol = symbol.toUpperCase();
    setFavorites(prev => {
      const isFavorite = prev.includes(upperSymbol);
      const newFavorites = isFavorite 
        ? prev.filter(s => s !== upperSymbol)
        : [...prev, upperSymbol];
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
      return newFavorites;
    });
  }, []);

  const isFavorite = useCallback((symbol: string) => {
    return favorites.includes(symbol.toUpperCase());
  }, [favorites]);

  return {
    favorites,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    isFavorite,
  };
}
