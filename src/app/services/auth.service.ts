import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly TOKEN_KEY = 'authToken';
  private readonly USER_KEY = 'user';
  private readonly REFRESH_TOKEN_KEY = 'refreshToken';
  private readonly USER_ID_KEY = 'userId';
  private readonly TOKEN_EXPIRY_KEY = 'tokenExpiryTime';
  private readonly REFRESH_TOKEN_EXPIRY_KEY = 'refreshTokenExpiryTime';
  private readonly REMEMBER_ME_KEY = 'rememberMe';
  private tokenExpiryMonitor: any = null;
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(this.hasToken());
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
  private currentUserSubject = new BehaviorSubject<any>(this.getUser());
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private router: Router, private http: HttpClient) {}

  // Check if token exists in localStorage
  private hasToken(): boolean {
    return !!localStorage.getItem(this.TOKEN_KEY);
  }

  // Save token to localStorage
  saveToken(token: string, expiryTime?: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    if (expiryTime) {
      localStorage.setItem(this.TOKEN_EXPIRY_KEY, expiryTime);
    }
    this.isAuthenticatedSubject.next(true);
  }

  // Retrieve token from localStorage
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  // Remove token from localStorage
  clearToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.TOKEN_EXPIRY_KEY);
    this.isAuthenticatedSubject.next(false);
  }

  // Save user data to localStorage
  saveUser(userData: any): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(userData));
    this.currentUserSubject.next(userData);
  }

  // Retrieve user data from localStorage
  getUser(): any {
    const userStr = localStorage.getItem(this.USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  }

  // Get user role (first role from roles array)
  getUserRole(): string | null {
    const user = this.getUser();
    return user && user.roles && user.roles.length > 0 ? user.roles[0] : null;
  }

  // Get token expiry time
  getTokenExpiryTime(): string | null {
    return localStorage.getItem(this.TOKEN_EXPIRY_KEY);
  }

  // Check if access token is expired
  isTokenExpired(): boolean {
    const token = this.getToken();
    if (!token) return true;

    const expiryTime = this.getTokenExpiryTime();
    if (!expiryTime) return false;

    const expiryDate = new Date(expiryTime);
    const now = new Date();
    return now >= expiryDate;
  }

  // Get refresh token expiry time
  getRefreshTokenExpiryTime(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_EXPIRY_KEY);
  }

  // Check if refresh token is expired
  isRefreshTokenExpired(): boolean {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return true;

    const expiryTime = this.getRefreshTokenExpiryTime();
    if (!expiryTime) return false;

    const expiryDate = new Date(expiryTime);
    const now = new Date();
    return now >= expiryDate;
  }

  // Remove user data from localStorage
  clearUser(): void {
    localStorage.removeItem(this.USER_KEY);
    this.currentUserSubject.next(null);
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return this.hasToken();
  }

  // Logout user and redirect to login page
  logout(reason?: string): void {
    this.stopTokenExpiryMonitor();
    this.clearToken();
    this.clearUser();
    this.clearRefreshToken();
    this.clearRememberMe();

    const navigationExtras = reason ? { queryParams: { reason } } : {};
    this.router.navigate(['/login'], navigationExtras);
  }

  // Save refresh token to localStorage
  saveRefreshToken(refreshToken: string, expiryTime?: string): void {
    localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
    if (expiryTime) {
      localStorage.setItem(this.REFRESH_TOKEN_EXPIRY_KEY, expiryTime);
    }
  }

  // Get refresh token from localStorage
  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  // Clear refresh token
  clearRefreshToken(): void {
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.USER_ID_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_EXPIRY_KEY);
  }

  // Save user ID
  saveUserId(userId: string): void {
    localStorage.setItem(this.USER_ID_KEY, userId);
  }

  // Get user ID
  getUserId(): string | null {
    return localStorage.getItem(this.USER_ID_KEY);
  }

  // Get user's display name (various backend fields)
  getUserName(): string | null {
    const user = this.getUser();
    if (!user) return null;
    return user.userName || user.name || user.fullName || user.displayName || user.email || null;
  }

  // Save Remember Me flag
  saveRememberMe(rememberMe: boolean): void {
    localStorage.setItem(this.REMEMBER_ME_KEY, rememberMe.toString());
  }

  // Get Remember Me flag
  getRememberMe(): boolean {
    return localStorage.getItem(this.REMEMBER_ME_KEY) === 'true';
  }

  // Clear Remember Me flag
  clearRememberMe(): void {
    localStorage.removeItem(this.REMEMBER_ME_KEY);
  }

  // Check if should auto-refresh token
  shouldAutoRefresh(): boolean {
    return this.getRememberMe() && !this.isRefreshTokenExpired();
  }

  // Refresh access token using refresh token
  refreshAccessToken(): Observable<any> {
    const userId = this.getUserId();
    const refreshToken = this.getRefreshToken();

    if (!userId || !refreshToken) {
      throw new Error('No refresh token available');
    }

    return this.http.post('https://korik-demo.runasp.net/api/Account/RefreshToken', {
      userId: userId,
      refreshToken: refreshToken,
    });
  }

  // Save full auth response (used after login and token refresh)
  saveAuthResponse(response: any): void {
    const data = response.data || response;

    // Save token with expiry
    if (data.token) {
      this.saveToken(data.token, data.tokenExpiryTime);
    }

    // Save user data
    if (data.id || data.userName || data.email) {
      this.saveUser(data);
      if (data.id) {
        this.saveUserId(data.id);
      }
    }

    // Save refresh token with expiry (only if Remember Me is enabled)
    if (this.getRememberMe() && data.refreshToken) {
      this.saveRefreshToken(data.refreshToken, data.refreshTokenExpiryTime);
    }
  }

  // Start monitoring token expiry
  startTokenExpiryMonitor(): void {
    // Clear any existing monitor
    this.stopTokenExpiryMonitor();

    // Check token expiry every 60 seconds
    this.tokenExpiryMonitor = setInterval(() => {
      if (this.isTokenExpired()) {
        // If token is expired and Remember Me is NOT enabled, logout
        if (!this.getRememberMe()) {
          console.log('Token expired without Remember Me - logging out');
          this.logout('expired');
        }
        // If Remember Me is enabled, let the interceptor handle refresh on next API call
      } else if (this.shouldProactivelyRefresh()) {
        // Proactively refresh if token expires soon and user has Remember Me enabled
        console.log('🔄 Token expiring soon - proactively refreshing in background');
        this.refreshAccessToken().subscribe({
          next: (response: any) => {
            if (response.success) {
              console.log('✅ Proactive token refresh successful');
              this.saveAuthResponse(response);
            }
          },
          error: (error) => {
            console.error('❌ Proactive token refresh failed:', error);
            // Don't logout here, let the interceptor handle it on next API call
          },
        });
      }
    }, 60000); // Check every minute
  }

  // Check if token should be proactively refreshed
  private shouldProactivelyRefresh(): boolean {
    // Only proactively refresh if Remember Me is enabled
    if (!this.getRememberMe()) {
      return false;
    }

    const token = this.getToken();
    if (!token) return false;

    const expiryTime = this.getTokenExpiryTime();
    if (!expiryTime) return false;

    const expiryDate = new Date(expiryTime);
    const now = new Date();
    const timeUntilExpiry = expiryDate.getTime() - now.getTime();

    // Refresh if token expires in less than 5 minutes (300000 ms)
    return timeUntilExpiry > 0 && timeUntilExpiry < 300000;
  }

  // Stop monitoring token expiry
  stopTokenExpiryMonitor(): void {
    if (this.tokenExpiryMonitor) {
      clearInterval(this.tokenExpiryMonitor);
      this.tokenExpiryMonitor = null;
    }
  }
}
