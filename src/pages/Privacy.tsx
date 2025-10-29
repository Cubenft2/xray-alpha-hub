import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Eye, Lock, Cookie } from 'lucide-react';

export default function Privacy() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold xr-gradient-text">Privacy Policy</h1>
        <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="xr-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Our Commitment to Privacy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              XRayCrypto™ is committed to protecting your privacy and ensuring transparent data practices. 
              This policy explains how we collect, use, and protect your information when you use our service.
            </p>
          </CardContent>
        </Card>

        <Card className="xr-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Information We Collect
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <h3 className="font-semibold">Automatically Collected Information</h3>
            <ul className="space-y-2 text-muted-foreground text-sm ml-4">
              <li>• IP address and general location (country/region)</li>
              <li>• Browser type and version</li>
              <li>• Device information (mobile/desktop)</li>
              <li>• Pages visited and time spent on site</li>
              <li>• Referral source (how you found our site)</li>
            </ul>
            
            <h3 className="font-semibold">Information You Provide</h3>
            <ul className="space-y-2 text-muted-foreground text-sm ml-4">
              <li>• Search queries within our platform</li>
              <li>• Watchlist preferences (stored locally)</li>
              <li>• Theme preferences (dark/light mode)</li>
              <li>• Voluntary feedback or support messages</li>
            </ul>
            
            <div className="bg-success/10 border border-success/20 rounded-lg p-4 mt-4">
              <h4 className="font-semibold text-success mb-2">What We DON'T Collect</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Personal identification information</li>
                <li>• Email addresses (unless voluntarily provided)</li>
                <li>• Financial account information</li>
                <li>• Trading activity or portfolio data</li>
                <li>• Passwords or login credentials</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="xr-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              How We Use Your Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <h3 className="font-semibold">Service Operation</h3>
            <ul className="space-y-2 text-muted-foreground text-sm ml-4">
              <li>• Deliver real-time market data and charts</li>
              <li>• Personalize your experience (themes, preferences)</li>
              <li>• Improve site performance and user experience</li>
              <li>• Monitor for security threats and abuse</li>
            </ul>
            
            <h3 className="font-semibold">Analytics & Improvement</h3>
            <ul className="space-y-2 text-muted-foreground text-sm ml-4">
              <li>• Understand how users interact with our platform</li>
              <li>• Identify popular features and content</li>
              <li>• Fix bugs and technical issues</li>
              <li>• Plan new features and improvements</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="xr-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cookie className="h-5 w-5 text-primary" />
              Cookies & Local Storage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <h3 className="font-semibold">Essential Cookies</h3>
            <p className="text-muted-foreground text-sm">
              We use cookies and browser storage to remember your preferences like theme settings and 
              watchlist items. These are stored locally on your device and improve your experience.
            </p>
            
            <h3 className="font-semibold">Analytics Cookies</h3>
            <p className="text-muted-foreground text-sm">
              We may use analytics services to understand site usage patterns. These cookies help us 
              improve our service but are not used to identify individual users.
            </p>
            
            <h3 className="font-semibold">Managing Cookies</h3>
            <p className="text-muted-foreground text-sm">
              You can control cookies through your browser settings. Note that disabling cookies may 
              affect some functionality like saving preferences.
            </p>
          </CardContent>
        </Card>

        <Card className="xr-card">
          <CardHeader>
            <CardTitle>Third-Party Services</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <h3 className="font-semibold">Data Providers</h3>
            <ul className="space-y-2 text-muted-foreground text-sm ml-4">
              <li>• <strong>TradingView:</strong> Provides real-time charts and market data</li>
              <li>• <strong>News APIs:</strong> Aggregate financial news from various sources</li>
              <li>• <strong>Hosting Services:</strong> Secure cloud infrastructure providers</li>
            </ul>
            
            <p className="text-muted-foreground text-sm mt-4">
              These services may have their own privacy policies and data collection practices. 
              We recommend reviewing their policies as well.
            </p>
          </CardContent>
        </Card>

        <Card className="xr-card">
          <CardHeader>
            <CardTitle>Data Security</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              We implement industry-standard security measures to protect your data:
            </p>
            <ul className="space-y-2 text-muted-foreground text-sm ml-4">
              <li>• HTTPS encryption for all data transmission</li>
              <li>• Regular security updates and monitoring</li>
              <li>• Limited data collection and retention</li>
              <li>• Secure server infrastructure with access controls</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="xr-card">
          <CardHeader>
            <CardTitle>Your Rights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <h3 className="font-semibold">Access & Control</h3>
            <ul className="space-y-2 text-muted-foreground text-sm ml-4">
              <li>• Clear your browser data to remove stored preferences</li>
              <li>• Use private/incognito browsing to prevent data storage</li>
              <li>• Block cookies through browser settings</li>
              <li>• Request information about data we have (contact us)</li>
            </ul>
            
            <h3 className="font-semibold">Data Retention</h3>
            <p className="text-muted-foreground text-sm">
              We retain data only as long as necessary for service operation and improvement. 
              Most data is automatically deleted after 30-90 days. Locally stored preferences 
              remain until you clear your browser data.
            </p>
          </CardContent>
        </Card>

        <Card className="xr-card">
          <CardHeader>
            <CardTitle>Contact & Changes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <h3 className="font-semibold">Questions or Concerns</h3>
            <p className="text-muted-foreground text-sm">
              If you have questions about this privacy policy or our data practices, contact us:
            </p>
            <div className="space-y-1 text-sm">
              <div><strong>Twitter:</strong> @XRayMarkets</div>
              <div><strong>Website:</strong> xraycrypto.io</div>
            </div>
            
            <h3 className="font-semibold">Policy Changes</h3>
            <p className="text-muted-foreground text-sm">
              We may update this privacy policy occasionally. Material changes will be announced 
              on our platform. Continued use indicates acceptance of updated terms.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}