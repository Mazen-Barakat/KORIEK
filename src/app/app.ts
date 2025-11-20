import { Component, signal, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App implements OnInit {
  protected readonly title = signal('Korik');
  private authService = inject(AuthService);

  ngOnInit(): void {
    this.initializeAuth();
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
}
