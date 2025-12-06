import { Component, signal, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from './components/header/header.component';
import { ToastContainerComponent } from './components/shared/toast-container/toast-container.component';
import { ReviewModalComponent } from './components/review-modal/review-modal.component';
import { AuthService } from './services/auth.service';
import { SignalRNotificationService } from './services/signalr-notification.service';
import { ReviewModalService } from './services/review-modal.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, HeaderComponent, ToastContainerComponent, ReviewModalComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('Korik');
  private authService = inject(AuthService);
  private signalRService = inject(SignalRNotificationService);
  private reviewModalService = inject(ReviewModalService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  // Review modal state
  showReviewModal = false;
  reviewBookingId = 0;

  ngOnInit(): void {
    this.initializeAuth();
    this.initializeSignalR();
    this.initializeReviewModal();

    // Make this component available for debugging
    if (typeof window !== 'undefined') {
      (window as any)['app'] = this;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.signalRService.stopConnection();
  }

  private initializeAuth(): void {
    // Check if user is authenticated
    if (this.authService.isAuthenticated()) {
      // Check if token is expired
      if (this.authService.isTokenExpired()) {
        // If Remember Me is not enabled, logout immediately
        if (!this.authService.getRememberMe()) {
          console.log('Token expired on app load without Remember Me - logging out');
          this.authService.logout('expired');
          return;
        }

        // If Remember Me is enabled, check if refresh token is expired
        if (this.authService.isRefreshTokenExpired()) {
          console.log('Refresh token expired on app load - logging out');
          this.authService.logout('expired');
          return;
        }

        // Refresh token is valid, interceptor will handle refresh on next API call
        console.log('Token expired but refresh token valid - will refresh on next API call');
      }

      // Start token expiry monitor for valid sessions
      this.authService.startTokenExpiryMonitor();
    }
  }

  /**
   * Initialize SignalR real-time notification system
   */
  private async initializeSignalR(): Promise<void> {
    // Connect SignalR if user is already authenticated on app load
    if (this.authService.isAuthenticated()) {
      console.log('🔔 User authenticated on app load - starting SignalR connection');
      await this.signalRService.startConnection();
    }

    // Subscribe to authentication state changes
    this.authService.isAuthenticated$
      .pipe(takeUntil(this.destroy$))
      .subscribe(async (isAuthenticated) => {
        if (isAuthenticated) {
          // User logged in - start SignalR connection
          console.log('🔔 User logged in - starting SignalR connection');
          await this.signalRService.startConnection();
        } else {
          // User logged out - stop SignalR connection
          console.log('🔔 User logged out - stopping SignalR connection');
          await this.signalRService.stopConnection();
        }
      });
  }

  /**
   * Initialize review modal subscription
   */
  private initializeReviewModal(): void {
    console.log('📝 Initializing review modal subscription in App component');
    this.reviewModalService.reviewModal$
      .pipe(takeUntil(this.destroy$))
      .subscribe((data) => {
        console.log('📝 App component received review modal state change:', data);
        this.showReviewModal = data.show;
        this.reviewBookingId = data.bookingId;
        console.log('📝 App component state updated:', { showReviewModal: this.showReviewModal, reviewBookingId: this.reviewBookingId });
        // Force change detection
        this.cdr.detectChanges();
      });
  }

  /**
   * Handle review modal close
   */
  onReviewModalClose(): void {
    this.reviewModalService.closeReviewModal();
  }

  /**
   * Handle review submission
   */
  onReviewSubmitted(): void {
    console.log('✅ Review submitted successfully');
  }

  /**
   * Test method to manually open review modal (for debugging)
   * Can be called from browser console: window['app'].testOpenReviewModal(30)
   */
  testOpenReviewModal(bookingId: number): void {
    console.log('🧪 Test: Manually opening review modal for booking:', bookingId);
    this.reviewModalService.openReviewModal(bookingId);
  }
}

// Make app instance available for debugging
if (typeof window !== 'undefined') {
  (window as any)['app'] = null;
}
