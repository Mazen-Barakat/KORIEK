/**
 * Service model - represents a specific service within a subcategory
 */
export interface Service {
  id: number;
  name: string;
  description: string;
  subcategoryId: number;
  subcategoryName: string | null;
}

/**
 * API response wrapper for services
 */
export interface ServiceResponse {
  success: boolean;
  message: string;
  data: Service[];
}
