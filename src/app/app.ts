import { Component, signal, OnInit, OnDestroy, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { ToastContainerComponent } from './components/shared/toast-container/toast-container.component';
import { AuthService } from './services/auth.service';
import { SignalRNotificationService } from './services/signalr-notification.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent, ToastContainerComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('Korik');
  private authService = inject(AuthService);
  private signalRService = inject(SignalRNotificationService);
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.initializeAuth();
    this.initializeSignalR();
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
}
