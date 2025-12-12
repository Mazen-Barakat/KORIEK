import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

export interface WorkshopProfile {
  id: number;
  name: string;
  description: string;
  numbersOfTechnicians: number;
  phoneNumber: string;
  rating: number;
  country: string;
  governorate: string;
  city: string;
  latitude: number;
  longitude: number;
  licenceImageUrl: string;
  logoImageUrl: string | null;
  verificationStatus: 'Pending' | 'Verified' | 'Rejected';
  workShopType: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface UpdateWorkshopStatusRequest {
  id: number;
  verificationStatus: 'Verified' | 'Rejected';
}

@Injectable({
  providedIn: 'root',
})
export class AdminService {
  private baseUrl = 'https://localhost:44316/api';

  constructor(private http: HttpClient) {}

  /**
   * Get all unverified workshop profiles
   */
  getUnverifiedWorkshops(
    pageNumber: number = 1,
    pageSize: number = 10
  ): Observable<PaginatedResponse<WorkshopProfile>> {
    const params = new HttpParams()
      .set('PageNumber', pageNumber.toString())
      .set('PageSize', pageSize.toString());

    console.log('🔍 Fetching unverified workshops:', { pageNumber, pageSize });

    return this.http
      .get<ApiResponse<PaginatedResponse<WorkshopProfile>>>(
        `${this.baseUrl}/WorkShopProfile/Get-All-Unverified-WorkShop-Profile`,
        { params }
      )
      .pipe(
        tap((response) => console.log('📥 Unverified workshops response:', response)),
        map((response) => {
          if (response && response.data) {
            return response.data;
          }
          console.warn('⚠️ Unexpected response structure for unverified workshops:', response);
          return {
            items: [],
            pageNumber: 1,
            pageSize: 10,
            totalRecords: 0,
            totalPages: 0,
            hasPreviousPage: false,
            hasNextPage: false,
          };
        }),
        catchError((error) => {
          console.error('❌ Error fetching unverified workshops:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get all verified workshop profiles
   */
  getAllWorkshops(
    pageNumber: number = 1,
    pageSize: number = 10
  ): Observable<PaginatedResponse<WorkshopProfile>> {
    const params = new HttpParams()
      .set('PageNumber', pageNumber.toString())
      .set('PageSize', pageSize.toString());

    console.log('🔍 Fetching verified workshops:', { pageNumber, pageSize });

    return this.http
      .get<ApiResponse<PaginatedResponse<WorkshopProfile>>>(
        `${this.baseUrl}/WorkShopProfile/Get-All-WorkShop-Profiles`,
        { params }
      )
      .pipe(
        tap((response) => console.log('📥 Verified workshops response:', response)),
        map((response) => {
          if (response && response.data) {
            return response.data;
          }
          console.warn('⚠️ Unexpected response structure for verified workshops:', response);
          return {
            items: [],
            pageNumber: 1,
            pageSize: 10,
            totalRecords: 0,
            totalPages: 0,
            hasPreviousPage: false,
            hasNextPage: false,
          };
        }),
        catchError((error) => {
          console.error('❌ Error fetching verified workshops:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Update workshop verification status
   */
  updateWorkshopStatus(request: UpdateWorkshopStatusRequest): Observable<any> {
    return this.http.put(`${this.baseUrl}/WorkShopProfile/Update-WorkShop-Profile-Status`, request);
  }

  /**
   * Verify a workshop (approve)
   */
  verifyWorkshop(workshopId: number): Observable<any> {
    return this.updateWorkshopStatus({
      id: workshopId,
      verificationStatus: 'Verified',
    });
  }

  /**
   * Reject a workshop
   */
  rejectWorkshop(workshopId: number): Observable<any> {
    return this.updateWorkshopStatus({
      id: workshopId,
      verificationStatus: 'Rejected',
    });
  }

  /**
   * Get all car owner profiles
   */
  getAllCarOwners(): Observable<CarOwnerProfile[]> {
    console.log('🔍 Fetching car owners...');
    return this.http
      .get<ApiResponse<CarOwnerProfile[]>>(`${this.baseUrl}/CarOwnerProfile/all`)
      .pipe(
        tap((response) => console.log('📥 Car owners response:', response)),
        map((response) => response?.data || []),
        catchError((error) => {
          console.error('❌ Error fetching car owners:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get all cars
   */
  getAllCars(): Observable<Car[]> {
    console.log('🔍 Fetching cars...');
    return this.http.get<ApiResponse<Car[]>>(`${this.baseUrl}/Car`).pipe(
      tap((response) => console.log('📥 Cars response:', response)),
      map((response) => response?.data || []),
      catchError((error) => {
        console.error('❌ Error fetching cars:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get bookings by workshop ID
   */
  getBookingsByWorkshop(workshopId: number): Observable<Booking[]> {
    return this.http
      .get<ApiResponse<Booking[]>>(`${this.baseUrl}/Booking/ByWorkshop/${workshopId}`)
      .pipe(map((response) => response.data));
  }

  /**
   * Get all bookings in the system
   */
  getAllBookings(): Observable<Booking[]> {
    console.log('🔍 Fetching all bookings...');
    return this.http.get<ApiResponse<Booking[]>>(`${this.baseUrl}/Booking/All`).pipe(
      tap((response) => console.log('📥 All bookings response:', response)),
      map((response) => response?.data || []),
      catchError((error) => {
        console.error('❌ Error fetching all bookings:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get all workshops without pagination (for analytics)
   */
  getAllWorkshopsUnpaginated(): Observable<WorkshopProfile[]> {
    // Request with very large page size to get all workshops
    const params = new HttpParams().set('PageNumber', '1').set('PageSize', '1000');

    console.log('🔍 Fetching all workshops (unpaginated)...');

    return this.http
      .get<ApiResponse<PaginatedResponse<WorkshopProfile>>>(
        `${this.baseUrl}/WorkShopProfile/Get-All-WorkShop-Profiles`,
        { params }
      )
      .pipe(
        tap((response) => console.log('📥 All workshops response:', response)),
        map((response) => response?.data?.items || []),
        catchError((error) => {
          console.error('❌ Error fetching all workshops:', error);
          return throwError(() => error);
        })
      );
  }
}

export interface CarOwnerProfile {
  id: number;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  country: string;
  governorate: string;
  city: string;
  profileImageUrl: string;
  preferredLanguage: string;
}

export interface Car {
  id: number;
  make: string;
  model: string;
  year: number;
  engineCapacity: number;
  currentMileage: number;
  licensePlate: string;
  transmissionType: string;
  fuelType: string;
  carOwnerProfileId: number;
  origin: string;
}

export interface Booking {
  id: number;
  status: string;
  appointmentDate: string;
  issueDescription: string;
  paymentMethod: string;
  paidAmount: number;
  paymentStatus: string;
  createdAt: string;
  carId: number;
  workShopProfileId: number;
  workshopServiceId: number;
  carOwnerConfirmed: boolean | null;
  workshopOwnerConfirmed: boolean | null;
  confirmationSentAt: string | null;
  confirmationDeadline: string | null;
}
