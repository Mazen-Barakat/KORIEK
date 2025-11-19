import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface UserProfile {
  id: number;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  country: string;
  governorate: string;
  city: string;
  profileImageUrl: string | null;
  preferredLanguage: string;
}

export interface ProfileResponse {
  success: boolean;
  message: string;
  data: UserProfile;
}

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private readonly API_URL = 'https://localhost:44316/api/CarOwnerProfile';
  private readonly BACKEND_BASE_URL = 'https://localhost:44316';

  private profileDataSubject = new BehaviorSubject<{ profilePicture: string | null } | null>(null);
  public profileData$ = this.profileDataSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Fetch user profile data
   */
  getProfile(): Observable<ProfileResponse> {
    return this.http.get<ProfileResponse>(`${this.API_URL}/profile`).pipe(
      tap((response) => {
        if (response.success && response.data) {
          const fullImageUrl = this.getFullImageUrl(response.data.profileImageUrl);
          this.profileDataSubject.next({ profilePicture: fullImageUrl });
        }
      })
    );
  }

  /**
   * Update user profile data with optional file upload
   */
  updateProfile(profile: UserProfile, profileImage?: File): Observable<ProfileResponse> {
    const formData = new FormData();

    // Add form fields
    formData.append('id', profile.id.toString());
    formData.append('firstName', profile.firstName || '');
    formData.append('lastName', profile.lastName || '');
    formData.append('phoneNumber', profile.phoneNumber || '');
    formData.append('country', profile.country || '');
    formData.append('governorate', profile.governorate || '');
    formData.append('city', profile.city || '');
    formData.append('preferredLanguage', profile.preferredLanguage || 'English');

    // Add image file if provided
    if (profileImage) {
      formData.append('profileImage', profileImage, profileImage.name);
    }

    return this.http.put<ProfileResponse>(`${this.API_URL}/`, formData).pipe(
      tap((response) => {
        if (response.success && response.data) {
          const fullImageUrl = this.getFullImageUrl(response.data.profileImageUrl);
          this.profileDataSubject.next({ profilePicture: fullImageUrl });
        }
      })
    );
  }

  /**
   * Get full image URL with backend prefix
   */
  getFullImageUrl(relativePath: string | null): string | null {
    if (!relativePath) {
      return null;
    }
    // If it's already a full URL, return as is
    if (relativePath.startsWith('http')) {
      return relativePath;
    }
    // Otherwise, prepend the backend base URL
    return `${this.BACKEND_BASE_URL}${relativePath}`;
  }
}
