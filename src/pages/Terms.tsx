import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, AlertTriangle, Scale } from 'lucide-react';

export default function Terms() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold xr-gradient-text">Terms of Service</h1>
        <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="xr-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              Acceptance of Terms
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              By accessing and using XRayCrypto™ ("the Service"), you accept and agree to be bound by the terms 
              and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
            </p>
          </CardContent>
        </Card>

        <Card className="xr-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Use of Service
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <h3 className="font-semibold">Permitted Use</h3>
            <ul className="space-y-2 text-muted-foreground text-sm ml-4">
              <li>• Personal, non-commercial use for educational and informational purposes</li>
              <li>• Viewing market data, charts, and news for research</li>
              <li>• Sharing links to our service with proper attribution</li>
            </ul>
            
            <h3 className="font-semibold mt-4">Prohibited Use</h3>
            <ul className="space-y-2 text-muted-foreground text-sm ml-4">
              <li>• Automated scraping or data harvesting</li>
              <li>• Attempting to reverse engineer our systems</li>
              <li>• Using the service for illegal activities</li>
              <li>• Redistributing our data without permission</li>
              <li>• Overloading our servers with excessive requests</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="xr-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Financial Disclaimers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
              <h3 className="font-semibold text-warning mb-2">Not Financial Advice</h3>
              <p className="text-sm text-muted-foreground">
                XRayCrypto™ provides information for educational purposes only. Nothing on this platform constitutes 
                financial, investment, trading, or other advice. You should not treat any content as such.
              </p>
            </div>
            
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <h3 className="font-semibold text-destructive mb-2">Investment Risks</h3>
              <p className="text-sm text-muted-foreground">
                All investments carry risk of loss. Cryptocurrency and stock trading involves substantial risk. 
                Past performance does not guarantee future results. Only invest what you can afford to lose completely.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="xr-card">
          <CardHeader>
            <CardTitle>Data Accuracy & Availability</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              While we strive to provide accurate and up-to-date information, we cannot guarantee the accuracy, 
              completeness, or timeliness of any data displayed on our platform. Market data may be delayed or 
              contain errors. Always verify information through multiple sources.
            </p>
            
            <h3 className="font-semibold">Service Availability</h3>
            <p className="text-muted-foreground text-sm">
              We aim for 99.9% uptime but cannot guarantee uninterrupted service. We reserve the right to 
              temporarily suspend the service for maintenance, updates, or unforeseen circumstances.
            </p>
          </CardContent>
        </Card>

        <Card className="xr-card">
          <CardHeader>
            <CardTitle>Intellectual Property</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              The XRayCrypto™ brand, logo, and original content are our intellectual property. 
              Market data is provided by third-party sources and remains their property. 
              You may not reproduce, distribute, or create derivative works without permission.
            </p>
          </CardContent>
        </Card>

        <Card className="xr-card">
          <CardHeader>
            <CardTitle>Limitation of Liability</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              XRayCrypto™ and its operators shall not be liable for any direct, indirect, incidental, 
              consequential, or punitive damages arising from your use of the service. This includes but is not 
              limited to financial losses, trading losses, or any other damages.
            </p>
          </CardContent>
        </Card>

        <Card className="xr-card">
          <CardHeader>
            <CardTitle>Privacy & Data Collection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              We collect minimal data necessary for service operation. We do not sell personal information to third parties. 
              See our Privacy Policy for detailed information about data handling practices.
            </p>
          </CardContent>
        </Card>

        <Card className="xr-card">
          <CardHeader>
            <CardTitle>Changes to Terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              We reserve the right to modify these terms at any time. Continued use of the service after changes 
              indicates acceptance of the modified terms. Material changes will be announced through our platform.
            </p>
          </CardContent>
        </Card>

        <Card className="xr-card">
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              For questions about these Terms of Service, please contact us:
            </p>
            <div className="space-y-1 text-sm">
              <div><strong>Twitter:</strong> @XRaycryptox</div>
              <div><strong>Website:</strong> xraycrypto.io</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}