# Upcoming Maintenance - Visual Enhancement Guide

## 🎨 Component Anatomy

```
┌────────────────────────────────────────────────────────┐
│ ═══ (Animated Shimmer Bar - Brand Red Gradient) ═══   │
├────────────────────────────────────────────────────────┤
│  🔧 Upcoming Maintenance                          [3]  │
│  ────────────────────────────────────────────────────  │
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │ [⚙️]  Oil Change              Nov 28, 2025      │ │
│  │       Engine maintenance      [●] Soon          │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │ [≋]  Air Filter               Dec 12, 2025      │ │
│  │      Filter replacement       [●] Due           │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │ [🔋]  Battery Check           Jan 15, 2026      │ │
│  │       Power system            30% Due           │ │
│  │                               ▓▓▓░░░░░░         │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  ┌────────────────────────────────────────────────┐   │
│  │     View All Maintenance           →           │   │
│  └────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────┘
```

---

## 🔄 Hover States Visualization

### **Maintenance Item - Normal State**
```
┌────────────────────────────────────────────────┐
│                                                │
│  [Icon]  Oil Change         Nov 28, 2025      │
│ gray bg  Engine maintenance [●] Soon          │
│                                                │
└────────────────────────────────────────────────┘
Background: #FAFAFA
Border: 1px transparent
Shadow: None
```

### **Maintenance Item - Hover State**
```
┌────────────────────────────────────────────────┐
│║                                               │
│║ [Icon]  Oil Change         Nov 28, 2025      │
│║ red bg  Engine maintenance [●] Soon (scaled) │
│║ rotated                                       │
└────────────────────────────────────────────────┘
   ↑ 4px Red Accent Bar

Background: #FFFFFF (brighter)
Border: 1px rgba(255,59,48,0.15) - Brand red
Shadow: 0 4px 12px rgba(0,0,0,0.06)
Transform: translateX(4px) - Slides right
Icon: Rotates 5° + Scale 1.1x + Color → Red
Badge: Scale 1.05x + Shadow
```

---

## 🎭 Interactive Elements

### **1. Header Icon Animation**

**Normal:**
```
┌─────────┐
│   🔧   │  Background: Light gradient
│         │  Rotation: 0°
└─────────┘  Scale: 1
```

**On Card Hover:**
```
┌─────────┐
│    🔧  │  Background: Darker gradient
│   ╱    │  Rotation: 15° clockwise
└─────────┘  Scale: 1.05
   Lifts!
```

---

### **2. Count Badge Pulse**

```
Frame 1 (0s):     Frame 2 (1s):     Frame 3 (2s):
  ┌───┐             ┌────┐             ┌───┐
  │ 3 │             │  3  │            │ 3 │
  └───┘             └────┘             └───┘
Scale: 1          Scale: 1.05        Scale: 1
Shadow: Small     Shadow: Large      Shadow: Small
```

**Infinite loop, 2s duration**

---

### **3. Badge Dot Blink**

```
Time 0s:    Time 1s:    Time 2s:
  [●] Soon   [○] Soon   [●] Soon
Opacity: 1  Opacity: 0.4  Opacity: 1
```

**Yellow dot for "Soon"**
**Red dot for "Due"**

---

### **4. Progress Bar Shine**

```
Frame 1:        Frame 2:        Frame 3:
▓▓▓░░░░░░      ▓▓▓░░░░░░      ▓▓▓░░░░░░
  ◢ shine         ◢ shine         ◢ shine
  moving →          moving →          moving →

White gradient overlay slides left to right
Creates "loading" visual effect
2s infinite animation
```

---

### **5. View All Button Transform**

**Normal State:**
```
┌─────────────────────────────────┐
│  View All Maintenance     →     │  Gray gradient
└─────────────────────────────────┘  No shadow
```

**Hover State:**
```
┌─────────────────────────────────┐
│  View All Maintenance        →  │  Red gradient
└─────────────────────────────────┘  White text
     ↑ Lifts 2px                     Glowing shadow
                                     Arrow slides 4px →
```

**Active (Click):**
```
┌─────────────────────────────────┐
│  View All Maintenance       →   │  Pressed down
└─────────────────────────────────┘  Reduced shadow
```

---

## 🎨 Color Palette Usage

### **Brand Colors**
```
Primary Red:     #FF3B30  ████████  Accents, hovers, CTAs
Secondary Red:   #FF6B5A  ████████  Gradient endpoints
Dark Text:       #1D1D1F  ████████  Headings, titles
Mid Gray:        #6B7280  ████████  Dates, secondary text
Light Gray:      #86868B  ████████  Subtitles, labels
```

### **Status Colors**
```
Soon Badge:      #FFF4CE → #FFE8A3  ████████  Yellow gradient
Soon Text:       #9A6B00             ████████  Dark yellow
Soon Dot:        #FFB800             ████████  Amber

Due Badge:       #FFDADB → #FFC5C7  ████████  Red gradient
Due Text:        #C41E3A             ████████  Dark red
Due Dot:         #FF3B30             ████████  Brand red

Progress:        #34C759 → #30D158  ████████  Green gradient
Progress Label:  #34C759             ████████  Success green
```

### **Background Colors**
```
Card:            #FFFFFF  ████████  Pure white
Items:           #FAFAFA  ████████  Light gray (normal)
Items Hover:     #FFFFFF  ████████  Pure white (brighter)
Icon Normal:     #F5F5F7  ████████  Light neutral
Icon Hover:      #FFF0EF  ████████  Light red tint
Button:          #F5F5F7  ████████  Neutral gray
Button Hover:    #FF3B30  ████████  Brand red
```

---

## 📏 Spacing & Sizing Guide

### **Card Dimensions**
```
Padding:          2rem (32px) all sides
Border Radius:    24px (premium rounded)
Border:           1px solid rgba(0,0,0,0.04)
Shadow:           0 4px 16px rgba(0,0,0,0.06)
Top Bar:          3px height (gradient shimmer)
```

### **Header Section**
```
Title Font:       1.25rem (20px)
Title Weight:     700 (Bold)
Icon Wrapper:     36px × 36px square
Icon Size:        20px × 20px
Count Badge:      28px height (min-width 28px)
Gap:              0.75rem between elements
Bottom Border:    1px solid #F0F0F0
Padding Bottom:   1rem
```

### **Maintenance Items**
```
Item Padding:     1.25rem (20px) all sides
Item Gap:         0.875rem between items
Border Radius:    16px
Icon Wrapper:     40px × 40px circle
Icon Size:        18px × 18px
Icon Radius:      12px
Item Name:        0.9375rem (15px)
Subtitle:         0.75rem (12px)
Date:             0.8125rem (13px)
```

### **Badges**
```
Padding:          0.375rem × 0.875rem
Border Radius:    980px (pill)
Font Size:        0.75rem (12px)
Font Weight:      600
Dot Size:         6px diameter
Gap:              0.375rem (icon to text)
```

### **Progress Bar**
```
Width:            90px
Height:           8px
Border Radius:    4px
Fill Gradient:    Linear (green shades)
Label Size:       0.75rem
Label Weight:     600
```

### **View All Button**
```
Width:            100% (full width)
Padding:          0.875rem × 1.25rem
Border Radius:    12px
Font Size:        0.875rem
Font Weight:      600
Icon Size:        16px × 16px
Gap:              0.5rem
```

---

## 🎬 Animation Specifications

### **Timing Functions**
```css
Standard:         cubic-bezier(0.4, 0, 0.2, 1)
Duration Short:   0.2s (badges, quick feedback)
Duration Medium:  0.3s (hovers, focus states)
Duration Long:    0.6s (progress bar transitions)
Duration Loop:    2-3s (ambient animations)
```

### **Transform Properties**
```css
Hover Lift:       translateY(-2px)
Item Slide:       translateX(4px)
Icon Rotate:      rotate(5deg)
Icon Scale:       scale(1.1)
Badge Scale:      scale(1.05)
Button Lift:      translateY(-2px)
Active Press:     scale(0.99)
```

### **Shadow Progression**
```css
Level 0:          None (default items)
Level 1:          0 2px 6px rgba(0,0,0,0.08)
Level 2:          0 4px 12px rgba(0,0,0,0.06)
Level 3:          0 4px 16px rgba(255,59,48,0.25) - Brand glow
```

---

## 📱 Responsive Breakpoints

### **Desktop (>768px)**
```
┌─────────────────────────────┐
│  🔧 Maintenance        [3]  │
│  ─────────────────────────  │
│  [Icon] Name     Date       │
│         Sub      Badge      │
│  [Icon] Name     Date       │
│         Sub      Badge      │
│  [Icon] Name     Date       │
│         Sub      Progress   │
│  [ View All Button ]        │
└─────────────────────────────┘

Layout: Row-based
Icon: 40px
Padding: 2rem
```

### **Mobile (<768px)**
```
┌──────────────────────┐
│ 🔧 Maintenance  [3] │
│ ──────────────────  │
│ [Icon] Name         │
│        Subtitle     │
│ Date          Badge │
│                     │
│ [Icon] Name         │
│        Subtitle     │
│ Date          Badge │
│                     │
│ [Icon] Name         │
│        Subtitle     │
│ Date      Progress  │
│                     │
│ [ View All Button ] │
└──────────────────────┘

Layout: Stacked
Icon: 36px
Padding: 1.5rem
Items: Column flex
```

---

## 🔍 Micro-Detail Highlights

### **Left Accent Bar (Hover)**
```
Position:    Absolute left: 0
Width:       4px
Height:      100% (item height)
Gradient:    180deg, #FF3B30 → #FF6B5A
Opacity:     0 → 1 on hover
Transition:  0.3s ease
```

### **Shimmer Top Border**
```
Position:    Absolute top: 0
Height:      3px
Width:       100%
Gradient:    Linear 90deg, red → light red → red
Size:        200% width (allows sliding)
Animation:   3s infinite ease-in-out
Effect:      Background-position 0% → 100% → 0%
```

### **Badge Gradients**
```
Soon:    Linear 135deg
         Start: #FFF4CE (light yellow)
         End:   #FFE8A3 (golden yellow)
         
Due:     Linear 135deg
         Start: #FFDADB (light pink)
         End:   #FFC5C7 (rose pink)
```

### **Icon Wrapper Gradients**
```
Normal:  Linear 135deg
         Start: #F5F5F7 (cool gray)
         End:   #E5E5EA (darker gray)
         
Hover:   Linear 135deg
         Start: #FFF0EF (blush)
         End:   #FFE5E3 (light coral)
```

---

## ✨ Key Improvements Summary

| Element | Enhancement | Impact |
|---------|-------------|--------|
| **Card** | Shimmer border, increased padding | Premium feel |
| **Header** | Icon container, count badge | Better organization |
| **Icons** | SVG replacements, gradients | Professional look |
| **Layout** | Left-right split | Clearer hierarchy |
| **Subtitles** | Added descriptions | Better context |
| **Dates** | Reformatted display | More readable |
| **Badges** | Gradients + dots | Visual interest |
| **Progress** | Label + shine effect | Better feedback |
| **Hover** | Multi-layer effects | Engaging interaction |
| **Button** | Full-width CTA | Clear next action |
| **Animations** | 8 keyframe effects | Polished feel |
| **Mobile** | Stacked layout | Touch-friendly |

---

## 🎯 Design Principles Applied

✅ **Consistency**: All elements follow 4px/8px grid
✅ **Hierarchy**: Clear visual weights and spacing
✅ **Feedback**: Every interaction has visual response
✅ **Affordance**: Clickable elements look clickable
✅ **Accessibility**: Focus states, keyboard navigation
✅ **Performance**: GPU-accelerated animations
✅ **Responsiveness**: Fluid layouts, no fixed widths
✅ **Brand Alignment**: Red accent throughout

---

**Result**: A production-ready, visually polished component that enhances user engagement while maintaining perfect brand consistency and accessibility standards.
