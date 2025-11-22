import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { WorkshopProfileData } from '../models/workshop-profile.model';

@Injectable({
  providedIn: 'root'
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
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    console.log('Service: Making PUT request to:', `${this.profileApiBase}/Update-WorkShop-Profile`);
    console.log('Service: Request body:', profileData);
    return this.http.put(`${this.profileApiBase}/Update-WorkShop-Profile`, profileData, { headers });
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
      body: { imageUrl }
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
