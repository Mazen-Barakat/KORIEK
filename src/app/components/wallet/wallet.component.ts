import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { WalletService } from '../../services/wallet.service';
import { Transaction, PayoutSchedule, WalletSummary } from '../../models/wallet.model';
import { StatCardComponent } from '../shared/stat-card/stat-card.component';
import { SectionHeaderComponent } from '../shared/section-header/section-header.component';

@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [CommonModule, StatCardComponent, SectionHeaderComponent],
  templateUrl: './wallet.component.html',
  styleUrls: ['./wallet.component.css']
})
export class WalletComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  walletSummary: WalletSummary | null = null;
  transactions: Transaction[] = [];
  payoutSchedule: PayoutSchedule[] = [];
  
  selectedFilter: 'all' | 'credit' | 'debit' = 'all';
  selectedPeriod: 'week' | 'month' | 'year' = 'month';

  constructor(
    private walletService: WalletService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadWalletData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadWalletData(): void {
    this.walletService.getWalletSummary()
      .pipe(takeUntil(this.destroy$))
      .subscribe(summary => this.walletSummary = summary);

    this.walletService.getTransactions()
      .pipe(takeUntil(this.destroy$))
      .subscribe(transactions => this.transactions = transactions);

    this.walletService.getPayoutSchedule()
      .pipe(takeUntil(this.destroy$))
      .subscribe(schedule => this.payoutSchedule = schedule);
  }

  get filteredTransactions(): Transaction[] {
    if (this.selectedFilter === 'all') {
      return this.transactions;
    }
    return this.transactions.filter(txn => txn.type === this.selectedFilter);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  }

  formatShortDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric'
    }).format(new Date(date));
  }

  setFilter(filter: 'all' | 'credit' | 'debit'): void {
    this.selectedFilter = filter;
  }

  setPeriod(period: 'week' | 'month' | 'year'): void {
    this.selectedPeriod = period;
  }

  requestPayout(): void {
    if (this.walletSummary && this.walletSummary.availableBalance > 0) {
      this.walletService.requestPayout(this.walletSummary.availableBalance)
        .subscribe({
          next: (response) => {
            console.log('Payout requested:', response);
            // Show success message
          },
          error: (error) => {
            console.error('Payout failed:', error);
            // Show error message
          }
        });
    }
  }

  viewTransactionDetails(transaction: Transaction): void {
    console.log('View transaction:', transaction);
    // Navigate to transaction details or open modal
  }

  getTransactionIcon(transaction: Transaction): string {
    switch (transaction.category) {
      case 'booking': return '🔧';
      case 'payout': return '💸';
      case 'refund': return '↩️';
      case 'fee': return '📋';
      case 'adjustment': return '⚖️';
      default: return '💰';
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'completed': return 'status-completed';
      case 'pending': return 'status-pending';
      case 'failed': return 'status-failed';
      default: return '';
    }
  }

  downloadStatement(): void {
    console.log('Download statement for period:', this.selectedPeriod);
    // Implement PDF/CSV download
  }
}
