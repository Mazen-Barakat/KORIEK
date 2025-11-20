import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, switchMap, filter, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class AuthInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.authService.getToken();

    // Add token to request if available
    if (token) {
      req = this.addTokenToRequest(req, token);
    }

    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        // Handle 401 Unauthorized errors
        if (error.status === 401) {
          return this.handle401Error(req, next);
        }
        return throwError(() => error);
      })
    );
  }

  private addTokenToRequest(request: HttpRequest<any>, token: string): HttpRequest<any> {
    return request.clone({
      headers: request.headers.set('Authorization', `Bearer ${token}`)
    });
  }

  private handle401Error(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Check if should auto-refresh based on Remember Me
    if (!this.authService.shouldAutoRefresh()) {
      console.log('Token expired without Remember Me - logging out');
      this.logout('expired');
      return throwError(() => new Error('Session expired'));
    }

    if (!this.isRefreshing) {
      return this.handleTokenRefresh(request, next);
    }

    // Wait for token refresh to complete
    return this.refreshTokenSubject.pipe(
      filter(token => token !== null),
      take(1),
      switchMap((token) => {
        return next.handle(this.addTokenToRequest(request, token));
      })
    );
  }

  private handleTokenRefresh(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    this.isRefreshing = true;
    this.refreshTokenSubject.next(null);

    console.log('🔄 Attempting to refresh token...');

    return this.authService.refreshAccessToken().pipe(
      switchMap((response: any) => {
        this.isRefreshing = false;

        // Check if response is successful
        if (response.success) {
          console.log('✅ Token refresh successful!');
          console.log('📦 Refresh Response:', response);

          // Save full auth response including new refresh token
          this.authService.saveAuthResponse(response);

          // Extract new token
          const newToken = response.data?.token || response.token;

          if (newToken) {
            console.log('🔑 New Access Token:', newToken.substring(0, 50) + '...');
            console.log('🔑 New Refresh Token:', (response.data?.refreshToken || '').substring(0, 30) + '...');
            console.log('⏰ Token Expiry:', response.data?.tokenExpiryTime);
            console.log('⏰ Refresh Token Expiry:', response.data?.refreshTokenExpiryTime);
            console.log('💾 Tokens saved to localStorage');

            this.refreshTokenSubject.next(newToken);

            // Retry original request with new token
            return next.handle(this.addTokenToRequest(request, newToken));
          }
        }

        // If no token in response or unsuccessful, logout
        console.error('❌ Token refresh failed - no token in response');
        this.logout('refresh_failed');
        return throwError(() => new Error('Token refresh failed'));
      }),
      catchError((error) => {
        this.isRefreshing = false;
        console.error('❌ Token refresh failed with error:', error);
        this.logout('expired');
        return throwError(() => error);
      })
    );
  }

  private logout(reason?: string): void {
    this.authService.logout(reason);
  }
}
