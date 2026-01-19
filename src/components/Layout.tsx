import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
}

// Simplified layout - just a wrapper now that the app is single-page
export const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="min-h-screen">
      {children}
    </div>
  );
};
