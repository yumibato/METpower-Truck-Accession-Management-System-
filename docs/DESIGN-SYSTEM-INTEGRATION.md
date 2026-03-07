# Design System Integration Guide

## Quick Start

The new design system has been integrated into your project. Here's how to start using it:

## 1. Import Components

```tsx
import { Button, Card, Badge, Input, Stat } from '@/components/design-system';
```

## 2. Use CSS Variables Directly

All design tokens are available as CSS custom properties in your stylesheets:

```css
.my-dashboard {
  background-color: var(--bg-card);
  color: var(--text-primary);
  padding: var(--space-6);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
}
```

## 3. Use Utility Hooks

```tsx
import { useDesignColors } from '@/hooks/useDesignColors';
import { useDesignTokens } from '@/contexts/DesignSystemContext';

function MyComponent() {
  const colors = useDesignColors();
  const tokens = useDesignTokens();
  
  return (
    <div style={{ backgroundColor: colors.bg.card }}>
      {/* Your content */}
    </div>
  );
}
```

## 4. Update Tailwind Classes

All Tailwind classes have been extended with the new color system:

```tsx
// Before
<div className="bg-white text-gray-900">

// After (using new design system colors)
<div className="bg-bg-card dark:bg-dark-bg-card text-text-primary dark:text-dark-text-primary">

// Or use the new Tailwind colors directly
<button className="bg-accent dark:bg-dark-accent text-white">
```

## Migration Checklist

When updating existing components:

- [ ] Replace hardcoded color values with CSS variables or Tailwind classes
- [ ] Update buttons to use the `<Button>` component or new classes
- [ ] Replace card divs with `<Card>` component
- [ ] Replace status badges with `<Badge>` component
- [ ] Update inputs to use `<Input>` component
- [ ] Test in both light and dark modes
- [ ] Verify shadows and borders render correctly

## Common Patterns

### Dashboard Card Grid

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <Card>
    <h3 className="text-xl font-semibold text-text-primary mb-4">Title</h3>
    {/* Content */}
  </Card>
</div>
```

### Form with Validation

```tsx
<form>
  <Input
    label="Email"
    type="email"
    error={errors.email}
  />
  <Button type="submit" variant="primary" className="mt-6">
    Submit
  </Button>
</form>
```

### Metric Display with Trend

```tsx
<Stat
  label="Total Revenue"
  value="$124,500"
  change={12}
  subMetrics={[
    { label: 'This Month', value: '$45,200' },
    { label: 'Avg Daily', value: '$1,475' }
  ]}
/>
```

### Feature Card

```tsx
<Card isFeature>
  <div>
    <p className="text-sm text-white/80 mb-3">ALERT</p>
    <p className="text-4xl font-bold text-white">Critical</p>
    <p className="text-sm text-white/90">System maintenance needed</p>
  </div>
</Card>
```

## File Structure

```
src/
├── components/
│   ├── design-system/          ← All design system components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── Input.tsx
│   │   ├── Stat.tsx
│   │   └── index.ts            ← Centralized exports
│   ├── DesignSystemGallery.tsx ← Sandbox/playground
│   └── ...
├── contexts/
│   ├── DesignSystemContext.tsx ← Design system provider
│   └── ...
├── hooks/
│   ├── useDesignColors.ts      ← Access color system
│   └── ...
├── index.css                   ← CSS variables & base styles
└── App.tsx                     ← Wrapped with DesignSystemProvider
```

## Dark Mode Switching

The design system automatically responds to the `dark` class on the `<html>` element:

```typescript
// Enable dark mode
document.documentElement.classList.add('dark');

// Disable dark mode
document.documentElement.classList.remove('dark');

// Toggle
document.documentElement.classList.toggle('dark');
```

The existing ThemeContext handles this automatically.

## Testing Both Modes

When developing:

1. Use the dark mode toggle in the design system gallery
2. Or manually toggle the `dark` class in dev tools
3. Verify all components look good in both light and dark modes

## Color References for Charts

For Recharts and other visualizations:

```typescript
import { useDesignColors } from '@/hooks/useDesignColors';

const colors = useDesignColors();

// Use in charts
<AreaChart data={data}>
  <Area
    dataKey="value"
    fill={colors.state.blue}
    stroke={colors.state.blue}
  />
</AreaChart>
```

## Spacing Consistency

Always use the spacing scale (4px units):

```
var(--space-1) = 4px    ← Use for tiny gaps
var(--space-2) = 8px    ← Icon padding
var(--space-3) = 12px   ← Small spacing
var(--space-4) = 16px   ← Default spacing
var(--space-5) = 20px   ← Section spacing
var(--space-6) = 24px   ← Card padding
var(--space-8) = 32px   ← Large spacing
var(--space-12) = 48px  ← Extra large spacing
```

## Best Practices

1. **Consistency:** Always use the design system for UI elements
2. **Spacing:** Never use arbitrary spacing—stick to the 4px scale
3. **Colors:** Use defined colors, never hardcode hex values
4. **Typography:** Use the defined font stack and sizes
5. **Shadows:** Use the shadow variables, not custom shadows
6. **Dark Mode:** Test every change in both light and dark modes
7. **Accessibility:** Always verify sufficient contrast

## Troubleshooting

### Colors not updating in dark mode?

Make sure components include dark mode classes:

```tsx
// ✗ Wrong
<div className="text-text-primary">

// ✓ Correct
<div className="text-text-primary dark:text-dark-text-primary">
```

### CSS variables not working?

Variables must be accessed in CSS, not in inline styles with Tailwind. Use:

```tsx
// ✓ Good in CSS
background-color: var(--bg-card);

// ✓ Good in Tailwind
className="bg-bg-card"

// ✗ Avoid in inline style
style={{ backgroundColor: 'var(--bg-card)' }} // Won't work
```

### Component not responsive?

Add grid classes:

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {items.map(item => <Card key={item.id}>{item.name}</Card>)}
</div>
```

## Next Steps

1. Review [DESIGN-SYSTEM.md](./DESIGN-SYSTEM.md) for complete documentation
2. Check [DesignSystemGallery.tsx](../src/components/DesignSystemGallery.tsx) for examples
3. Update existing components to use the new system
4. Deploy with confidence in a consistent, professional design

---

**Questions?** Refer to the component source files in `src/components/design-system/` for implementation details.
