import React, { useState } from 'react';
import { Button, Card, Badge, Input, Stat } from './design-system';
import { Search } from 'lucide-react';

/**
 * Design System Gallery & Playground
 * 
 * This component showcases all design system components and patterns.
 * Use this as reference when building new features.
 */
export default function DesignSystemGallery() {
  const [inputValue, setInputValue] = useState('');
  const [darkMode, setDarkMode] = useState(false);

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  return (
    <div className="min-h-screen bg-bg-page dark:bg-dark-bg-page transition-colors">
      <div className="max-w-6xl mx-auto p-8">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-4xl font-bold text-text-primary dark:text-dark-text-primary">
              Design System Gallery
            </h1>
            <Button 
              onClick={() => setDarkMode(!darkMode)}
              variant="secondary"
            >
              {darkMode ? '☀️ Light' : '🌙 Dark'}
            </Button>
          </div>
          <p className="text-text-secondary dark:text-dark-text-secondary">
            Complete reference implementation of the METpower design system
          </p>
        </div>

        {/* Buttons Section */}
        <Card className="mb-8">
          <h2 className="text-2xl font-semibold text-text-primary dark:text-dark-text-primary mb-6">
            Buttons
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs font-medium text-text-muted dark:text-dark-text-muted mb-3 uppercase">
                Primary
              </p>
              <Button variant="primary">Save</Button>
            </div>
            <div>
              <p className="text-xs font-medium text-text-muted dark:text-dark-text-muted mb-3 uppercase">
                Secondary
              </p>
              <Button variant="secondary">Cancel</Button>
            </div>
            <div>
              <p className="text-xs font-medium text-text-muted dark:text-dark-text-muted mb-3 uppercase">
                Ghost
              </p>
              <Button variant="ghost">Learn More</Button>
            </div>
            <div>
              <p className="text-xs font-medium text-text-muted dark:text-dark-text-muted mb-3 uppercase">
                Sizes
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="primary">Sm</Button>
                <Button size="lg" variant="primary">Lg</Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Badges Section */}
        <Card className="mb-8">
          <h2 className="text-2xl font-semibold text-text-primary dark:text-dark-text-primary mb-6">
            Badges
          </h2>
          <div className="flex flex-wrap gap-3">
            <Badge color="green">✓ Completed</Badge>
            <Badge color="red">✕ Error</Badge>
            <Badge color="blue">ℹ Info</Badge>
            <Badge color="amber">! Warning</Badge>
            <Badge color="gray">○ Neutral</Badge>
          </div>
        </Card>

        {/* Input Section */}
        <Card className="mb-8">
          <h2 className="text-2xl font-semibold text-text-primary dark:text-dark-text-primary mb-6">
            Inputs
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Input 
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
            <Input 
              label="Search"
              icon={<Search className="w-4 h-4" />}
              placeholder="Search analytics..."
            />
            <Input 
              label="With Error"
              error="This field is required"
              placeholder="Enter value..."
            />
            <Input 
              label="Disabled"
              disabled
              placeholder="Disabled input..."
            />
          </div>
        </Card>

        {/* Stats/Metrics Section */}
        <Card className="mb-8">
          <h2 className="text-2xl font-semibold text-text-primary dark:text-dark-text-primary mb-6">
            Statistics
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Stat 
              label="Total Tonnage"
              value="2,450 tons"
              change={15}
              subMetrics={[
                { label: 'This Month', value: '850 tons' },
                { label: 'Average Daily', value: '75 tons' }
              ]}
            />
            <Stat 
              label="Transactions"
              value="1,284"
              change={-5}
              subMetrics={[
                { label: 'Pending', value: '12' },
                { label: 'Completed', value: '1,272' }
              ]}
            />
            <Stat 
              label="Active Fleet"
              value="48 vehicles"
              change={3}
              subMetrics={[
                { label: 'On Route', value: '32' },
                { label: 'Idle', value: '16' }
              ]}
            />
          </div>
        </Card>

        {/* Cards Section */}
        <Card className="mb-8">
          <h2 className="text-2xl font-semibold text-text-primary dark:text-dark-text-primary mb-6">
            Card Variations
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Standard Card */}
            <Card hoverable>
              <h3 className="text-lg font-semibold text-text-primary dark:text-dark-text-primary mb-2">
                Standard Card
              </h3>
              <p className="text-text-secondary dark:text-dark-text-secondary text-sm">
                Clean white background with subtle shadow. Hover for elevation effect.
              </p>
            </Card>

            {/* Feature Card */}
            <Card isFeature>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-white/80 mb-3">
                  Performance
                </p>
                <p className="text-5xl font-bold text-white mb-3">87%</p>
                <p className="text-sm text-white/90">
                  Uptime this month
                </p>
              </div>
            </Card>
          </div>
        </Card>

        {/* Color Palette Section */}
        <Card className="mb-8">
          <h2 className="text-2xl font-semibold text-text-primary dark:text-dark-text-primary mb-6">
            Color Palette
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { name: 'Blue', color: 'bg-state-blue' },
              { name: 'Green', color: 'bg-state-green' },
              { name: 'Red', color: 'bg-state-red' },
              { name: 'Pink', color: 'bg-state-pink' },
              { name: 'Amber', color: 'bg-state-amber' },
            ].map((item) => (
              <div key={item.name}>
                <div className={`${item.color} h-16 rounded-lg mb-2`} />
                <p className="text-xs font-medium text-text-secondary dark:text-dark-text-secondary">
                  {item.name}
                </p>
              </div>
            ))}
          </div>
        </Card>

        {/* Typography Section */}
        <Card className="mb-8">
          <h2 className="text-2xl font-semibold text-text-primary dark:text-dark-text-primary mb-6">
            Typography
          </h2>
          <div className="space-y-6">
            <div>
              <p className="text-xs font-medium text-text-muted dark:text-dark-text-muted uppercase mb-2">
                Page Title
              </p>
              <h1 className="text-4xl font-bold text-text-primary dark:text-dark-text-primary">
                32px / 700 weight
              </h1>
            </div>
            <div>
              <p className="text-xs font-medium text-text-muted dark:text-dark-text-muted uppercase mb-2">
                Card Heading
              </p>
              <h3 className="text-xl font-semibold text-text-primary dark:text-dark-text-primary">
                15px / 600 weight
              </h3>
            </div>
            <div>
              <p className="text-xs font-medium text-text-muted dark:text-dark-text-muted uppercase mb-2">
                Body Text
              </p>
              <p className="text-text-primary dark:text-dark-text-primary">
                13–14px / 400–500 weight · Line height 1.4 for readability
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-text-muted dark:text-dark-text-muted uppercase mb-2">
                Caption
              </p>
              <p className="text-xs text-text-muted dark:text-dark-text-muted">
                11–12px / 400 weight · Used for metadata and labels
              </p>
            </div>
          </div>
        </Card>

        {/* Spacing Section */}
        <Card className="mb-8">
          <h2 className="text-2xl font-semibold text-text-primary dark:text-dark-text-primary mb-6">
            Spacing (4px base unit)
          </h2>
          <div className="space-y-4">
            {[
              { name: '4px', size: 'w-1 h-1' },
              { name: '8px', size: 'w-2 h-2' },
              { name: '16px', size: 'w-4 h-4' },
              { name: '24px', size: 'w-6 h-6' },
              { name: '32px', size: 'w-8 h-8' },
            ].map((item) => (
              <div key={item.name} className="flex items-center gap-4">
                <div className={`${item.size} bg-state-blue rounded`} />
                <span className="text-sm text-text-secondary dark:text-dark-text-secondary">
                  {item.name}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center text-text-muted dark:text-dark-text-muted text-sm">
          <p>
            For complete documentation, see <code className="bg-bg-card dark:bg-dark-bg-card px-2 py-1 rounded">docs/DESIGN-SYSTEM.md</code>
          </p>
        </div>
      </div>
    </div>
  );
}
