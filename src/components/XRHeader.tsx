import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Menu, X, Search, Heart } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { Link, useLocation } from 'react-router-dom';

interface XRHeaderProps {
  currentPage?: string;
  onSearch?: (searchTerm: string) => void;
}

export function XRHeader({ currentPage, onSearch }: XRHeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLogoShaking, setIsLogoShaking] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const location = useLocation();

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
  };

  const handleSearchSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearch?.(searchTerm);
    }
  };

  const navigation = [
    { name: 'Home', href: '/' },
    { name: 'Crypto', href: '/crypto' },
    { name: 'Stocks', href: '/markets' },
    { name: 'Watch', href: '/watchlist' },
    { name: 'News', href: '/news' },
    { name: 'Store', href: '/store' },
    { name: 'Chill', href: '/chill' },
    { name: 'Support', href: '/support' },
  ];

  const handleLogoClick = () => {
    setIsLogoShaking(true);
    setTimeout(() => setIsLogoShaking(false), 600);
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <>
      <header className="xr-header">
        <div className="container mx-auto flex h-16 items-center justify-between">
          {/* XRay Dog Logo & Brand */}
          <Link 
            to="/"
            className={`flex items-center space-x-3 cursor-pointer group ${isLogoShaking ? 'xr-woof-shake' : ''}`}
            onClick={handleLogoClick}
          >
            <div className="flex flex-col">
              <div className="flex items-center space-x-2">
                <span className="text-xl xr-pixel-text hidden sm:block leading-tight animate-radioactive-glow">
                  XRayCrypto™
                </span>
                <img 
                  src="/pfp.png" 
                  alt="XRay Profile" 
                  className="w-6 h-6 rounded-full hidden sm:block transition-transform duration-300 group-hover:scale-110"
                />
              </div>
              <span className="text-xs text-muted-foreground hidden sm:block font-mono">
                Powered by XRay Dog
              </span>
              <div className="flex items-center space-x-1 sm:hidden">
                <span className="text-lg xr-pixel-text animate-radioactive-glow">
                  XR™
                </span>
                <img 
                  src="/pfp.png" 
                  alt="XRay Profile" 
                  className="w-4 h-4 rounded-full"
                />
              </div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-6 relative overflow-hidden">
            {/* Pet Parade - One animation every 10 minutes */}
            
            {/* Cat runs alone - starts immediately */}
            <div className="xr-pet-item" style={{ animationDelay: '0s' }}>
              <div className="text-lg">🐱</div>
            </div>
            <div className="xr-pet-sound" style={{ animationDelay: '0s' }}>
              <span className="text-xs font-bold text-accent">MEW!</span>
            </div>

            {/* Dog runs alone - starts at 10 min (600s) */}
            <div className="xr-pet-item" style={{ animationDelay: '600s' }}>
              <img src="/pfp.png" alt="XRay Dog" className="w-6 h-6 rounded-full" />
            </div>
            <div className="xr-pet-sound" style={{ animationDelay: '600s' }}>
              <span className="text-xs font-bold text-primary">ARF!</span>
            </div>

            {/* Just Bone - starts at 20 min (1200s) */}
            <div className="xr-pet-item" style={{ animationDelay: '1200s' }}>
              <div className="text-lg">🦴</div>
            </div>

            {/* Dog chasing Ball - starts at 30 min (1800s) */}
            <div className="xr-pet-item" style={{ animationDelay: '1800s' }}>
              <div className="w-3 h-3 bg-green-400 rounded-full border border-green-600 shadow-sm"></div>
            </div>
            <div className="xr-pet-chaser" style={{ animationDelay: '1800s' }}>
              <img src="/pfp.png" alt="XRay Dog" className="w-6 h-6 rounded-full" />
            </div>

            {/* Dog chasing Treat - starts at 40 min (2400s) */}
            <div className="xr-pet-item" style={{ animationDelay: '2400s' }}>
              <div className="text-lg">🍖</div>
            </div>
            <div className="xr-pet-chaser" style={{ animationDelay: '2400s' }}>
              <img src="/pfp.png" alt="XRay Dog" className="w-6 h-6 rounded-full" />
            </div>
            <div className="xr-pet-sound" style={{ animationDelay: '2400s' }}>
              <span className="text-xs font-bold text-primary">YUM!</span>
            </div>
            {navigation.map((item) => (
              <Link key={item.name} to={item.href}>
                  <Button
                    variant={location.pathname === item.href ? "default" : "ghost"}
                    className={`xr-nav-text ${location.pathname === item.href ? "btn-hero" : ""}`}
                  >
                  {item.href === '/support' ? (
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
              <div className="flex items-center space-x-2">
                <Search className="w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={handleSearchChange}
                  onKeyDown={handleSearchSubmit}
                  placeholder={location.pathname === '/crypto' ? "Crypto..." : "Stocks..."}
                  className="w-24 md:w-32"
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
                <div>
                  <span className="text-xl xr-pixel-text">XRayCrypto™</span>
                  <p className="text-xs text-muted-foreground font-mono">Powered by XRay Dog</p>
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
                    className={`w-full justify-start xr-nav-text ${location.pathname === item.href ? "btn-hero" : ""}`}
                  >
                    {item.name}
                    {item.href === '/support' && <Heart className="ml-auto w-4 h-4 animate-wiggle" />}
                  </Button>
                </Link>
              ))}
            </nav>

            {(location.pathname === '/crypto' || location.pathname === '/markets') && (
              <div className="mt-6 pt-6 border-t border-border">
                <div className="flex items-center space-x-2">
                  <Search className="w-4 h-4 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={handleSearchChange}
                    onKeyDown={handleSearchSubmit}
                    placeholder={location.pathname === '/crypto' ? "Crypto..." : "Stocks..."}
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