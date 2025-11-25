/**
 * User Role Constants
 * Centralized role definitions for the application
 */

export enum UserRole {
  CAROWNER = 'CAROWNER',
  WORKSHOP = 'WORKSHOP',
  ADMIN = 'ADMIN'
}

/**
 * Human-readable role names for display
 */
export const RoleNames: Record<UserRole, string> = {
  [UserRole.CAROWNER]: 'Car Owner',
  [UserRole.WORKSHOP]: 'Workshop Owner',
  [UserRole.ADMIN]: 'Administrator'
};

/**
 * Role validation helper
 */
export class RoleHelper {
  /**
   * Normalize role string to uppercase for comparison
   */
  static normalize(role: string | null | undefined): string {
    return (role || '').toUpperCase().trim();
  }

  /**
   * Check if role matches expected role
   */
  static isRole(userRole: string | null | undefined, expectedRole: UserRole): boolean {
    return this.normalize(userRole) === expectedRole;
  }

  /**
   * Check if user is admin
   */
  static isAdmin(userRole: string | null | undefined): boolean {
    return this.isRole(userRole, UserRole.ADMIN);
  }

  /**
   * Check if user is workshop owner
   */
  static isWorkshop(userRole: string | null | undefined): boolean {
    const normalized = this.normalize(userRole);
    return normalized === UserRole.WORKSHOP || normalized === 'WORKSHOPOWNER';
  }

  /**
   * Check if user is car owner
   */
  static isCarOwner(userRole: string | null | undefined): boolean {
    return this.isRole(userRole, UserRole.CAROWNER);
  }
}
