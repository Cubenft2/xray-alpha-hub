import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Menu, X, Search, Heart } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

interface XRHeaderProps {
  currentPage?: string;
  onNavigate?: (page: string) => void;
}

export function XRHeader({ currentPage = 'home', onNavigate }: XRHeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLogoShaking, setIsLogoShaking] = useState(false);

  const navigation = [
    { name: 'Home', href: 'home', icon: '🏠' },
    { name: 'Markets', href: 'markets', icon: '📈' },
    { name: 'Watchlist', href: 'watchlist', icon: '👀' },
    { name: 'News', href: 'news', icon: '📰' },
    { name: 'Store', href: 'store', icon: '🛍️' },
    { name: 'ChillZone', href: 'chill', icon: '🎵' },
    { name: 'Support', href: 'support', icon: '❤️' },
  ];

  const handleLogoClick = () => {
    setIsLogoShaking(true);
    setTimeout(() => setIsLogoShaking(false), 600);
    onNavigate?.('home');
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <>
      <header className="xr-header">
        <div className="container flex h-16 items-center justify-between px-4">
          {/* Logo & Brand */}
          <div 
            className={`flex items-center space-x-2 cursor-pointer ${isLogoShaking ? 'animate-woof-shake' : ''}`}
            onClick={handleLogoClick}
          >
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold">
              🐕
            </div>
            <span className="text-xl font-bold xr-gradient-text hidden sm:block">
              XRayCrypto™
            </span>
            <span className="text-xl font-bold xr-gradient-text sm:hidden">
              XR™
            </span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-6">
            {navigation.map((item) => (
              <Button
                key={item.name}
                variant={currentPage === item.href ? "default" : "ghost"}
                className={currentPage === item.href ? "btn-hero" : ""}
                onClick={() => onNavigate?.(item.href)}
              >
                <span className="mr-1">{item.icon}</span>
                {item.name === 'Support' ? (
                  <Heart className="w-4 h-4 animate-wiggle" />
                ) : (
                  item.name
                )}
              </Button>
            ))}
          </nav>

          {/* Search & Theme Toggle */}
          <div className="flex items-center space-x-2">
            {(currentPage === 'home' || currentPage === 'markets') && (
              <div className="hidden md:flex items-center space-x-2">
                <Search className="w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={currentPage === 'home' ? "Search crypto..." : "Search stocks..."}
                  className="w-48"
                />
              </div>
            )}
            
            <ThemeToggle />

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={closeMobileMenu} />
          <div className="mobile-nav p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold">
                  🐕
                </div>
                <span className="text-xl font-bold xr-gradient-text">XRayCrypto™</span>
              </div>
              <Button variant="ghost" size="sm" onClick={closeMobileMenu}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <nav className="space-y-3">
              {navigation.map((item) => (
                <Button
                  key={item.name}
                  variant={currentPage === item.href ? "default" : "ghost"}
                  className={`w-full justify-start ${currentPage === item.href ? "btn-hero" : ""}`}
                  onClick={() => {
                    onNavigate?.(item.href);
                    closeMobileMenu();
                  }}
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.name}
                  {item.name === 'Support' && <Heart className="ml-auto w-4 h-4 animate-wiggle" />}
                </Button>
              ))}
            </nav>

            {(currentPage === 'home' || currentPage === 'markets') && (
              <div className="mt-6 pt-6 border-t border-border">
                <div className="flex items-center space-x-2">
                  <Search className="w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder={currentPage === 'home' ? "Search crypto..." : "Search stocks..."}
                    className="flex-1"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}