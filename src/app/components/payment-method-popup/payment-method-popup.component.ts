import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-payment-method-popup',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './payment-method-popup.component.html',
  styleUrls: ['./payment-method-popup.component.css']
})
export class PaymentMethodPopupComponent {
  @Output() paymentMethodSelected = new EventEmitter<string>();
  @Output() closePopup = new EventEmitter<void>();

  selectedMethod: string | null = null;

  selectMethod(method: string): void {
    this.selectedMethod = method;
  }

  confirmSelection(): void {
    if (this.selectedMethod) {
      this.paymentMethodSelected.emit(this.selectedMethod);
    }
  }

  close(): void {
    this.closePopup.emit();
  }
}
