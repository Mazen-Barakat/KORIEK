import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { WorkshopProfileData, WorkShopWorkingHoursAPI, WorkingHours } from '../models/workshop-profile.model';

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
    return this.http.get<WorkShopWorkingHoursAPI[]>(
      `https://localhost:44316/api/WorkShopWorkingHours?workShopProfileId=${workshopId}`
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
  convertAPIWorkingHours(apiHours: WorkShopWorkingHoursAPI[]): WorkingHours[] {
    return apiHours.map(hour => ({
      day: hour.day,
      openTime: this.formatTimeFromISO(hour.from),
      closeTime: this.formatTimeFromISO(hour.to),
      isClosed: hour.isClosed
    }));
  }

  /**
   * Convert display working hours format to API format
   */
  convertToAPIWorkingHours(hours: WorkingHours[], workShopProfileId: number): WorkShopWorkingHoursAPI[] {
    return hours.map(hour => ({
      day: (hour.dayNumber !== undefined ? hour.dayNumber.toString() : hour.day) || '0',
      from: this.formatTimeToISO(hour.openTime),
      to: this.formatTimeToISO(hour.closeTime),
      isClosed: hour.isClosed,
      workShopProfileId: workShopProfileId
    }));
  }

  /**
   * Format ISO time string to HH:mm format
   */
  private formatTimeFromISO(isoString: string): string {
    if (!isoString) return '09:00';
    try {
      const date = new Date(isoString);
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    } catch {
      return '09:00';
    }
  }

  /**
   * Format HH:mm time string to ISO 8601
   */
  private formatTimeToISO(timeString: string): string {
    if (!timeString) return new Date().toISOString();
    try {
      const [hours, minutes] = timeString.split(':');
      const date = new Date();
      date.setHours(parseInt(hours, 10));
      date.setMinutes(parseInt(minutes, 10));
      date.setSeconds(0);
      date.setMilliseconds(0);
      return date.toISOString();
    } catch {
      return new Date().toISOString();
    }
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
}
