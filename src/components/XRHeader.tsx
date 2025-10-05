import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Menu, X, Search, Heart, LogOut, Shield } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { toast } from 'sonner';

interface XRHeaderProps {
  currentPage?: string;
  onSearch?: (searchTerm: string) => void;
}

export function XRHeader({ currentPage, onSearch }: XRHeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLogoShaking, setIsLogoShaking] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Check current auth state
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdminStatus(session.user.id);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdminStatus(session.user.id);
      } else {
        setIsAdmin(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAdminStatus = async (userId: string) => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .single();
    
    setIsAdmin(!!data);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out successfully');
    navigate('/');
  };

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
    { name: 'Chill', href: '/chill' },
    { name: 'Store', href: '/store' },
    { name: 'About', href: '/about' },
    { name: 'Support', href: '/support' },
  ];

  const handleLogoClick = () => {
    setIsLogoShaking(true);
    setTimeout(() => setIsLogoShaking(false), 600);
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <>
      <header className="xr-header relative overflow-visible">
        <div className="container mx-auto flex h-16 items-center justify-between">
          {/* XRay Dog Logo & Brand */}
          <Link 
            to="/"
            className={`flex items-center space-x-3 cursor-pointer group ${isLogoShaking ? 'xr-woof-shake' : ''}`}
            onClick={handleLogoClick}
          >
            <div className="flex flex-col">
              <div className="flex items-center space-x-2">
                <img 
                  src="/pfp.png" 
                  alt="XRay Profile" 
                  className="w-10 h-10 rounded-full hidden sm:block transition-transform duration-300 group-hover:scale-110 mt-2"
                />
                <span className="text-xl xr-pixel-text hidden sm:block leading-tight animate-radioactive-glow">
                  XRayCrypto™
                </span>
              </div>
              <span className="text-xs text-muted-foreground hidden sm:block font-mono ml-12 -mt-1">
                Powered by XRay Dog
              </span>
              <div className="flex items-center space-x-1 sm:hidden">
                <img 
                  src="/pfp.png" 
                  alt="XRay Profile" 
                  className="w-8 h-8 rounded-full"
                />
                <span className="text-lg xr-pixel-text animate-radioactive-glow">
                  XR™
                </span>
              </div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-6">
            {navigation.map((item) => (
              <Link key={item.name} to={item.href}>
                  <Button
                    variant={location.pathname === item.href ? "default" : "ghost"}
                    className={`xr-nav-text ${location.pathname === item.href ? "btn-hero" : ""}`}
                  >
                  {item.href === '/support' ? (
                    <Heart className="w-4 h-4 text-red-500 animate-pulse" fill="currentColor" />
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

            {/* Auth Buttons */}
            {user ? (
              <div className="hidden md:flex items-center space-x-2">
                {isAdmin && (
                  <Link to="/admin">
                    <Button variant="outline" size="sm" className="space-x-1">
                      <Shield className="w-4 h-4" />
                      <span>Admin</span>
                    </Button>
                  </Link>
                )}
                <Button variant="ghost" size="sm" onClick={handleLogout} className="space-x-1">
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </Button>
              </div>
            ) : (
              <Link to="/auth" className="hidden md:block">
                <Button variant="outline" size="sm">Login</Button>
              </Link>
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
                    {item.href === '/support' && <Heart className="ml-auto w-4 h-4 text-red-500 animate-pulse" fill="currentColor" />}
                  </Button>
                </Link>
              ))}

              {/* Mobile Auth Buttons */}
              <div className="pt-4 border-t border-border space-y-2">
                {user ? (
                  <>
                    {isAdmin && (
                      <Link to="/admin" onClick={closeMobileMenu}>
                        <Button variant="outline" className="w-full justify-start space-x-2">
                          <Shield className="w-4 h-4" />
                          <span>Admin</span>
                        </Button>
                      </Link>
                    )}
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start space-x-2" 
                      onClick={() => {
                        handleLogout();
                        closeMobileMenu();
                      }}
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </Button>
                  </>
                ) : (
                  <Link to="/auth" onClick={closeMobileMenu}>
                    <Button variant="outline" className="w-full">Login</Button>
                  </Link>
                )}
              </div>
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