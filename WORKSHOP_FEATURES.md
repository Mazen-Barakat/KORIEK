# Workshop Management System - Features Documentation

## 🎯 Overview

Complete workshop management solution with financial tracking and real-time notifications.

---

## 💰 Wallet & Financials Module

### Features

#### 1. **Balance Overview**
- **Available Balance**: Ready to withdraw funds
- **Pending Balance**: Funds in processing (post-service completion)
- **Next Payout**: Scheduled automatic payouts

#### 2. **Transaction History**
- Complete financial activity log
- Filter by type: All / Credits / Debits
- Transaction categories:
  - 🔧 Booking (service payments)
  - 💸 Payout (withdrawals)
  - ↩️ Refund (customer refunds)
  - 📋 Fee (platform fees)
  - ⚖️ Adjustment (manual corrections)

#### 3. **Payout Management**
- View scheduled payouts
- Manual payout requests
- Payout history tracking
- Bank account integration

#### 4. **Financial Stats**
- Total earnings (lifetime)
- Monthly revenue with trend
- Growth rate tracking
- Revenue change percentage

### Access
- Route: `/workshop/wallet`
- Navigation: Dashboard → Quick Actions → Wallet & Payments
- Auth Required: ✅

### Models
```typescript
// wallet.model.ts
- Transaction
- PayoutSchedule
- WalletSummary
- NotificationPreference
- Notification
```

### Service
```typescript
// wallet.service.ts
- getWalletSummary()
- getTransactions()
- getPayoutSchedule()
- requestPayout(amount)
- getTransactionsByDateRange()
- getTransactionsByCategory()
```

---

## 🔔 Auto Notification System

### Features

#### 1. **Real-Time Notifications**
- Automatic notification generation
- Browser notification support
- Visual unread badge
- Bell ring animation for new items

#### 2. **Notification Types**
- 📋 **Booking**: New requests, updates
- 💰 **Payment**: Transactions, payouts
- ⭐ **Review**: Customer feedback
- ⚙️ **System**: Platform updates
- ⚠️ **Alert**: Urgent items

#### 3. **Priority Levels**
- **High**: Red accent (urgent actions)
- **Medium**: Orange accent (important)
- **Low**: Gray accent (informational)

#### 4. **Notification Actions**
- Click to navigate to related page
- Mark individual as read
- Mark all as read
- Delete notifications
- Action buttons (View Request, View Transaction, etc.)

#### 5. **Auto-Simulation**
- New notifications every 2 minutes (30% probability)
- Realistic timing and content
- Automatic unread count updates

### Components

#### NotificationPanelComponent
```typescript
// Location: src/app/components/notification-panel/
- Bell icon with unread badge
- Dropdown panel with notifications
- Filter and manage notifications
- Browser notification integration
```

#### NotificationService
```typescript
// notification.service.ts
Features:
- getNotifications()
- getUnreadCount()
- getPreferences()
- markAsRead()
- markAllAsRead()
- deleteNotification()
- addNotification()
- startAutoNotificationSimulation()
```

### Browser Notifications

**Permission Request**
- Automatic on service initialization
- Respects user preferences
- Shows native OS notifications

**Implementation**
```typescript
requestNotificationPermission()
showBrowserNotification()
```

---

## 🎨 Shared UI Components

### 1. ActionBadgeComponent
Smart action buttons with priority-based styling

**Props:**
- `count: number` - Item count
- `label: string` - Action label
- `priority: 'high' | 'medium' | 'low'`
- `icon?: string` - Optional emoji/icon
- `(clicked)` - Click event

**Features:**
- Auto-disable when count = 0
- Urgent pulse animation for high priority
- Gradient backgrounds
- Hover effects with arrow

**Usage:**
```html
<app-action-badge
  [count]="5"
  label="New Requests"
  priority="high"
  icon="📋"
  (clicked)="handleClick()">
</app-action-badge>
```

### 2. StatCardComponent
Metric display cards with trend indicators

**Props:**
- `icon: string`
- `label: string`
- `value: string | number`
- `trend?: number` - Percentage change
- `variant: 'primary' | 'success' | 'warning' | 'info'`
- `loading: boolean`

**Features:**
- Trend arrows (up/down)
- Loading skeleton
- Accent border
- Hover animations

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

### 3. SectionHeaderComponent
Consistent section headers

**Props:**
- `title: string`
- `subtitle?: string`
- `icon?: string`
- `badge?: string | number`
- `badgeVariant: 'primary' | 'success' | 'warning' | 'info'`

**Usage:**
```html
<app-section-header
  title="Transaction History"
  subtitle="All your financial transactions"
  icon="📜"
  [badge]="10"
  badgeVariant="primary">
</app-section-header>
```

---

## 🗺️ Routes

```typescript
// Workshop Routes
/workshop/dashboard       → Workshop Dashboard
/workshop/job-board      → Job Management
/workshop/wallet         → Financials & Wallet
/workshop-profile/:id    → View Profile
/workshop-profile-edit   → Edit Profile
```

---

## 🔐 Authentication

All workshop routes protected by `authGuard`

```typescript
canActivate: [authGuard]
```

---

## 📊 Data Flow

### Wallet Module
```
WalletComponent
  ↓
WalletService (mock data)
  ↓
Observable<WalletSummary>
Observable<Transaction[]>
Observable<PayoutSchedule[]>
```

### Notification Module
```
NotificationPanelComponent
  ↓
NotificationService
  ↓
- Auto-simulation (interval 2min)
- Browser Notifications
- Real-time unread count
  ↓
Observable<Notification[]>
Observable<number> (unread count)
```

---

## 🎨 Design System

### Colors
- Primary: `#ef4444` (Red)
- Success: `#10b981` (Green)
- Warning: `#f59e0b` (Orange)
- Info: `#3b82f6` (Blue)
- Neutral: `#6b7280` (Gray)

### Spacing
- Base: `8px`
- Gaps: `8px, 12px, 16px, 20px, 24px, 32px`

### Border Radius
- Small: `6px - 8px`
- Medium: `10px - 12px`
- Large: `16px`
- Pill: `20px`

### Transitions
- Standard: `0.3s ease`
- Fast: `0.2s ease`

---

## 🚀 Future Enhancements

### Wallet
- [ ] Real bank account integration
- [ ] CSV/PDF export for statements
- [ ] Tax document generation
- [ ] Custom payout schedules
- [ ] Multi-currency support

### Notifications
- [ ] Email notification integration
- [ ] SMS notifications
- [ ] Webhook support
- [ ] Custom notification rules
- [ ] Notification history archive
- [ ] Do Not Disturb mode
- [ ] Scheduled notifications

### Shared Components
- [ ] Dark mode support
- [ ] Icon library integration (FontAwesome/Material)
- [ ] Animation variants
- [ ] Tooltip components
- [ ] Modal components
- [ ] Toast notifications
- [ ] Loading states library

---

## 📝 Usage Examples

### Adding a New Notification Programmatically

```typescript
this.notificationService.addNotification({
  type: 'booking',
  title: 'New Booking Request',
  message: 'Customer requested service',
  priority: 'high',
  actionUrl: '/workshop/job-board',
  actionLabel: 'View Request'
});
```

### Requesting a Payout

```typescript
this.walletService.requestPayout(amount).subscribe({
  next: (response) => {
    // Show success message
  },
  error: (error) => {
    // Show error message
  }
});
```

### Using Shared Components

```typescript
// Import in component
import { 
  ActionBadgeComponent,
  StatCardComponent,
  SectionHeaderComponent 
} from '../shared';

// Add to imports array
imports: [
  CommonModule,
  ActionBadgeComponent,
  StatCardComponent,
  SectionHeaderComponent
]
```

---

## 🛠️ Technical Stack

- **Framework**: Angular 17+ (Standalone Components)
- **State Management**: RxJS BehaviorSubjects
- **Styling**: Pure CSS with CSS Variables
- **Icons**: SVG + Emojis
- **Auth**: JWT with Auth Guard
- **Routing**: Lazy-loaded routes

---

## 📦 File Structure

```
src/app/
├── components/
│   ├── wallet/                    # Wallet & Financials
│   ├── notification-panel/        # Notification System
│   ├── workshop-dashboard/        # Main Dashboard
│   └── shared/                    # Reusable Components
│       ├── action-badge/
│       ├── stat-card/
│       ├── section-header/
│       ├── index.ts              # Barrel exports
│       └── README.md             # Component docs
├── services/
│   ├── wallet.service.ts
│   ├── notification.service.ts
│   ├── booking.service.ts
│   └── auth.service.ts
├── models/
│   ├── wallet.model.ts
│   └── booking.model.ts
└── guards/
    └── auth.guard.ts
```

---

## ✅ Testing Checklist

### Wallet Module
- [ ] Balance cards display correctly
- [ ] Transactions filter works
- [ ] Payout request functional
- [ ] Date formatting correct
- [ ] Currency formatting correct
- [ ] Transaction details clickable

### Notification System
- [ ] Bell badge shows unread count
- [ ] Panel opens/closes properly
- [ ] Mark as read works
- [ ] Mark all as read works
- [ ] Delete notification works
- [ ] Navigation from notification works
- [ ] Auto-simulation generates notifications
- [ ] Browser notifications appear (with permission)

### Shared Components
- [ ] ActionBadge priority styling correct
- [ ] StatCard trends display properly
- [ ] SectionHeader badge variants work
- [ ] All hover effects smooth
- [ ] Loading states functional
- [ ] Icons render correctly

---

**Version**: 1.0.0  
**Last Updated**: November 22, 2025  
**Maintained by**: Workshop Management Team
