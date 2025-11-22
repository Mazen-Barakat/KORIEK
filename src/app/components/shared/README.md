# Shared UI Components

This directory contains reusable UI components used across the workshop management system.

## Components

### 1. ActionBadgeComponent (`action-badge`)

A smart, interactive badge for displaying actionable items with priority levels.

**Features:**
- Priority-based styling (high, medium, low)
- Optional icon support
- Urgent pulse animation for high-priority items
- Disabled state when count is 0
- Smooth hover animations with directional arrow

**Usage:**
```html
<app-action-badge
  [count]="5"
  label="New Booking Requests"
  priority="high"
  icon="📋"
  (clicked)="handleAction()">
</app-action-badge>
```

**Inputs:**
- `count: number` - Number to display (default: 0)
- `label: string` - Descriptive label (default: '')
- `priority: ActionBadgePriority` - Visual priority ('high' | 'medium' | 'low')
- `icon?: string` - Optional emoji or icon

**Outputs:**
- `clicked: EventEmitter<void>` - Emits when badge is clicked

**Priority Variants:**
- `high`: Red theme with pulse animation
- `medium`: Orange/yellow theme
- `low`: Gray theme, minimal emphasis

---

### 2. StatCardComponent (`stat-card`)

A polished card for displaying key metrics with optional trend indicators.

**Features:**
- Four color variants (primary, success, warning, info)
- Trend indicators with up/down arrows
- Loading skeleton state
- Accent border animation
- Smooth hover effects with icon rotation

**Usage:**
```html
<app-stat-card
  icon="💰"
  label="Monthly Revenue"
  [value]="'$15,250'"
  [trend]="12.5"
  variant="success">
</app-stat-card>
```

**Inputs:**
- `icon: string` - Icon to display (emoji or class name)
- `label: string` - Metric label
- `value: string | number` - Metric value
- `trend?: number` - Percentage change (optional)
- `variant: StatCardVariant` - Color theme ('primary' | 'success' | 'warning' | 'info')
- `loading: boolean` - Show loading skeleton (default: false)

**Variants:**
- `primary`: Red theme (#ef4444)
- `success`: Green theme (#10b981)
- `warning`: Orange theme (#f59e0b)
- `info`: Blue theme (#3b82f6)

---

### 3. SectionHeaderComponent (`section-header`)

A consistent header component for sections with optional badge and icon.

**Features:**
- Icon support with gradient background
- Optional subtitle
- Badge with color variants
- Consistent spacing and typography

**Usage:**
```html
<app-section-header
  title="Action Required"
  subtitle="Items that need your attention"
  icon="⚡"
  [badge]="10"
  badgeVariant="primary">
</app-section-header>
```

**Inputs:**
- `title: string` - Main heading text
- `subtitle?: string` - Optional subheading
- `icon?: string` - Optional icon (emoji or class name)
- `badge?: string | number` - Optional badge value
- `badgeVariant: 'primary' | 'success' | 'warning' | 'info'` - Badge color theme

---

## Design System

### Color Palette
```css
Primary:   #ef4444 (Red)
Success:   #10b981 (Green)
Warning:   #f59e0b (Orange)
Info:      #3b82f6 (Blue)
Neutral:   #6b7280 (Gray)
```

### Spacing Grid
- Base unit: 8px
- Common gaps: 8px, 12px, 16px, 20px
- Card padding: 16px - 20px

### Border Radius
- Small: 6px - 8px
- Medium: 10px - 12px
- Pill: 20px

### Transitions
- Standard: `all 0.3s ease`
- Fast: `all 0.2s ease`

---

## Import Example

```typescript
import { 
  ActionBadgeComponent, 
  StatCardComponent, 
  SectionHeaderComponent 
} from '../shared';

@Component({
  selector: 'app-my-component',
  standalone: true,
  imports: [
    CommonModule,
    ActionBadgeComponent,
    StatCardComponent,
    SectionHeaderComponent
  ],
  // ...
})
```

---

## Best Practices

1. **Consistent Icons**: Use emojis for simplicity or consistent icon library
2. **Priority Levels**: Reserve 'high' priority for truly urgent items
3. **Loading States**: Use loading prop on stat cards during data fetches
4. **Accessibility**: All components include proper hover states and disabled states
5. **Responsive**: Components adapt to container width

---

## Future Enhancements

- [ ] Add dark mode support
- [ ] Support custom icon components (FontAwesome, Material Icons)
- [ ] Add animation variants
- [ ] Tooltip support for truncated labels
- [ ] Keyboard navigation support
