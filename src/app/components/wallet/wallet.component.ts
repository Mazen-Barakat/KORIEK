import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { WalletService } from '../../services/wallet.service';
import { WorkshopProfileService } from '../../services/workshop-profile.service';
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
  workshopProfileId: number = 0;

  constructor(
    private walletService: WalletService,
    private workshopProfileService: WorkshopProfileService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Fetch workshop profile first
    this.workshopProfileService.getMyWorkshopProfile()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const profile = response?.data || response;
          this.workshopProfileId = profile?.id || profile?.Id || 0;
          console.log('🏪 Workshop Profile ID:', this.workshopProfileId);

          if (this.workshopProfileId > 0) {
            this.loadWalletData();
          }
        },
        error: (err: any) => {
          console.error('❌ Error fetching workshop profile:', err);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadWalletData(): void {
    this.walletService.getWalletSummary()
      .pipe(takeUntil(this.destroy$))
      .subscribe(summary => this.walletSummary = summary);

    // Load real transactions from bookings - always on page load
    if (this.workshopProfileId > 0) {
      this.walletService.getTransactionsByWorkshop(this.workshopProfileId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (transactions) => {
            console.log('✅ Loaded transactions:', transactions.length);
            this.transactions = transactions;
            // Calculate dynamic growth rate from transactions
            this.calculateDynamicGrowthRate();
          },
          error: (err: any) => {
            console.error('❌ Error loading transactions:', err);
          }
        });
    }

    this.walletService.getPayoutSchedule()
      .pipe(takeUntil(this.destroy$))
      .subscribe(schedule => this.payoutSchedule = schedule);
  }

  /**
   * Calculate growth rate dynamically based on transaction history
   */
  private calculateDynamicGrowthRate(): void {
    if (!this.walletSummary || this.transactions.length === 0) {
      return;
    }

    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Get credit transactions for current month
    const currentMonthCredits = this.transactions
      .filter(txn => {
        const txnDate = new Date(txn.date);
        return txn.type === 'credit' &&
               txnDate >= currentMonth &&
               txnDate < new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
      })
      .reduce((sum, txn) => sum + txn.amount, 0);

    // Get credit transactions for previous month
    const previousMonthCredits = this.transactions
      .filter(txn => {
        const txnDate = new Date(txn.date);
        return txn.type === 'credit' &&
               txnDate >= previousMonth &&
               txnDate < currentMonth;
      })
      .reduce((sum, txn) => sum + txn.amount, 0);

    // Calculate growth rate
    if (previousMonthCredits > 0) {
      const growthRate = ((currentMonthCredits - previousMonthCredits) / previousMonthCredits) * 100;
      if (this.walletSummary) {
        this.walletSummary.revenueChange = Math.round(growthRate * 10) / 10; // Round to 1 decimal
      }
    }
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
    if (typeof window === 'undefined') return;

    // Load the logo image and convert to base64
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const base64Logo = canvas.toDataURL('image/png');

        // Create HTML content for PDF with the logo
        const content = this.generateStatementHTML(base64Logo);

        // Open print dialog which allows saving as PDF
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(content);
          printWindow.document.close();

          // Wait for content to load, then print
          printWindow.onload = () => {
            printWindow.print();
          };
        }
      }
    };
    img.onerror = () => {
      // Fallback if image fails to load
      const content = this.generateStatementHTML('');
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(content);
        printWindow.document.close();
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    };
    img.src = '/Assets/logo.png';
  }

  private generateStatementHTML(logoBase64: string): string {
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Wallet Statement - Koriek</title>
        <style>
          @media print {
            body { margin: 0; padding: 20px; }
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            max-width: 900px;
            margin: 0 auto;
            padding: 30px;
            background-color: #f9fafb;
          }
          .header {
            text-align: center;
            margin-bottom: 50px;
            padding-bottom: 35px;
            border-bottom: 4px solid #0f172a;
            background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
            padding: 50px 40px;
            border-radius: 12px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
          }
          .logo-container {
            display: flex;
            justify-content: center;
            margin-bottom: 25px;
            background: linear-gradient(135deg, #f8f9fa 0%, #f0f4f8 100%);
            padding: 20px;
            border-radius: 16px;
            border: 2px solid #e5e7eb;
          }
          .logo {
            max-width: 180px;
            max-height: 160px;
            object-fit: contain;
            filter: drop-shadow(0 4px 12px rgba(15, 23, 42, 0.15));
          }
          .company-name {
            font-size: 48px;
            font-weight: 900;
            background: linear-gradient(135deg, #0f172a 0%, #1e40af 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin: 15px 0;
            letter-spacing: 2px;
          }
          .statement-subtitle {
            font-size: 24px;
            color: #6b7280;
            margin: 15px 0;
            font-weight: 600;
          }
          .date {
            color: #9ca3af;
            margin-top: 12px;
            font-size: 14px;
            font-weight: 500;
          }
          .divider {
            width: 80px;
            height: 3px;
            background: #0f172a;
            margin: 20px auto 0;
            border-radius: 2px;
          }
          .summary-section {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 25px;
            margin: 40px 0;
          }
          .summary-card {
            background: white;
            border: 2px solid #e5e7eb;
            border-radius: 12px;
            padding: 30px 20px;
            text-align: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            transition: all 0.3s ease;
          }
          .summary-card:hover {
            border-color: #0f172a;
            box-shadow: 0 4px 16px rgba(15,23,42,0.1);
            transform: translateY(-2px);
          }
          .summary-label {
            font-size: 11px;
            color: #6b7280;
            text-transform: uppercase;
            margin-bottom: 12px;
            font-weight: 700;
            letter-spacing: 1px;
          }
          .summary-value {
            font-size: 32px;
            font-weight: 800;
            color: #0f172a;
            margin: 10px 0;
          }
          .transactions-section {
            background: white;
            border-radius: 12px;
            padding: 40px;
            margin-top: 40px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          }
          .section-title {
            font-size: 22px;
            font-weight: 800;
            margin-bottom: 30px;
            color: #0f172a;
            padding-bottom: 15px;
            border-bottom: 2px solid #e5e7eb;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th {
            background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
            padding: 16px 12px;
            text-align: left;
            font-weight: 700;
            border-bottom: 3px solid #0f172a;
            color: #1f2937;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          td {
            padding: 14px 12px;
            border-bottom: 1px solid #f3f4f6;
            font-size: 13px;
          }
          tr:hover {
            background-color: #f9fafb;
          }
          .amount-credit {
            color: #10b981;
            font-weight: 700;
          }
          .amount-debit {
            color: #ef4444;
            font-weight: 700;
          }
          .footer {
            margin-top: 60px;
            text-align: center;
            color: #6b7280;
            font-size: 12px;
            border-top: 2px solid #e5e7eb;
            padding-top: 25px;
            background: white;
            padding: 25px;
            border-radius: 12px;
            margin-left: 0;
            margin-right: 0;
          }
          .footer p {
            margin: 5px 0;
          }
          .footer strong {
            color: #0f172a;
            font-weight: 700;
          }
        </style>
      </head>
      <body>
        <div class="header">
          ${logoBase64 ? `<div class="logo-container">
            <img src="${logoBase64}" alt="KORIEK Logo" class="logo">
          </div>` : ''}
          <div class="company-name">KORIEK</div>
          <div class="statement-subtitle">Wallet Statement</div>
          <div class="date">${currentDate}</div>
          <div class="divider"></div>
        </div>

        <div class="summary-section">
          <div class="summary-card">
            <div class="summary-label">Available Balance</div>
            <div class="summary-value">${this.walletSummary ? this.formatCurrency(this.walletSummary.availableBalance) : '$0.00'}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Pending Balance</div>
            <div class="summary-value">${this.walletSummary ? this.formatCurrency(this.walletSummary.pendingBalance) : '$0.00'}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Total Earnings</div>
            <div class="summary-value">${this.walletSummary ? this.formatCurrency(this.walletSummary.totalEarnings) : '$0.00'}</div>
          </div>
        </div>

        <div class="transactions-section">
          <div class="section-title">Transaction History</div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Customer</th>
                <th>Status</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${this.filteredTransactions.map(txn => `
                <tr>
                  <td>${this.formatDate(txn.date)}</td>
                  <td>${txn.description}</td>
                  <td>${txn.customerName || '-'}</td>
                  <td>${txn.status}</td>
                  <td style="text-align: right;" class="${txn.type === 'credit' ? 'amount-credit' : 'amount-debit'}">
                    ${txn.type === 'credit' ? '+' : '-'}${this.formatCurrency(txn.amount)}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="footer">
          <p><strong>KORIEK</strong> - Auto Service Management Platform</p>
          <p>This is an automated statement. For questions, please contact support.</p>
        </div>
      </body>
      </html>
    `;
  }
}
