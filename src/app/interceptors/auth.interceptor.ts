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

    // Check if token is expired before making the request
    if (token && this.isTokenExpired(token)) {
      console.log('Token expired, attempting refresh...');
      return this.handleTokenRefresh(req, next);
    }

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

    return this.authService.refreshAccessToken().pipe(
      switchMap((response: any) => {
        this.isRefreshing = false;

        // Extract new token from response
        const newToken = response.data?.token || response.token;

        if (newToken) {
          this.authService.saveToken(newToken);
          this.refreshTokenSubject.next(newToken);
          console.log('Token refreshed successfully');

          // Retry original request with new token
          return next.handle(this.addTokenToRequest(request, newToken));
        }

        // If no token in response, logout
        this.logout();
        return throwError(() => new Error('Token refresh failed'));
      }),
      catchError((error) => {
        this.isRefreshing = false;
        console.error('Token refresh failed:', error);
        this.logout();
        return throwError(() => error);
      })
    );
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiry = payload.exp;

      if (!expiry) {
        return false; // If no expiry, assume token is valid
      }

      // Check if token expires in less than 5 minutes (300 seconds)
      const currentTime = Math.floor(Date.now() / 1000);
      return (expiry - currentTime) < 300;
    } catch (e) {
      console.error('Error decoding token:', e);
      return true; // If cannot decode, consider expired
    }
  }

  private logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
