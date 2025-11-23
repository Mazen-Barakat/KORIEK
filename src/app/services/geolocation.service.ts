import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export interface GeolocationPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface GeolocationError {
  code: number;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class GeolocationService {
  private locationSubject = new Subject<GeolocationPosition>();
  private errorSubject = new Subject<GeolocationError>();

  constructor() {}

  /**
   * Request the user's current location
   * This will trigger the browser's location permission prompt
   */
  requestLocation(): Observable<GeolocationPosition> {
    if (!this.isGeolocationSupported()) {
      this.errorSubject.next({
        code: -1,
        message: 'Geolocation is not supported by your browser'
      });
      return this.locationSubject.asObservable();
    }

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const geoPosition: GeolocationPosition = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        };
        this.locationSubject.next(geoPosition);
      },
      (error) => {
        const geoError: GeolocationError = {
          code: error.code,
          message: this.getErrorMessage(error.code)
        };
        this.errorSubject.next(geoError);
      },
      options
    );

    return this.locationSubject.asObservable();
  }

  /**
   * Get location error observable
   */
  getLocationErrors(): Observable<GeolocationError> {
    return this.errorSubject.asObservable();
  }

  /**
   * Check if geolocation is supported by the browser
   */
  isGeolocationSupported(): boolean {
    return 'geolocation' in navigator;
  }

  /**
   * Check current permission status
   */
  async checkPermissionStatus(): Promise<PermissionState | null> {
    if (!('permissions' in navigator)) {
      return null;
    }

    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      return result.state;
    } catch (error) {
      console.error('Error checking geolocation permission:', error);
      return null;
    }
  }

  /**
   * Get user-friendly error message based on error code
   */
  private getErrorMessage(code: number): string {
    switch (code) {
      case 1: // PERMISSION_DENIED
        return 'Location access denied. Please enable location permissions in your browser settings to help customers find your workshop.';
      case 2: // POSITION_UNAVAILABLE
        return 'Location information is unavailable. Please check your device settings.';
      case 3: // TIMEOUT
        return 'Location request timed out. Please try again.';
      default:
        return 'An unknown error occurred while retrieving your location.';
    }
  }

  /**
   * Save location to backend (optional - implement when backend endpoint is ready)
   */
  async saveWorkshopLocation(location: GeolocationPosition): Promise<void> {
    // TODO: Implement API call to save location to backend
    console.log('Workshop location to save:', location);
    // Example:
    // return this.http.post('/api/workshop/location', location).toPromise();
  }
}
