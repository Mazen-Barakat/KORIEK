import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Check if user is authenticated
  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  // Check if token is expired
  if (authService.isTokenExpired()) {
    // If Remember Me is not enabled, logout immediately
    if (!authService.getRememberMe()) {
      console.log('Token expired without Remember Me - redirecting to login');
      authService.logout('expired');
      return false;
    }

    // If Remember Me is enabled, check if refresh token is expired
    if (authService.isRefreshTokenExpired()) {
      console.log('Refresh token expired - redirecting to login');
      authService.logout('expired');
      return false;
    }

    // Refresh token is valid, let the interceptor handle refresh on next API call
    console.log('Token expired with Remember Me - will refresh on next API call');
  }

  return true;
};
