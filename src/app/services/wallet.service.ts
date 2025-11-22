import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Transaction, PayoutSchedule, WalletSummary } from '../models/wallet.model';

@Injectable({
  providedIn: 'root'
})
export class WalletService {
  private walletSummarySubject = new BehaviorSubject<WalletSummary>({
    availableBalance: 12450.75,
    pendingBalance: 3200.00,
    totalEarnings: 45678.50,
    monthlyRevenue: 15250.00,
    revenueChange: 12.5,
    nextPayoutAmount: 8500.00,
    nextPayoutDate: new Date(2025, 10, 25)
  });

  private transactionsSubject = new BehaviorSubject<Transaction[]>([
    {
      id: 'txn-001',
      type: 'credit',
      amount: 450.00,
      description: 'Oil Change & Filter - Toyota Camry',
      date: new Date(2025, 10, 21, 14, 30),
      status: 'completed',
      category: 'booking',
      customerName: 'John Smith'
    },
    {
      id: 'txn-002',
      type: 'credit',
      amount: 1250.00,
      description: 'Brake System Repair - Honda Accord',
      date: new Date(2025, 10, 20, 10, 15),
      status: 'completed',
      category: 'booking',
      customerName: 'Sarah Johnson'
    },
    {
      id: 'txn-003',
      type: 'debit',
      amount: 8500.00,
      description: 'Weekly Payout',
      date: new Date(2025, 10, 18, 9, 0),
      status: 'completed',
      category: 'payout',
      reference: 'PAY-2025-1118'
    },
    {
      id: 'txn-004',
      type: 'credit',
      amount: 850.00,
      description: 'Tire Replacement - BMW X5',
      date: new Date(2025, 10, 19, 16, 45),
      status: 'completed',
      category: 'booking',
      customerName: 'Mike Wilson'
    },
    {
      id: 'txn-005',
      type: 'debit',
      amount: 125.00,
      description: 'Platform Fee',
      date: new Date(2025, 10, 21, 0, 0),
      status: 'completed',
      category: 'fee'
    },
    {
      id: 'txn-006',
      type: 'credit',
      amount: 650.00,
      description: 'Engine Diagnostic - Ford F-150',
      date: new Date(2025, 10, 17, 11, 20),
      status: 'pending',
      category: 'booking',
      customerName: 'Emily Davis'
    }
  ]);

  private payoutScheduleSubject = new BehaviorSubject<PayoutSchedule[]>([
    {
      id: 'payout-001',
      amount: 8500.00,
      scheduledDate: new Date(2025, 10, 25),
      status: 'scheduled',
      bankAccount: '****4532'
    },
    {
      id: 'payout-002',
      amount: 7200.00,
      scheduledDate: new Date(2025, 10, 18),
      status: 'completed',
      bankAccount: '****4532'
    }
  ]);

  constructor() {}

  getWalletSummary(): Observable<WalletSummary> {
    return this.walletSummarySubject.asObservable();
  }

  getTransactions(): Observable<Transaction[]> {
    return this.transactionsSubject.asObservable();
  }

  getPayoutSchedule(): Observable<PayoutSchedule[]> {
    return this.payoutScheduleSubject.asObservable();
  }

  requestPayout(amount: number): Observable<any> {
    // Mock implementation
    return new Observable(observer => {
      setTimeout(() => {
        observer.next({ success: true, message: 'Payout request submitted' });
        observer.complete();
      }, 1000);
    });
  }

  getTransactionsByDateRange(startDate: Date, endDate: Date): Transaction[] {
    return this.transactionsSubject.value.filter(txn => 
      txn.date >= startDate && txn.date <= endDate
    );
  }

  getTransactionsByCategory(category: string): Transaction[] {
    return this.transactionsSubject.value.filter(txn => txn.category === category);
  }
}
