import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { WorkshopProfileData, WorkShopWorkingHoursAPI, WorkingHours, WorkshopService } from '../models/workshop-profile.model';

@Injectable({
  providedIn: 'root',
})
export class WorkshopProfileService {
  private apiUrl = 'https://localhost:44316/api/Workshop';

  // WorkShopProfile endpoints (separate controller)
  private profileApiBase = 'https://localhost:44316/api/WorkShopProfile';

  constructor(private http: HttpClient) {}

  /**
   * Get workshop profile by ID
   */
  getWorkshopProfile(workshopId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${workshopId}`);
  }

  /**
   * Update workshop profile
   */
  updateWorkshopProfile(workshopId: string, profileData: WorkshopProfileData): Observable<any> {
    return this.http.put(`${this.apiUrl}/${workshopId}`, profileData);
  }

  /**
   * Get the current user's workshop profile from the WorkShopProfile controller
   */
  getMyWorkshopProfile(): Observable<any> {
    return this.http.get(`${this.profileApiBase}/Get-My-WorkShop-Profile`);
  }

  /**
   * Update the current user's workshop profile. The backend expects JSON body with URL strings.
   */
  updateMyWorkshopProfile(profileData: any): Observable<any> {
    // Backend expects form-data (UpdateWorkShopProfileDTO is bound from [FromForm]).
    // If the caller passed a FormData already, send it as-is.
    if (profileData instanceof FormData) {
      console.log(
        'Service: Sending FormData to:',
        `${this.profileApiBase}/Update-WorkShop-Profile`
      );
      return this.http.put(`${this.profileApiBase}/Update-WorkShop-Profile`, profileData);
    }

    // Convert plain object to FormData so multipart/form-data is used and model binder accepts it.
    const form = new FormData();
    Object.keys(profileData || {}).forEach((key) => {
      const value = profileData[key];
      if (value === null || value === undefined) return;
      // Arrays or objects should be json-stringified
      if (typeof value === 'object' && !(value instanceof File)) {
        try {
          form.append(key, JSON.stringify(value));
        } catch {
          form.append(key, String(value));
        }
      } else {
        form.append(key, String(value));
      }
    });

    console.log(
      'Service: Sending converted FormData to:',
      `${this.profileApiBase}/Update-WorkShop-Profile`
    );
    return this.http.put(`${this.profileApiBase}/Update-WorkShop-Profile`, form);
  }

  /**
   * Get working hours for a workshop
   */
  getWorkshopWorkingHours(workshopId: number): Observable<WorkShopWorkingHoursAPI[]> {
    return this.http.get<any>(
      `https://localhost:44316/api/WorkShopWorkingHours/workshop/${workshopId}`
    ).pipe(
      map((response: any) => {
        // Handle response that might be wrapped in data property
        console.log('Raw API Response for working hours:', response);
        return response?.data ?? response ?? [];
      })
    );
  }

  /**
   * Create working hours for a workshop
   */
  createWorkingHours(workingHour: WorkShopWorkingHoursAPI): Observable<any> {
    return this.http.post(
      'https://localhost:44316/api/WorkShopWorkingHours',
      workingHour
    );
  }

  /**
   * Delete all working hours for a workshop
   */
  deleteAllWorkingHours(workshopId: number): Observable<any> {
    return this.http.delete(
      `https://localhost:44316/api/WorkShopWorkingHours/workshop/${workshopId}`
    );
  }

  /**
   * Delete individual working hour by ID
   */
  deleteWorkingHour(id: number): Observable<any> {
    return this.http.delete(
      `https://localhost:44316/api/WorkShopWorkingHours/${id}`
    );
  }

  /**
   * Update working hours for a workshop
   */
  updateWorkshopWorkingHours(workingHours: WorkShopWorkingHoursAPI[]): Observable<any> {
    return this.http.put(
      'https://localhost:44316/api/WorkShopWorkingHours',
      workingHours
    );
  }

  /**
   * Convert API working hours format to display format
   */
  convertAPIWorkingHours(apiHours: any[]): WorkingHours[] {
    console.log('Converting API hours to display format:', apiHours);
    const converted = apiHours.map(hour => {
      const dayNumber = this.getDayNumber(hour.day);
      return {
        id: hour.id,
        day: hour.day,
        dayNumber: dayNumber,
        dayName: hour.day,
        openTime: hour.from,
        closeTime: hour.to,
        isClosed: hour.isClosed
      };
    });
    console.log('Converted hours:', converted);
    return converted;
  }

  /**
   * Get day number from day name
   */
  private getDayNumber(dayName: string): number {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days.indexOf(dayName);
  }

  /**
   * Create workshop profile (for new workshop owners)
   */
  createWorkshopProfile(profileData: WorkshopProfileData): Observable<any> {
    return this.http.post(this.apiUrl, profileData);
  }

  /**
   * Upload gallery images
   */
  uploadGalleryImages(workshopId: string, images: File[]): Observable<any> {
    const formData = new FormData();
    images.forEach((image, index) => {
      formData.append(`images`, image, image.name);
    });

    return this.http.post(`${this.apiUrl}/${workshopId}/gallery`, formData);
  }

  /**
   * Delete gallery image
   */
  deleteGalleryImage(workshopId: string, imageUrl: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${workshopId}/gallery`, {
      body: { imageUrl },
    });
  }

  /**
   * Upload business license
   */
  uploadBusinessLicense(workshopId: string, license: File): Observable<any> {
    const formData = new FormData();
    formData.append('license', license, license.name);

    return this.http.post(`${this.apiUrl}/${workshopId}/license`, formData);
  }

  /**
   * Upload workshop logo
   */
  uploadWorkshopLogo(workshopId: string, logo: File): Observable<any> {
    const formData = new FormData();
    formData.append('logo', logo, logo.name);

    return this.http.post(`${this.apiUrl}/${workshopId}/logo`, formData);
  }

  // ============================================
  // Workshop Services CRUD Operations
  // ============================================

  /**
   * Get all services for a workshop
   */
  getWorkshopServices(workshopId: number): Observable<WorkshopService[]> {
    return this.http.get<WorkshopService[]>(`${this.apiUrl}/${workshopId}/services`);
  }

  /**
   * Get a specific workshop service by ID
   */
  getWorkshopService(workshopId: number, serviceId: number): Observable<WorkshopService> {
    return this.http.get<WorkshopService>(`${this.apiUrl}/${workshopId}/services/${serviceId}`);
  }

  /**
   * Add multiple services to a workshop
   */
  addWorkshopServices(workshopId: number, services: WorkshopService[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/${workshopId}/services/batch`, services);
  }

  /**
   * Add a single service to a workshop
   */
  addWorkshopService(workshopId: number, service: WorkshopService): Observable<any> {
    return this.http.post(`${this.apiUrl}/${workshopId}/services`, service);
  }

  /**
   * Update a workshop service
   */
  updateWorkshopService(workshopId: number, serviceId: number, service: WorkshopService): Observable<any> {
    return this.http.put(`${this.apiUrl}/${workshopId}/services/${serviceId}`, service);
  }

  /**
   * Delete a workshop service
   */
  deleteWorkshopService(workshopId: number, serviceId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${workshopId}/services/${serviceId}`);
  }

  /**
   * Toggle service availability
   */
  toggleServiceAvailability(workshopId: number, serviceId: number): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${workshopId}/services/${serviceId}/toggle`, {});
  }

  /**
   * Load service categories from JSON file
   */
  loadServiceCategories(): Observable<any> {
    return this.http.get('/Car Services.json');
  }
}
