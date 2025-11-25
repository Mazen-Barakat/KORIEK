import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { RoleHelper, UserRole } from '../models/user-roles';

/**
 * Admin Guard - Protects routes that require admin role
 *
 * This guard ensures that only authenticated users with the ADMIN role
 * can access protected admin routes.
 *
 * Usage:
 * ```typescript
 * {
 *   path: 'admin/dashboard',
 *   component: AdminDashboardComponent,
 *   canActivate: [authGuard, adminGuard]
 * }
 * ```
 */
export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // First check if user is authenticated
  if (!authService.isAuthenticated()) {
    console.warn('Admin guard: User not authenticated, redirecting to login');
    router.navigate(['/login']);
    return false;
  }

  // Check if token is expired (same logic as auth.guard.ts)
  if (authService.isTokenExpired()) {
    // If Remember Me is disabled, logout immediately
    if (!authService.getRememberMe()) {
      console.warn('Admin guard: Token expired without Remember Me, logging out');
      authService.logout('expired');
      return false;
    }

    // If Remember Me is enabled but refresh token is also expired, logout
    if (authService.isRefreshTokenExpired()) {
      console.warn('Admin guard: Refresh token expired, logging out');
      authService.logout('expired');
      return false;
    }

    // Otherwise, allow navigation and let interceptor handle token refresh
    console.log('Admin guard: Token expired but refresh token valid, allowing navigation');
  }

  // Check if user has admin role
  const userRole = authService.getUserRole();

  if (RoleHelper.isAdmin(userRole)) {
    console.log('Admin guard: User has admin role, allowing access');
    return true;
  }

  // User is authenticated but not an admin
  console.warn('Admin guard: User does not have admin role, redirecting to unauthorized');
  router.navigate(['/unauthorized'], {
    queryParams: {
      message: 'You do not have permission to access this page.',
      requiredRole: 'Administrator'
    }
  });
  return false;
};
