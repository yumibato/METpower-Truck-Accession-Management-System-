# METpower Design System Guide

## Overview

This is a clean, modern SaaS analytics dashboard design system with light and dark mode support. The system is built on principles of high information density, generous whitespace, and refined typography.

## Color System

### Light Mode

```typescript
// Page & Cards
--bg-page: #EBEBEB          // Outer page background
--bg-card: #FFFFFF          // Card backgrounds
--bg-elevated: #F9F9F9      // Elevated surfaces (dropdowns, modals)
--bg-input: #F5F5F5         // Input fields

// Text
--text-primary: #111111     // Headings, key metrics
--text-secondary: #6B7280   // Labels, captions
--text-muted: #9CA3AF       // Placeholders, disabled

// UI Elements
--border: #E5E7EB           // Borders & dividers
--accent: #1A1A1A           // Buttons, nav pills

// States
--blue: #2563EB
--green: #22C55E
--red: #EF4444
--pink: #EC4899
--amber: #F97316
```

### Dark Mode

```typescript
--bg-page: #111111          // Deep near-black
--bg-card: #1A1A1A          // Card backgrounds
--bg-elevated: #222222      // Elevated surfaces
--bg-input: #2A2A2A         // Input fields

--text-primary: #F5F5F5     // Main text
--text-secondary: #A1A1AA   // Secondary text
--text-muted: #52525B       // Muted text

--border: #2E2E2E           // Subtle borders
--accent: #FFFFFF           // Bright accent

--blue: #3B82F6
--green: #4ADE80
--red: #F87171
--pink: #F472B6
--amber: #FB923C
```

## Typography

**Font Stack:** DM Sans, Plus Jakarta Sans, sans-serif

### Scale

| Purpose | Size | Weight | Usage |
|---------|------|--------|-------|
| Page Title | 32px | 700 | Main headings |
| Card Heading | 15px | 600 | Card titles |
| Metric/Stat | 28–44px | 700–800 | Key numbers |
| Body/Label | 13–14px | 400–500 | Main content |
| Caption | 11–12px | 400 | Meta information |

### Line Height

- Body text: `1.4`
- Large numbers: `1.1`

## Spacing System

All spacing uses a 4px base unit:

```
--space-1: 4px
--space-2: 8px
--space-3: 12px
--space-4: 16px
--space-5: 20px
--space-6: 24px
--space-8: 32px
--space-12: 48px
```

### Layout Guidelines

- **Outer padding:** 24–32px
- **Card padding:** 20–24px
- **Card gap:** 16px
- **Section spacing:** 24px

## Components

### Button

**Variants:** primary | secondary | ghost | pill

```tsx
import { Button } from '@/components/design-system';

// Primary (dark background)
<Button variant="primary">Save Changes</Button>

// Secondary (light background)
<Button variant="secondary">Cancel</Button>

// Ghost (transparent with border)
<Button variant="ghost">Learn More</Button>

// Pill (rounded full)
<Button variant="pill" color="green">Active</Button>
```

### Card

```tsx
import { Card } from '@/components/design-system';

// Standard card
<Card>
  <h3>Card Title</h3>
  <p>Content here</p>
</Card>

// Hoverable card
<Card hoverable>Click me</Card>

// Feature card (gradient background)
<Card isFeature>
  <div className="text-white">
    <p className="text-xs uppercase">Label</p>
    <p className="text-5xl font-bold">52%</p>
  </div>
</Card>
```

### Badge

**Colors:** green | red | gray | blue | amber

```tsx
import { Badge } from '@/components/design-system';

<Badge color="green">Completed</Badge>
<Badge color="red">Error</Badge>
<Badge color="blue">Info</Badge>
```

### Input

```tsx
import { Input } from '@/components/design-system';

<Input
  label="Email Address"
  type="email"
  placeholder="you@example.com"
  error={error}
/>

// With icon
<Input
  icon={<SearchIcon />}
  placeholder="Search..."
/>
```

### Stat (Metric Display)

```tsx
import { Stat } from '@/components/design-system';

<Stat
  label="Total Tonnage"
  value="2,450"
  change={15}  // +15%
  icon={<TrendingUp />}
  subMetrics={[
    { label: 'This Month', value: '850 tons' },
    { label: 'Average', value: '75 tons/day' }
  ]}
/>
```

## Using CSS Variables

All design tokens are available as CSS custom properties:

```css
.my-component {
  background-color: var(--bg-card);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
  padding: var(--space-6);
  font-family: var(--font-family);
}
```

## Using Design Hooks

### useDesignColors()

Get current theme colors in React:

```tsx
import { useDesignColors } from '@/hooks/useDesignColors';

function MyComponent() {
  const colors = useDesignColors();
  
  return (
    <div style={{ backgroundColor: colors.bg.card }}>
      Text color: {colors.text.primary}
    </div>
  );
}
```

### useDesignTokens()

Access spacing and border radius:

```tsx
import { useDesignTokens } from '@/contexts/DesignSystemContext';

function Dashboard() {
  const tokens = useDesignTokens();
  
  return (
    <div style={{ padding: tokens.spacing.lg }}>
      {/* Content */}
    </div>
  );
}
```

## Cards & Containers

### Light Mode
- Background: `#FFFFFF`
- Border radius: `16px`
- Shadow: `0 2px 12px rgba(0,0,0,0.06)`
- Padding: `20–24px`
- Hover shadow: `0 6px 24px rgba(0,0,0,0.10)`

### Dark Mode
- Background: `#1A1A1A`
- Border: `1px solid #2E2E2E` (borders matter more in dark mode)
- Shadow: `0 2px 12px rgba(0,0,0,0.4)`
- Hover shadow: `0 6px 24px rgba(0,0,0,0.6)`

## Navigation

- Background: white/dark card color
- Nav links: 14px / 500 weight
- Active state: filled pill with accent color
- Inactive: gray text
- Icons: 32–36px

## Feature Card Pattern

One card per section can use the gradient pattern:

**Light mode gradient:** `linear-gradient(135deg, #FDBA74, #FB7185, #93C5FD)`
**Dark mode gradient:** `linear-gradient(135deg, #92400E, #881337, #1E3A5F)`

- White text throughout
- Large stat (52–60px)
- Subtle texture overlay optional

## Data Visualizations

All charts use Recharts with design system colors.

### Chart Guidelines

- Bar charts: rounded top corners (4px)
- Line charts: 2px stroke, smooth curves
- Fill opacity: 10–15% (light mode), 8–12% (dark mode)
- Colors: Use the defined color palette
- Tooltips: white card, 12–13px text, fade-in animation
- Grid: extremely subtle (#2A2A2A in dark mode, #F5F5F5 in light)

## Micro-interactions

- Page load: numbers count up, cards fade in with stagger (50ms delay)
- Chart bars/lines: animate in on load (scaleY 0 → 1)
- Button press: scale(0.97) for tactile feedback
- Hover on cards: shadow lift
- Transitions: use `--transition-fast` (150ms) or `--transition-base` (200ms)

## Themes via CSS Custom Properties

Toggle light/dark mode by setting the `data-theme` attribute:

```javascript
// Switch to dark mode
document.documentElement.setAttribute('data-theme', 'dark');

// Switch to light mode
document.documentElement.removeAttribute('data-theme');
```

Or use the class-based approach (Tailwind):

```javascript
document.documentElement.classList.toggle('dark');
```

## Accessibility

- Sufficient color contrast maintained in both themes
- Focus states use visible ring (2px)
- Buttons scale down on click for feedback
- Form errors clearly marked in red
- Muted text still meets AA contrast ratio

## Do's and Don'ts

### Do ✓

- Use system spacing (4px units)
- Keep generous whitespace
- Use the design tokens consistently
- Test in both light and dark mode
- Use semantic color meanings (green = good, red = bad)

### Don't ✗

- Pure `#FFFFFF` backgrounds (use off-white)
- Harsh borders (use subtle shadows/borders)
- System fonts (use DM Sans)
- Bright saturated colors on main cards
- All-caps heavy headings
- Pure `#000000` in dark mode (use `#111111`)

## Migration from Old Styles

When updating existing components:

1. Replace hardcoded colors with CSS variables or Tailwind classes
2. Update shadow usage to use `--shadow` or `--shadow-lg`
3. Apply new button/card variants to matching elements
4. Test thoroughly in both light and dark modes

Example migration:

```tsx
// Before
<div className="bg-white text-gray-900 rounded-lg shadow-lg">

// After
<Card>
  <div className="text-text-primary dark:text-dark-text-primary">
```

## Resources

- **Fonts:** [DM Sans on Google Fonts](https://fonts.google.com/?query=DM%20Sans)
- **Icons:** Lucide React (already installed)
- **Colors:** See CSS variables in `src/index.css`
- **Components:** Import from `@/components/design-system`
