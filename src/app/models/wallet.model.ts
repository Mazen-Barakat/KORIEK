export interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  date: Date;
  status: 'completed' | 'pending' | 'failed';
  category: 'booking' | 'payout' | 'refund' | 'fee' | 'adjustment';
  reference?: string;
  customerName?: string;
}

export interface PayoutSchedule {
  id: string;
  amount: number;
  scheduledDate: Date;
  status: 'scheduled' | 'processing' | 'completed' | 'failed';
  bankAccount: string;
}

export interface WalletSummary {
  availableBalance: number;
  pendingBalance: number;
  totalEarnings: number;
  monthlyRevenue: number;
  revenueChange: number;
  nextPayoutAmount: number;
  nextPayoutDate: Date;
}

export interface NotificationPreference {
  id: string;
  type: 'payment' | 'booking' | 'review' | 'system';
  enabled: boolean;
  email: boolean;
  push: boolean;
  sms: boolean;
}

export interface AppNotification {
  id: string;
  type: 'payment' | 'booking' | 'review' | 'system' | 'alert';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  priority: 'high' | 'medium' | 'low';
  actionUrl?: string;
  actionLabel?: string;
  data?: any;
}
