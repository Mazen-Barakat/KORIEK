import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, shareReplay, tap, catchError } from 'rxjs/operators';
import { WorkshopProfileData, WorkShopWorkingHoursAPI, WorkingHours, WorkshopService, CategoryAPIResponse, CategoryData, SubcategoryAPIResponse, SubcategoryData, ServiceAPIResponse, ServiceData } from '../models/workshop-profile.model';

@Injectable({
  providedIn: 'root',
})
export class WorkshopProfileService {
  private apiUrl = 'https://localhost:44316/api/Workshop';

  // WorkShopProfile endpoints (separate controller)
  private profileApiBase = 'https://localhost:44316/api/WorkShopProfile';
  
  // Category API endpoint
  private categoryApiUrl = 'https://localhost:44316/api/Category';
  
  // Subcategory API endpoint
  private subcategoryApiUrl = 'https://localhost:44316/api/Subcategory';
  
  // Service API endpoint
  private serviceApiUrl = 'https://localhost:44316/api/Service';
  
  // Cache for categories, subcategories, and services
  private categoriesCache$?: Observable<CategoryAPIResponse>;
  private subcategoriesCache = new Map<number, Observable<SubcategoryAPIResponse>>();
  private servicesCache = new Map<number, Observable<ServiceAPIResponse>>();

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
    return this.http
      .get<any>(`https://localhost:44316/api/WorkShopWorkingHours/workshop/${workshopId}`)
      .pipe(
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
    return this.http.post('https://localhost:44316/api/WorkShopWorkingHours', workingHour);
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
    return this.http.delete(`https://localhost:44316/api/WorkShopWorkingHours/${id}`);
  }

  /**
   * Update working hours for a workshop
   */
  updateWorkshopWorkingHours(workingHours: WorkShopWorkingHoursAPI[]): Observable<any> {
    return this.http.put('https://localhost:44316/api/WorkShopWorkingHours', workingHours);
  }

  /**
   * Convert API working hours format to display format
   */
  convertAPIWorkingHours(apiHours: any[]): WorkingHours[] {
    console.log('Converting API hours to display format:', apiHours);
    const converted = apiHours.map((hour) => {
      const dayNumber = this.getDayNumber(hour.day);
      return {
        id: hour.id,
        day: hour.day,
        dayNumber: dayNumber,
        dayName: hour.day,
        openTime: hour.from,
        closeTime: hour.to,
        isClosed: hour.isClosed,
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
   * Upload gallery images using WorkShopPhotoController expected shape
   * Backend expects a form with WorkShopProfileId (int) and Photos[] files
   */
  uploadWorkShopPhotos(workShopProfileId: number | string, images: File[]): Observable<any> {
    const form = new FormData();
    // Ensure numeric id is passed as string
    form.append('WorkShopProfileId', String(workShopProfileId));

    images.forEach((image) => {
      form.append('Photos', image, image.name);
    });

    return this.http.post(`https://localhost:44316/api/WorkShopPhoto`, form);
  }

  /**
   * Upload gallery images with progress reporting (returns HttpEvents)
   */
  uploadWorkShopPhotosWithProgress(
    workShopProfileId: number | string,
    images: File[]
  ): Observable<HttpEvent<any>> {
    const form = new FormData();
    form.append('WorkShopProfileId', String(workShopProfileId));
    images.forEach((image) => form.append('Photos', image, image.name));

    return this.http.post(`https://localhost:44316/api/WorkShopPhoto`, form, {
      reportProgress: true,
      observe: 'events',
    });
  }

  /**
   * Get all photos for a workshop profile
   */
  getWorkShopPhotos(workShopProfileId: number | string): Observable<any> {
    return this.http.get(`https://localhost:44316/api/WorkShopPhoto/${workShopProfileId}`);
  }

  /**
   * Delete a workshop photo by its ID
   */
  deleteWorkShopPhotoById(photoId: number): Observable<any> {
    return this.http.delete(`https://localhost:44316/api/WorkShopPhoto/${photoId}`);
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
   * Load service categories from API with caching
   */
  loadServiceCategories(forceRefresh = false): Observable<CategoryAPIResponse> {
    // Clear cache if force refresh
    if (forceRefresh) {
      this.categoriesCache$ = undefined;
    }
    
    // Return cached observable if exists
    if (this.categoriesCache$) {
      return this.categoriesCache$;
    }
    
    // Create new observable with caching
    this.categoriesCache$ = this.http.get<CategoryAPIResponse>(this.categoryApiUrl).pipe(
      tap(response => {
        console.log('Categories loaded from API:', response);
      }),
      shareReplay(1) // Share result and replay to late subscribers
    );
    
    return this.categoriesCache$;
  }
  
  /**
   * Clear categories cache
   */
  clearCategoriesCache(): void {
    this.categoriesCache$ = undefined;
  }
  
  /**
   * Get subcategories by category ID with caching
   */
  getSubcategoriesByCategory(categoryId: number, forceRefresh = false): Observable<SubcategoryAPIResponse> {
    // Clear cache if force refresh
    if (forceRefresh) {
      this.subcategoriesCache.delete(categoryId);
    }
    
    // Return cached observable if exists
    if (this.subcategoriesCache.has(categoryId)) {
      return this.subcategoriesCache.get(categoryId)!;
    }
    
    // Create new observable with caching
    const subcategories$ = this.http.get<SubcategoryAPIResponse>(
      `${this.subcategoryApiUrl}/ByCategory/${categoryId}`
    ).pipe(
      tap(response => {
        console.log(`Subcategories for category ${categoryId} loaded from API:`, response);
      }),
      shareReplay(1)
    );
    
    this.subcategoriesCache.set(categoryId, subcategories$);
    return subcategories$;
  }
  
  /**
   * Clear subcategories cache
   */
  clearSubcategoriesCache(categoryId?: number): void {
    if (categoryId) {
      this.subcategoriesCache.delete(categoryId);
    } else {
      this.subcategoriesCache.clear();
    }
  }
  
  /**
   * Get services by subcategory ID with caching
   */
  getServicesBySubcategory(subcategoryId: number, forceRefresh = false): Observable<ServiceAPIResponse> {
    // Clear cache if force refresh
    if (forceRefresh) {
      this.servicesCache.delete(subcategoryId);
    }
    
    // Return cached observable if exists
    if (this.servicesCache.has(subcategoryId)) {
      return this.servicesCache.get(subcategoryId)!;
    }
    
    // Create new observable with caching
    const services$ = this.http.get<ServiceAPIResponse>(
      `${this.serviceApiUrl}/subcategory/${subcategoryId}`
    ).pipe(
      tap(response => {
        console.log(`Services for subcategory ${subcategoryId} loaded from API:`, response);
      }),
      shareReplay(1)
    );
    
    this.servicesCache.set(subcategoryId, services$);
    return services$;
  }
  
  /**
   * Clear services cache
   */
  clearServicesCache(subcategoryId?: number): void {
    if (subcategoryId) {
      this.servicesCache.delete(subcategoryId);
    } else {
      this.servicesCache.clear();
    }
  }

  // ============================================
  // Workshop Search API
  // ============================================

  /**
   * Search for workshops by service ID, vehicle origin, and appointment date.
   * Calls GET /api/WorkshopService/Search-Workshops-By-Service-And-Origin
   * 
   * @param serviceId The ID of the selected service
   * @param origin The vehicle origin (e.g., 'Germany', 'Japan', 'Italy', 'General')
   * @param appointmentDate The appointment date/time in ISO format or formatted string
   * @param city Optional city filter
   * @param latitude Optional latitude for location-based search
   * @param longitude Optional longitude for location-based search
   * @param pageNumber Optional page number for pagination (default 1)
   * @param pageSize Optional page size for pagination (default 10)
   * @returns Observable of workshop search results
   */
  searchWorkshopsByServiceAndOrigin(
    serviceId: number | string,
    origin: string,
    appointmentDate: string,
    options?: {
      city?: string;
      latitude?: number;
      longitude?: number;
      pageNumber?: number;
      pageSize?: number;
    }
  ): Observable<any> {
    const params = new URLSearchParams();
    params.set('ServiceId', String(serviceId));
    params.set('Origin', origin);
    params.set('AppointmentDate', appointmentDate);
    
    // Optional parameters
    if (options?.city) {
      params.set('City', options.city);
    }
    if (options?.latitude !== undefined) {
      params.set('Latitude', String(options.latitude));
    }
    if (options?.longitude !== undefined) {
      params.set('Longitude', String(options.longitude));
    }
    params.set('PageNumber', String(options?.pageNumber ?? 1));
    params.set('PageSize', String(options?.pageSize ?? 10));

    const url = `https://localhost:44316/api/WorkshopService/Search-Workshops-By-Service-And-Origin?${params.toString()}`;
    
    console.log('Workshop search URL:', url);
    
    return this.http.get<any>(url).pipe(
      tap((response: any) => {
        console.log('Workshop search raw response:', response);
      }),
      catchError((error) => {
        console.error('Workshop search error:', error);
        throw error;
      })
    );
  }
}
