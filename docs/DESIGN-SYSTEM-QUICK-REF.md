# Design System Quick Reference

## 🎨 Components

### Button
```tsx
<Button variant="primary" size="md">Click Me</Button>
```
**Variants:** primary | secondary | ghost | pill  
**Sizes:** sm | md | lg

### Card
```tsx
<Card hoverable isFeature>
  Content here
</Card>
```
**Props:** hoverable | isFeature

### Badge
```tsx
<Badge color="green">Active</Badge>
```
**Colors:** green | red | gray | blue | amber

### Input
```tsx
<Input label="Email" type="email" error="Required" icon={<Icon />} />
```

### Stat
```tsx
<Stat label="Revenue" value="$125K" change={15} subMetrics={[{label: 'Monthly', value: '$50K'}]} />
```

---

## 🎯 Colors

### Light Mode
```
Page: #EBEBEB          Cards: #FFFFFF         Text: #111111
Borders: #E5E7EB       Inputs: #F5F5F5        Secondary Text: #6B7280
```

### Dark Mode
```
Page: #111111          Cards: #1A1A1A         Text: #F5F5F5
Borders: #2E2E2E       Inputs: #2A2A2A        Secondary Text: #A1A1AA
```

### Semantic
```
✓ Success: #22C55E (light) / #4ADE80 (dark)
✕ Error:   #EF4444 (light) / #F87171 (dark)
ℹ Info:    #2563EB (light) / #3B82F6 (dark)
! Warning: #F97316 (light) / #FB923C (dark)
```

---

## 📐 Spacing (4px units)

```
--space-1  = 4px      --space-2  = 8px
--space-3  = 12px     --space-4  = 16px
--space-5  = 20px     --space-6  = 24px
--space-8  = 32px     --space-12 = 48px
```

---

## 🔤 Typography

```
DM Sans, Plus Jakarta Sans

Page Title:    32px / 700
Card Heading:  15px / 600
Body:          13–14px / 400–500
Caption:       11–12px / 400
Metric:        28–44px / 700–800
```

---

## 🔌 Hooks & Context

### Access Colors
```tsx
import { useDesignColors } from '@/hooks/useDesignColors';

const colors = useDesignColors();
// colors.bg.card, colors.text.primary, colors.state.blue
```

### Access Tokens
```tsx
import { useDesignTokens } from '@/contexts/DesignSystemContext';

const tokens = useDesignTokens();
// tokens.spacing.md, tokens.borderRadius.lg, tokens.shadows.lg
```

---

## 🌓 Dark Mode

Set on html element:
```typescript
document.documentElement.classList.add('dark');
document.documentElement.classList.remove('dark');
document.documentElement.classList.toggle('dark');
```

Or use data-theme:
```typescript
document.documentElement.setAttribute('data-theme', 'dark');
```

All components automatically respond!

---

## 📝 CSS Variables

Use anywhere in CSS:
```css
.my-element {
  background: var(--bg-card);
  color: var(--text-primary);
  padding: var(--space-6);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
}
```

---

## 🚀 Common Patterns

### Dashboard Layout
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <Card>
    <Stat label="KPI" value="1,234" change={5} />
  </Card>
</div>
```

### Form
```tsx
<form>
  <Input label="Name" />
  <Input label="Email" type="email" />
  <Button type="submit" variant="primary">Submit</Button>
</form>
```

### Status Display
```tsx
<div className="flex items-center gap-2">
  <span className="w-2 h-2 bg-state-green rounded-full" />
  <span>Active</span>
  <Badge color="green">Online</Badge>
</div>
```

---

## 📚 Documentation

- **Full Guide:** `docs/DESIGN-SYSTEM.md`
- **Integration:** `docs/DESIGN-SYSTEM-INTEGRATION.md`
- **Status:** `docs/IMPLEMENTATION-COMPLETE.md`
- **Sandbox:** Component → `DesignSystemGallery.tsx`

---

## ✅ Tailwind Classes

All design system colors available as Tailwind utilities:

```tsx
{/* Light mode colors */}
className="bg-bg-card text-text-primary border-border"
className="bg-state-blue text-state-green"

{/* Dark mode colors */}
className="dark:bg-dark-bg-card dark:text-dark-text-primary dark:border-dark-border"
className="dark:bg-dark-state-blue dark:text-dark-state-green"
```

---

## 🎪 View the Gallery

Import and use the Design System Gallery component:
```tsx
import DesignSystemGallery from '@/components/DesignSystemGallery';

// Renders interactive showcase of all components
<DesignSystemGallery />
```

---

## ❌ Don'ts

- ❌ Hardcode colors (use variables)
- ❌ Use system fonts (use DM Sans)
- ❌ Create custom shadows (use --shadow tokens)
- ❌ Ignore dark mode (test both)
- ❌ Skip spacing scale (use 4px units)

---

## ✓ Do's

- ✓ Use design system components
- ✓ Follow spacing scale strictly
- ✓ Test light & dark modes
- ✓ Reference documentation
- ✓ Keep UI consistent

---

**Ready to build!** Start with `docs/DESIGN-SYSTEM-INTEGRATION.md` for complete setup instructions.
