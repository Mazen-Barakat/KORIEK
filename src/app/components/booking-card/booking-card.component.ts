import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface BookingCardData {
  id: number;
  time: string;
  customer: string;
  service: string;
  status?: string;
  priority?: 'high' | 'medium' | 'low';
  vehicle?: string;
  estimatedDuration?: string;
  notes?: string;
}

@Component({
  selector: 'app-booking-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './booking-card.component.html',
  styleUrls: ['./booking-card.component.css']
})
export class BookingCardComponent {
  @Input() booking!: BookingCardData;
  @Input() compact: boolean = false;
  @Output() viewDetails = new EventEmitter<number>();

  onViewDetails(): void {
    this.viewDetails.emit(this.booking?.id);
  }

  getStatusClass(): string {
    if (!this.booking?.status) return 'status-unknown';
    const s = this.booking.status.toLowerCase();
    if (s.includes('pending')) return 'status-pending';
    if (s.includes('accept') || s.includes('confirmed') || s.includes('completed')) return 'status-accepted';
    if (s.includes('reject') || s.includes('declined') || s.includes('cancel')) return 'status-rejected';
    if (s.includes('progress') || s.includes('ongoing')) return 'status-progress';
    return 'status-unknown';
  }

  getStatusLabel(): string {
    if (!this.booking?.status) return 'Unknown';
    return this.booking.status.charAt(0).toUpperCase() + this.booking.status.slice(1).toLowerCase();
  }

  getPriorityClass(): string {
    if (!this.booking?.priority) return '';
    return `priority-${this.booking.priority}`;
  }

  getShortCustomerName(): string {
    if (!this.booking?.customer) return '??';
    const parts = this.booking.customer.trim().split(' ');
    if (parts.length >= 2) {
      return parts[0][0] + parts[1][0];
    }
    return this.booking.customer.substring(0, 2).toUpperCase();
  }
}
