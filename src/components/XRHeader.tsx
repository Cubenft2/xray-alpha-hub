import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Menu, X, Search, Heart } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { Link, useLocation } from 'react-router-dom';

interface XRHeaderProps {
  currentPage?: string;
}

export function XRHeader({ currentPage }: XRHeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLogoShaking, setIsLogoShaking] = useState(false);
  const location = useLocation();

  const navigation = [
    { name: 'MarketBrief', href: '/', icon: '📊' },
    { name: 'Crypto', href: '/crypto', icon: '🚀' },
    { name: 'Markets', href: '/markets', icon: '📈' },
    { name: 'Watchlist', href: '/watchlist', icon: '👀' },
    { name: 'News', href: '/news', icon: '📰' },
    { name: 'Store', href: '/store', icon: '🛍️' },
    { name: 'ChillZone', href: '/chill', icon: '🎵' },
    { name: 'Support', href: '/support', icon: '❤️' },
  ];

  const handleLogoClick = () => {
    setIsLogoShaking(true);
    setTimeout(() => setIsLogoShaking(false), 600);
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <>
      <header className="xr-header">
        <div className="container flex h-16 items-center justify-between px-4">
          {/* XRay Dog Logo & Brand */}
          <Link 
            to="/"
            className={`flex items-center space-x-3 cursor-pointer group ${isLogoShaking ? 'xr-woof-shake' : ''}`}
            onClick={handleLogoClick}
          >
            <div className="relative">
              <img 
                src="/xray-dog.png" 
                alt="XRay Dog - The Pixel Crypto Mascot" 
                className="w-9 h-9 rounded-md transition-transform duration-300 group-hover:scale-105"
                style={{ imageRendering: 'pixelated' }}
              />
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-primary rounded-full animate-pulse opacity-90"></div>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold text-foreground hidden sm:block leading-tight">
                XRayCrypto™
              </span>
              <span className="text-xs text-muted-foreground hidden sm:block font-medium">
                Powered by XRay Dog 🐕
              </span>
              <span className="text-lg font-bold text-foreground sm:hidden">
                XR™
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-6">
            {navigation.map((item) => (
              <Link key={item.name} to={item.href}>
                <Button
                  variant={location.pathname === item.href ? "default" : "ghost"}
                  className={location.pathname === item.href ? "btn-hero" : ""}
                >
                  <span className="mr-1">{item.icon}</span>
                  {item.name === 'Support' ? (
                    <Heart className="w-4 h-4 animate-wiggle" />
                  ) : (
                    item.name
                  )}
                </Button>
              </Link>
            ))}
          </nav>

          {/* Search & Theme Toggle */}
          <div className="flex items-center space-x-2">
            {(location.pathname === '/crypto' || location.pathname === '/markets') && (
              <div className="hidden md:flex items-center space-x-2">
                <Search className="w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={location.pathname === '/crypto' ? "Search crypto..." : "Search stocks..."}
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
              <div className="flex items-center space-x-3">
                <img 
                  src="/xray-dog.png" 
                  alt="XRay Dog - The Pixel Crypto Mascot" 
                  className="w-9 h-9 rounded-md"
                  style={{ imageRendering: 'pixelated' }}
                />
                <div>
                  <span className="text-xl font-bold text-foreground">XRayCrypto™</span>
                  <p className="text-xs text-muted-foreground">Powered by XRay Dog 🐕</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={closeMobileMenu}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <nav className="space-y-3">
              {navigation.map((item) => (
                <Link key={item.name} to={item.href} onClick={closeMobileMenu}>
                  <Button
                    variant={location.pathname === item.href ? "default" : "ghost"}
                    className={`w-full justify-start ${location.pathname === item.href ? "btn-hero" : ""}`}
                  >
                    <span className="mr-2">{item.icon}</span>
                    {item.name}
                    {item.name === 'Support' && <Heart className="ml-auto w-4 h-4 animate-wiggle" />}
                  </Button>
                </Link>
              ))}
            </nav>

            {(location.pathname === '/crypto' || location.pathname === '/markets') && (
              <div className="mt-6 pt-6 border-t border-border">
                <div className="flex items-center space-x-2">
                  <Search className="w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder={location.pathname === '/crypto' ? "Search crypto..." : "Search stocks..."}
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