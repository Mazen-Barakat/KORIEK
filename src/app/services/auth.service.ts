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
  saveToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    this.isAuthenticatedSubject.next(true);
  }

  // Retrieve token from localStorage
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  // Remove token from localStorage
  clearToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
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
  logout(): void {
    this.clearToken();
    this.clearUser();
    this.clearRefreshToken();
    this.router.navigate(['/select-role']);
  }

  // Save refresh token to localStorage
  saveRefreshToken(refreshToken: string): void {
    localStorage.setItem('refreshToken', refreshToken);
  }

  // Get refresh token from localStorage
  getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }

  // Clear refresh token
  clearRefreshToken(): void {
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userId');
  }

  // Refresh access token using refresh token
  refreshAccessToken(): Observable<any> {
    const userId = localStorage.getItem('userId');
    const refreshToken = this.getRefreshToken();

    if (!userId || !refreshToken) {
      throw new Error('No refresh token available');
    }

    return this.http.post('https://localhost:44316/api/Account/RefreshToken', {
      userId: userId,
      refreshToken: refreshToken
    });
  }
}
