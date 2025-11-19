# 🎨 Booking Page - Component Catalog

Visual reference for all UI components in the booking system.

---

## 🎯 Navigation & Progress

### Progress Stepper
```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│    (1)  ━━━━━  (2)  ━━━━━  (3)  ━━━━━  (4)                   │
│  Service    Date&Time  Workshop   Review                       │
│                                                                │
└────────────────────────────────────────────────────────────────┘

States:
• Inactive:  ( 2 )  Gray circle, gray label
• Active:    ( 2 )  Red gradient circle with pulse, red label
• Completed: ( ✓ )  Green gradient circle with checkmark, green label
• Line:      ━━━━━  Gray (inactive), Green (completed)
```

**Sizes**: Circle 48px, Mobile 40px  
**Spacing**: 1rem gaps between elements  
**Animation**: Pulse on active, Scale-in on checkmark

---

## 📦 Cards & Containers

### Section Card (Base Container)
```
┌────────────────────────────────────────────────┐
│  [Icon]  Section Title                         │
│          Section subtitle text                  │
│  ────────────────────────────────────────────  │
│                                                │
│  Content goes here                             │
│                                                │
└────────────────────────────────────────────────┘
```

**Styling**:
- Background: White (#FFFFFF)
- Border Radius: 24px
- Padding: 2rem
- Shadow: `0 4px 16px rgba(0, 0, 0, 0.06)`
- Icon Box: 48x48px, red gradient background (10% opacity)

---

### Vehicle Card
```
┌──────────────────────────────────────┐
│                            [✓]       │  ← Checkmark (when selected)
│  Toyota Camry                        │
│  2021 • ABC 1234                     │
│  45,230 km                           │
└──────────────────────────────────────┘

States:
• Default:  Gray border, light gray background
• Hover:    Red border, transform up, shadow increase
• Selected: Red border, red gradient background (5% opacity), checkmark
```

**Layout**: Grid, 280px min width, auto-fill columns  
**Spacing**: 1rem gap between cards

---

### Service Type Card
```
┌────────────────────────────┐
│              [✓]           │  ← Checkmark (when selected)
│                            │
│          🛢️                │  ← Large emoji icon
│                            │
│      Oil Change            │
│                            │
│  Regular oil and filter    │
│       replacement          │
│                            │
│  ──────────────────────    │
│  ⏱️ 30-45 min             │
│  From 350 EGP              │
└────────────────────────────┘

States:
• Default:  Gray border, light gray background
• Hover:    Red border, transform up, shadow increase
• Selected: Red border, red gradient background (5% opacity), checkmark
```

**Layout**: Grid, 240px min width, auto-fill columns  
**Icon**: 2.5rem emoji  
**Spacing**: 1rem gap between cards

---

### Date Card (Calendar Cell)
```
┌─────────────┐
│             │
│     Fri     │  ← Weekday (small, uppercase)
│     17      │  ← Date number (large, bold)
│     Jan     │  ← Month (small)
│             │
└─────────────┘

States:
• Default:  Gray text, light gray background, gray border
• Hover:    Red border, transform up, shadow increase
• Selected: White text, red gradient background
```

**Layout**: Grid, 100px min width (80px on mobile)  
**Spacing**: 1rem gap between cards

---

### Time Slot Button
```
┌─────────────┐
│             │
│    09:00    │  ← Time in 24h format
│             │
└─────────────┘

States:
• Available:    Gray text, light gray background, clickable
• Hover:        Red border, transform up
• Selected:     White text, red gradient background
• Unavailable:  Light gray text, disabled cursor, "Booked" label
```

**Layout**: Grid, 100px min width (90px on mobile)  
**Spacing**: 0.75rem gap

---

### Workshop Card
```
┌────────────────────────────────────────────────────────────────┐
│  [✓]  Premium Auto Care                   [Available Today]   │
│       ⭐ 4.9 (487 reviews)                                     │
│       ────────────────────────────────────────────────────     │
│       📍 2.3 km away • 10 min                                  │
│       📞 +20 12 345 6789                                       │
│       ⏰ 123 Main St, Downtown                                 │
│       ────────────────────────────────────────────────────     │
│       [Oil Change] [Tire Service] [Brakes] [Diagnostics]      │
└────────────────────────────────────────────────────────────────┘

Components:
• Checkmark:       Top-left, 32px circle with checkmark
• Name:            1.125rem, bold
• Rating:          Gold star + number + review count
• Badge:           Green (Available Today) or Yellow (Available Tomorrow)
• Detail Items:    Icon + text, 0.875rem
• Service Tags:    Small pills with service names
```

**Layout**: Vertical stack, full width  
**Spacing**: 1.5rem gap between cards  
**Badge Colors**: 
- Available Today: Green background (#D1FAE5), dark green text
- Available Tomorrow: Yellow background (#FEF3C7), dark brown text

---

## 🔘 Buttons

### Primary Button
```
┌──────────────────────────────┐
│  [Icon]  Button Text  [Icon] │
└──────────────────────────────┘

Variants:
• Default: Red gradient background, white text
• Confirm: Green gradient background, white text
• Disabled: 50% opacity, no hover effects
```

**Styling**:
- Padding: 1rem 2rem
- Border Radius: 14px
- Font: 0.9375rem, weight 600
- Shadow: `0 4px 16px rgba(255, 59, 48, 0.25)`
- Hover: Transform up 2px, shadow increase, shine sweep animation

**Effects**:
```css
/* Shine Sweep */
Linear gradient sweep from left to right on hover
Duration: 0.5s
```

---

### Secondary Button
```
┌──────────────────────────────┐
│  [Icon]  Button Text  [Icon] │
└──────────────────────────────┘

States:
• Default: White background, gray text, gray border
• Hover:   Light gray background, darker text, darker border
• Disabled: 50% opacity, no hover effects
```

**Styling**: Same size as primary, different colors

---

### Icon Button (Close, Edit, etc.)
```
┌────┐
│ ✕  │  ← Close button
└────┘

┌────────┐
│  Edit  │  ← Edit button
└────────┘
```

**Sizes**: 40x40px (close), auto-width (edit)  
**Border Radius**: 12px (close), 8px (edit)

---

## 📝 Forms & Inputs

### Text Area (Service Notes)
```
┌────────────────────────────────────────────────────────┐
│  Additional Notes (Optional)                           │
│  ┌──────────────────────────────────────────────────┐ │
│  │ Any specific issues or requests? e.g., Strange  │ │
│  │ noise when braking...                            │ │
│  │                                                  │ │
│  └──────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘

States:
• Default: Gray border, white background
• Focus:   Red border, red glow shadow
```

**Styling**:
- Border: 2px solid #E5E7EB
- Border Radius: 12px
- Padding: 1rem
- Rows: 3 (adjustable)

---

## 📋 Review Components

### Review Item
```
┌────────────────────────────────────────────────────────────┐
│  [Icon] Label                                              │
│                                                            │
│         Main Text (bold)                                   │
│         Subtext (gray)                                     │
│         Optional note (italic)                    [Edit]   │
└────────────────────────────────────────────────────────────┘

Components:
• Icon:    18px, red stroke, left-aligned
• Label:   Semibold, gray, 150px width
• Content: Bold main text, regular subtext
• Edit:    Small button, red text, right-aligned
```

**Layout**: Horizontal flex, light gray background, 1.5rem padding

---

### Price Breakdown
```
┌────────────────────────────────────────────────────────────┐
│  Price Estimate                                            │
│  ────────────────────────────────────────────────────────  │
│  Service Fee                               402.50 EGP      │
│  Tax (14%)                                  56.35 EGP      │
│  ────────────────────────────────────────────────────────  │
│  Total Estimate                            458.85 EGP      │
│                                                            │
│  *Final price may vary based on actual service requirements│
└────────────────────────────────────────────────────────────┘

Styling:
• Background: Red gradient (5% opacity), red border
• Price Items: Space-between flex
• Total: Larger font, bold, red color
• Note: Small italic, gray
```

---

## 🎉 Success Components

### Success Circle
```
        ┌────────────┐
        │            │
        │     ✓      │  ← Animated checkmark
        │            │
        └────────────┘

Animation Sequence:
1. Circle scales from 0 to 1.1 to 1 (0.6s)
2. Checkmark draws from 0% to 100% (0.5s, delayed 0.3s)
3. Pulse shadow continuously

Styling:
• Size: 120px diameter
• Background: Green gradient
• Shadow: `0 8px 32px rgba(16, 185, 129, 0.3)`
• Checkmark: 64px, white stroke
```

---

### Confirmation Card
```
┌────────────────────────────────────────────────────────────┐
│                Confirmation Number                         │
│                   BKXXXXXXXX                               │
│  ────────────────────────────────────────────────────────  │
│  [Icon]  Toyota Camry                                      │
│          ABC 1234                                          │
│                                                            │
│  [Icon]  Friday, January 17, 2025                          │
│          09:00                                             │
│                                                            │
│  [Icon]  Premium Auto Care                                 │
│          123 Main St, Downtown                             │
│  ────────────────────────────────────────────────────────  │
│  [ℹ️]   A confirmation email has been sent to your         │
│         registered email address. Please arrive 10 minutes │
│         early.                                             │
└────────────────────────────────────────────────────────────┘

Components:
• Confirmation Number: Large, monospace font, red color
• Detail Items: Icon (20px) + text, left-aligned
• Info Box: Blue background, blue icon, blue text
```

**Styling**:
- Background: White
- Border Radius: 24px
- Shadow: `0 4px 24px rgba(0, 0, 0, 0.08)`
- Max Width: 600px
- Padding: 2rem

---

## 🏷️ Badges & Tags

### Availability Badge
```
┌─────────────────────┐
│  Available Today    │  ← Green background
└─────────────────────┘

┌─────────────────────┐
│  Available Tomorrow │  ← Yellow background
└─────────────────────┘

Styling:
• Padding: 0.5rem 1rem
• Border Radius: 8px
• Font: 0.8125rem, weight 600
```

---

### Service Tag
```
┌───────────────┐
│  Oil Change   │  ← Small pill-shaped tag
└───────────────┘

Styling:
• Background: White
• Border: 1px solid #E5E7EB
• Border Radius: 8px
• Padding: 0.375rem 0.75rem
• Font: 0.75rem, weight 500, gray color
```

---

## 📢 Banners

### Draft Resume Banner
```
┌────────────────────────────────────────────────────────────┐
│  [⏰] You have an unfinished booking                       │
│       Resume where you left off or start fresh            │
│                                        [Resume] [✕]        │
└────────────────────────────────────────────────────────────┘

Position: Fixed, top of page (below navbar)
Animation: Slide down from top (0.4s)

Components:
• Icon:    40px circle, white icon, semi-transparent background
• Text:    Bold title, regular subtitle
• Buttons: Resume (white bg), Dismiss (transparent bg)

Styling:
• Background: Blue gradient (#3B82F6 → #2563EB)
• Color: White text
• Shadow: `0 4px 16px rgba(37, 99, 235, 0.3)`
• Padding: 1rem 2rem
```

---

## 🎨 Color Reference

### Gradients
```css
/* Primary Red */
linear-gradient(135deg, #FF3B30 0%, #EF4444 50%, #DC2626 100%)

/* Success Green */
linear-gradient(135deg, #10B981 0%, #059669 100%)

/* Blue (Draft Banner) */
linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)

/* Page Background */
linear-gradient(180deg, #F5F5F7 0%, #FAFAFA 100%)

/* Selected Card Background */
linear-gradient(135deg, rgba(255,59,48,0.05) 0%, rgba(239,68,68,0.08) 100%)

/* Icon Box Background */
linear-gradient(135deg, rgba(255,59,48,0.1) 0%, rgba(239,68,68,0.15) 100%)
```

### Solid Colors
```css
/* Text Colors */
--text-primary:   #1f2937   /* Dark gray - headings */
--text-secondary: #6b7280   /* Medium gray - body */
--text-tertiary:  #9CA3AF   /* Light gray - labels */

/* Background Colors */
--bg-white:    #FFFFFF
--bg-light:    #F9FAFB
--bg-lighter:  #F5F5F7
--bg-lightest: #FAFAFA

/* Border Colors */
--border-default: #E5E7EB
--border-light:   #D1D5DB

/* Accent Colors */
--red:    #FF3B30
--green:  #10B981
--yellow: #FEF3C7 (bg), #92400E (text)
--blue:   #3B82F6
```

---

## 📏 Spacing System

```
┌─────────────────────────────────────────────────┐
│  0.25rem  =   4px   │  Tiny gaps              │
│  0.5rem   =   8px   │  Small gaps             │
│  0.75rem  =  12px   │  Medium gaps            │
│  1rem     =  16px   │  Standard gap           │
│  1.25rem  =  20px   │  Large gap              │
│  1.5rem   =  24px   │  XL gap                 │
│  2rem     =  32px   │  Section padding        │
│  2.5rem   =  40px   │  Large section padding  │
│  3rem     =  48px   │  Extra large padding    │
└─────────────────────────────────────────────────┘
```

---

## 🔤 Typography Scale

```
┌──────────────────────────────────────────────────────┐
│  h1    2.5rem (40px)    700     Page titles         │
│  h2    1.5rem (24px)    700     Section headings    │
│  h3    1.125rem (18px)  600     Card headings       │
│  body  0.9375rem (15px) 500     Normal text         │
│  small 0.8125rem (13px) 500     Labels, subtitles   │
│  tiny  0.75rem (12px)   500     Tags, notes         │
└──────────────────────────────────────────────────────┘

Font Weights:
• 700: Bold (headings)
• 600: Semibold (subheadings, buttons)
• 500: Medium (body, labels)
```

---

## 📱 Responsive Grid Adjustments

### Desktop (Default)
```
Vehicle Cards:     3-4 columns (280px min)
Service Cards:     3-4 columns (240px min)
Date Cards:        7 columns (100px min)
Time Slots:        6-7 columns (100px min)
Workshop Cards:    1 column (full width)
```

### Tablet (< 768px)
```
Vehicle Cards:     2 columns
Service Cards:     2 columns
Date Cards:        5 columns
Time Slots:        4-5 columns
Workshop Cards:    1 column
```

### Mobile (< 768px)
```
Vehicle Cards:     1 column
Service Cards:     1 column
Date Cards:        4 columns (80px min)
Time Slots:        3-4 columns (90px min)
Workshop Cards:    1 column

Additional Changes:
• Stepper circles: 48px → 40px
• Section padding: 2rem → 1.5rem
• Button layout: Vertical stack
• Review items: Vertical stack
```

---

## 🎭 Animation Timing Functions

```css
/* Primary Easing */
cubic-bezier(0.4, 0, 0.2, 1)  /* All transitions */

/* Durations */
--duration-fast:   0.3s   /* Hover effects, selections */
--duration-medium: 0.5s   /* Shine animations, step changes */
--duration-slow:   0.6s   /* Page entrance, success animation */
--duration-pulse:  2s     /* Continuous pulse loop */
```

---

## 🔍 State Visualization

### Card States
```
┌─────────────┐  Hover   ┌─────────────┐  Click   ┌─────────────┐
│   Default   │  ────▶   │   Hovered   │  ────▶   │  Selected   │
│  Gray bg    │          │   Red border│          │  Red bg [✓] │
│  Gray border│          │  Transform↑ │          │  Checkmark  │
└─────────────┘          └─────────────┘          └─────────────┘
```

### Button States
```
┌─────────────┐  Hover   ┌─────────────┐  Click   ┌─────────────┐
│   Default   │  ────▶   │   Hovered   │  ────▶   │   Active    │
│  Red bg     │          │  Transform↑ │          │  Transform↓ │
│  Box shadow │          │  ↑ Shadow   │          │  ↓ Shadow   │
└─────────────┘          └─────────────┘          └─────────────┘
            │                                            │
            │   Disabled                                 │
            └──────▶  ┌─────────────┐                   │
                      │   Disabled  │ ◀─────────────────┘
                      │  50% opacity│
                      │  No cursor  │
                      └─────────────┘
```

---

## 📦 Component Hierarchy

```
BookingPage
├── DraftBanner (conditional, fixed)
│   ├── Icon
│   ├── Text (title + subtitle)
│   └── Actions (Resume + Dismiss buttons)
│
└── Container
    ├── Header (hidden on step 5)
    │   ├── Title + Subtitle
    │   └── ProgressStepper
    │       ├── Step 1 (circle + label)
    │       ├── Line
    │       ├── Step 2 (circle + label)
    │       ├── Line
    │       ├── Step 3 (circle + label)
    │       ├── Line
    │       └── Step 4 (circle + label)
    │
    ├── StepContent (conditional based on currentStep)
    │   │
    │   ├── Step 1: Service Selection
    │   │   ├── SectionCard: Vehicle Selection
    │   │   │   ├── SectionHeader (icon + title)
    │   │   │   ├── VehicleGrid
    │   │   │   │   └── VehicleCard (multiple)
    │   │   │   └── EmptyState (conditional)
    │   │   │
    │   │   ├── SectionCard: Service Type
    │   │   │   ├── SectionHeader
    │   │   │   ├── ServiceGrid
    │   │   │   │   └── ServiceCard (6 types)
    │   │   │   └── NotesSection (conditional)
    │   │   │       └── TextArea
    │   │   │
    │   │   └── StepActions (Previous + Next)
    │   │
    │   ├── Step 2: Date & Time
    │   │   ├── SectionCard: Date Selection
    │   │   │   ├── SectionHeader
    │   │   │   └── CalendarGrid
    │   │   │       └── DateCard (14 dates)
    │   │   │
    │   │   ├── SectionCard: Time Selection (conditional)
    │   │   │   ├── SectionHeader
    │   │   │   └── TimeslotGrid
    │   │   │       └── TimeslotButton (19 slots)
    │   │   │
    │   │   └── StepActions
    │   │
    │   ├── Step 3: Workshop Selection
    │   │   ├── SectionCard
    │   │   │   ├── SectionHeader
    │   │   │   └── WorkshopList
    │   │   │       └── WorkshopCard (3 workshops)
    │   │   │           ├── Header (name + rating + badge)
    │   │   │           ├── Details (distance + phone + address)
    │   │   │           └── Services (tags)
    │   │   │
    │   │   └── StepActions
    │   │
    │   ├── Step 4: Review & Confirm
    │   │   ├── SectionCard
    │   │   │   ├── SectionHeader
    │   │   │   ├── ReviewSection
    │   │   │   │   └── ReviewItem (4 items: vehicle, service, date, workshop)
    │   │   │   │       ├── Icon + Label
    │   │   │   │       ├── Value (main + subtext)
    │   │   │   │       └── EditButton
    │   │   │   └── PriceBreakdown
    │   │   │       ├── PriceItem (service fee)
    │   │   │       ├── PriceItem (tax)
    │   │   │       ├── Divider
    │   │   │       ├── PriceTotal
    │   │   │       └── PriceNote
    │   │   │
    │   │   └── StepActions
    │   │
    │   └── Step 5: Success
    │       ├── SuccessAnimation
    │       │   └── SuccessCircle (animated checkmark)
    │       ├── SuccessTitle
    │       ├── SuccessSubtitle
    │       ├── ConfirmationCard
    │       │   ├── ConfirmationNumber
    │       │   ├── ConfirmationDetails
    │       │   │   └── ConfirmationItem (3 items)
    │       │   └── ConfirmationInfo (blue notice)
    │       └── SuccessActions (2 buttons)
    │
    └── (No footer)
```

---

## 🎯 Icon Library

All icons use inline SVG with 2px stroke width.

### Common Icons (24x24)
```
📌 Location:   <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
📅 Calendar:   <rect + lines> (calendar grid)
⏰ Clock:      <circle + polyline> (clock face)
🚗 Car:        <path> (vehicle icon)
🔧 Tool:       <path> (wrench icon)
📞 Phone:      <path> (phone handset)
📍 Pin:        <circle> inside location path
✓ Checkmark:  <polyline points="20 6 9 17 4 12"/>
✕ Close:      <line x1 y1 x2 y2> (X shape)
⟩ Arrow:      <polyline points="9 18 15 12 9 6"/>
⭐ Star:       <path> (5-pointed star)
ℹ️ Info:       <circle + line> (i symbol)
```

### Icon Sizes by Context
- Header Icons: 24px
- Checkmarks: 16px (stepper), 28-32px (cards)
- Detail Icons: 16-18px (inline with text)
- Success Icon: 64px

---

## 🎬 Animation Showcase

### Entrance Animations
```
Header:     fadeIn    (0.6s, ease)
Cards:      slideUp   (0.6s, cubic-bezier)
Banner:     slideDown (0.4s, cubic-bezier)
```

### Interaction Animations
```
Hover:      transform translateY(-4px) + shadow (0.3s)
Click:      transform translateY(-2px) (0.15s)
Selection:  scaleIn (0.3s, cubic-bezier)
```

### State Animations
```
Active Step:      pulse (2s, infinite loop)
Success Circle:   successPop (0.6s, cubic-bezier)
Success Check:    checkDraw (0.5s, 0.3s delay)
Button Shine:     gradient sweep (0.5s on hover)
```

---

**Component Catalog Version**: 1.0.0  
**Last Updated**: Current Session  
**Status**: Complete Reference
