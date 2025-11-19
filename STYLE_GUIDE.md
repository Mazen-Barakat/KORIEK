# KORIEK - My Vehicles Page Style Guide

## 🎨 Visual Design System

### Color Palette

#### Primary Colors
```css
--brand-primary: #FF3B30    /* Red - Primary actions, CTAs, accents */
--brand-dark: #2c5282       /* Navy - Hero sections, headers */
--brand-secondary: #3b82f6  /* Blue - Informational elements */
```

#### Neutral Colors
```css
--surface-primary: #FFFFFF      /* Cards, containers */
--surface-secondary: #F5F5F7    /* Page background, secondary elements */
--surface-tertiary: #E8E8ED     /* Hover states */
--text-primary: #1f2937         /* Headings, primary text */
--text-secondary: #6b7280       /* Body text, labels */
--text-tertiary: #86868b        /* Captions, metadata */
```

#### Status Colors
```css
--status-success: #22c55e       /* Good condition */
--status-warning: #f97316       /* Warning state */
--status-critical: #ef4444      /* Critical state */
```

---

## 📐 Typography

### Font Family
```css
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
```

### Type Scale

#### Display
```css
font-size: 2.5rem;              /* 40px - Page titles */
font-weight: 700-800;
letter-spacing: -0.02em;
line-height: 1.2;
```

#### Heading 1
```css
font-size: 2rem;                /* 32px - Section titles */
font-weight: 700-800;
letter-spacing: -0.02em;
line-height: 1.2;
```

#### Heading 2
```css
font-size: 1.75rem;             /* 28px - Card titles */
font-weight: 600-700;
letter-spacing: -0.02em;
line-height: 1.3;
```

#### Heading 3
```css
font-size: 1.375rem;            /* 22px - Subsection titles */
font-weight: 600-700;
line-height: 1.4;
```

#### Body
```css
font-size: 1rem;                /* 16px - Body text */
font-weight: 400-500;
line-height: 1.6;
```

#### Caption
```css
font-size: 0.875rem;            /* 14px - Metadata */
font-weight: 500-600;
line-height: 1.5;
```

#### Small
```css
font-size: 0.75rem;             /* 12px - Labels, badges */
font-weight: 600-700;
text-transform: uppercase;
letter-spacing: 0.05em;
```

---

## 📏 Spacing System

### Base Unit: 4px (0.25rem)

```css
--spacing-xs: 0.5rem;    /* 8px */
--spacing-sm: 0.75rem;   /* 12px */
--spacing-md: 1rem;      /* 16px */
--spacing-lg: 1.5rem;    /* 24px */
--spacing-xl: 2rem;      /* 32px */
--spacing-2xl: 2.5rem;   /* 40px */
--spacing-3xl: 3rem;     /* 48px */
```

### Component Padding
- **Cards**: 1.5rem (24px)
- **Buttons**: 0.75rem 1.5rem (12px 24px)
- **Page Container**: 2rem (32px)
- **Section Gap**: 2rem (32px)

---

## 🔲 Border Radius

```css
--radius-sm: 8px         /* Small elements, badges */
--radius-md: 12px        /* Buttons, inputs */
--radius-lg: 16px        /* Small cards */
--radius-xl: 20px        /* Large cards */
--radius-2xl: 24px       /* Page sections */
--radius-pill: 980px     /* Pill-shaped buttons */
--radius-circle: 50%     /* Circular elements */
```

---

## 🌑 Shadows

### Elevation System

#### Level 1 - Subtle
```css
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02);
/* Use for: Resting cards, minimal elevation */
```

#### Level 2 - Medium
```css
box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06), 0 2px 4px rgba(0, 0, 0, 0.03);
/* Use for: Interactive elements, hover states */
```

#### Level 3 - Prominent
```css
box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.04);
/* Use for: Raised cards, important CTAs */
```

#### Level 4 - Modal
```css
box-shadow: 0 24px 60px rgba(0, 0, 0, 0.16);
/* Use for: Modals, overlays */
```

#### Colored Shadows (Accent)
```css
/* Primary Red */
box-shadow: 0 8px 24px rgba(255, 59, 48, 0.3);

/* Blue Info */
box-shadow: 0 8px 24px rgba(59, 130, 246, 0.15);
```

---

## 🎬 Motion & Animation

### Duration
```css
--duration-instant: 100ms    /* Icon transitions */
--duration-fast: 200ms       /* Hover effects */
--duration-normal: 300ms     /* Standard transitions */
--duration-slow: 400ms       /* Complex animations */
--duration-slower: 500ms     /* Page transitions */
```

### Easing
```css
--ease-default: cubic-bezier(0.4, 0, 0.2, 1)  /* Standard easing */
--ease-in: cubic-bezier(0.4, 0, 1, 1)         /* Deceleration */
--ease-out: cubic-bezier(0, 0, 0.2, 1)        /* Acceleration */
```

### Key Animations

#### slideUp
```css
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
/* Duration: 0.5s-0.9s with staggered delays */
```

#### cardSlideIn
```css
@keyframes cardSlideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
/* Duration: 0.5s with 0.1s delay increments */
```

#### fadeIn
```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
/* Duration: 0.3s-0.6s */
```

---

## 🎯 Component Patterns

### Button Styles

#### Primary Button
```css
background: #FF3B30;
color: white;
border-radius: 980px;
padding: 0.75rem 1.5rem;
font-weight: 600;
box-shadow: 0 2px 8px rgba(255, 59, 48, 0.2);
transition: all 0.2s ease;
```

**Hover State:**
```css
background: #D73329;
transform: translateY(-1px);
box-shadow: 0 4px 12px rgba(255, 59, 48, 0.3);
```

#### Secondary Button
```css
background: #FFFFFF;
color: #1f2937;
border: 1px solid rgba(0, 0, 0, 0.1);
border-radius: 10px;
padding: 0.75rem 1rem;
font-weight: 600;
```

**Hover State:**
```css
background: #F9FAFB;
border-color: rgba(0, 0, 0, 0.15);
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
```

### Card Styles

#### Vehicle Card
```css
background: #FFFFFF;
border-radius: 20px;
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
overflow: hidden;
```

**Hover State:**
```css
box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
transform: translateY(-4px);
```

#### Section Card
```css
background: #FFFFFF;
border-radius: 20px;
padding: 1.5rem-2rem;
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
```

### Indicator Styles

#### Good Status
```css
background: #F5F5F7;
border: 2px solid transparent;
.indicator-status {
  color: #22c55e;
}
```

#### Warning Status
```css
background: linear-gradient(135deg, rgba(251, 146, 60, 0.08), rgba(249, 115, 22, 0.12));
border: 2px solid rgba(251, 146, 60, 0.3);
.indicator-status {
  color: #f97316;
}
```

#### Critical Status
```css
background: linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(220, 38, 38, 0.12));
border: 2px solid rgba(239, 68, 68, 0.3);
.indicator-status {
  color: #ef4444;
}
```

---

## 📱 Responsive Breakpoints

```css
/* Desktop Large */
@media (min-width: 1440px) { /* Extra wide displays */ }

/* Desktop */
@media (min-width: 1200px) { /* Standard desktop */ }

/* Tablet */
@media (max-width: 1200px) { /* iPad, tablets */ }

/* Mobile */
@media (max-width: 768px) { /* Phones */ }

/* Mobile Small */
@media (max-width: 480px) { /* Small phones */ }
```

### Grid Behavior
- **Desktop (>1200px)**: 2-column grid (2fr 1fr)
- **Tablet (≤1200px)**: Single column
- **Mobile (≤768px)**: Single column, stacked elements

---

## 🔍 Accessibility

### Focus States
```css
*:focus-visible {
  outline: 2px solid #FF3B30;
  outline-offset: 2px;
}
```

### Color Contrast
- **Text on White**: Minimum AA (4.5:1 ratio)
- **Primary Text**: #1f2937 on #FFFFFF (12.6:1) ✅
- **Secondary Text**: #6b7280 on #FFFFFF (5.74:1) ✅
- **Button Text**: #FFFFFF on #FF3B30 (4.52:1) ✅

### ARIA Labels
- All interactive elements have `aria-label` or visible text
- `role="dialog"` for modals
- `aria-modal="true"` for modal overlays

---

## 🎨 Design Inspiration Reference

### Tesla Website Influences
- **Minimalistic hero sections** with large imagery
- **Clean typography** with generous whitespace
- **Pill-shaped buttons** with subtle shadows
- **Smooth transitions** and hardware-accelerated animations
- **High-quality product photography** with depth

### Mercedes Website Influences
- **Premium color palette** (dark blues, reds, whites)
- **Layered depth** with subtle shadows
- **Icon-driven interfaces** with minimal text
- **Sophisticated gradients** and lighting effects
- **Attention to micro-interactions**

---

## 📐 Layout Grid

### Container
```css
max-width: 1600px;
margin: 0 auto;
padding: 6rem 2rem 3rem;
```

### Two-Column Grid
```css
display: grid;
grid-template-columns: 2fr 1fr;
gap: 2rem;
```

### Indicator Grid
```css
display: grid;
grid-template-columns: repeat(4, 1fr);
gap: 0.75rem;
```

---

## 🎯 Usage Examples

### Creating a New Button
```html
<button class="btn-primary">
  <svg><!-- icon --></svg>
  <span>Button Text</span>
</button>
```

```css
.btn-primary {
  background: var(--brand-primary);
  color: white;
  border-radius: var(--radius-pill);
  padding: var(--spacing-sm) var(--spacing-lg);
  font-weight: 600;
  transition: all var(--duration-fast) var(--ease-default);
}
```

### Creating a Status Indicator
```html
<div class="indicator-item" [class.indicator-warning]="status === 'warning'">
  <div class="indicator-icon">🛢️</div>
  <div class="indicator-content">
    <span class="indicator-name">Oil</span>
    <span class="indicator-status">Good</span>
  </div>
</div>
```

---

## 🚀 Performance Guidelines

### CSS Best Practices
- Use `transform` and `opacity` for animations (GPU-accelerated)
- Avoid animating `width`, `height`, `margin`, `padding`
- Use `will-change` sparingly and only when needed
- Minimize box-shadow complexity

### Animation Performance
```css
/* Good ✅ */
.element {
  transform: translateY(-4px);
  opacity: 0.9;
  will-change: transform, opacity;
}

/* Avoid ❌ */
.element {
  margin-top: -4px;
  height: calc(100% - 4px);
}
```

---

## 📖 Component Library

### Page Structure
```
.my-vehicles-page
├── .left-column
│   ├── .profile-welcome-section (untouched)
│   ├── .vehicles-section
│   │   ├── .section-header
│   │   └── .vehicles-list
│   │       └── .vehicle-card (multiple)
│   │           ├── .vehicle-image-section
│   │           ├── .vehicle-header
│   │           ├── .mileage-card
│   │           ├── .car-indicators
│   │           └── .quick-actions
│   └── .book-service-cta
└── .right-column
    └── .upcoming-maintenance-section
```

---

## ✅ Design Checklist

When creating new components, ensure:

- [ ] Follows color palette (brand-primary, neutrals, status)
- [ ] Uses system font stack
- [ ] Implements correct border-radius (8px-24px)
- [ ] Has proper shadow elevation (1-4 levels)
- [ ] Includes hover/active states
- [ ] Uses hardware-accelerated animations
- [ ] Meets WCAG AA color contrast
- [ ] Includes focus-visible states
- [ ] Responsive at 768px and 1200px breakpoints
- [ ] Uses consistent spacing (0.5rem-3rem scale)
- [ ] Animation duration 200-500ms
- [ ] Cubic-bezier easing curves

---

**Style Guide Version**: 1.0  
**Last Updated**: November 19, 2025  
**Maintained By**: KORIEK Design Team
