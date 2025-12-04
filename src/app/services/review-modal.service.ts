import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface ReviewModalData {
  bookingId: number;
  show: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ReviewModalService {
  private reviewModalSubject = new BehaviorSubject<ReviewModalData>({
    bookingId: 0,
    show: false,
  });

  public reviewModal$: Observable<ReviewModalData> = this.reviewModalSubject.asObservable();

  /**
   * Open the review modal for a specific booking
   */
  openReviewModal(bookingId: number): void {
    console.log(`📝 ReviewModalService.openReviewModal called with bookingId: ${bookingId}`);
    this.reviewModalSubject.next({ bookingId, show: true });
    console.log(`📝 Review modal state updated:`, { bookingId, show: true });
  }

  /**
   * Close the review modal
   */
  closeReviewModal(): void {
    this.reviewModalSubject.next({ bookingId: 0, show: false });
    console.log('📝 Closing review modal');
  }

  /**
   * Check if modal is currently open
   */
  isModalOpen(): boolean {
    return this.reviewModalSubject.value.show;
  }

  /**
   * Get current booking ID
   */
  getCurrentBookingId(): number {
    return this.reviewModalSubject.value.bookingId;
  }
}
