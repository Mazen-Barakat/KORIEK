import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaymentService } from '../../services/payment.service';

@Component({
  selector: 'app-pay-now-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      class="pay-now-btn"
      [class.pulse]="pulse"
      (click)="triggerPayment()"
      *ngIf="showButton"
    >
      <span class="btn-icon">💳</span>
      <span class="btn-text">{{ buttonText }}</span>
      <span class="btn-arrow">→</span>
    </button>
  `,
  styles: [`
    .pay-now-btn {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 12px 24px;
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: white;
      border: none;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
      position: relative;
      overflow: hidden;
    }

    .pay-now-btn::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
      transition: left 0.5s;
    }

    .pay-now-btn:hover::before {
      left: 100%;
    }

    .pay-now-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(239, 68, 68, 0.4);
    }

    .pay-now-btn.pulse {
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% {
        box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
      }
      50% {
        box-shadow: 0 4px 20px rgba(239, 68, 68, 0.6);
      }
    }

    .btn-icon {
      font-size: 20px;
    }

    .btn-text {
      position: relative;
      z-index: 1;
    }

    .btn-arrow {
      font-size: 18px;
      transition: transform 0.3s;
    }

    .pay-now-btn:hover .btn-arrow {
      transform: translateX(4px);
    }
  `]
})
export class PayNowButtonComponent {
  @Input() bookingId!: number;
  @Input() totalAmount!: number;
  @Input() paymentMethod: string = '';
  @Input() paymentStatus: string = '';
  @Input() pulse: boolean = true;
  @Input() buttonText: string = 'Pay Now';

  constructor(private paymentService: PaymentService) {}

  get showButton(): boolean {
    const isCreditCard =
      this.paymentMethod === 'CreditCard' ||
      this.paymentMethod === 'Credit Card' ||
      this.paymentMethod === '1';

    const isUnpaid =
      this.paymentStatus === 'Unpaid' ||
      this.paymentStatus === 'Pending' ||
      !this.paymentStatus;

    return isCreditCard && isUnpaid;
  }

  triggerPayment() {
    this.paymentService.startPaymentFlow(this.bookingId, this.totalAmount);
  }
}
