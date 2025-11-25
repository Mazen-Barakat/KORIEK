import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

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
  providedIn: 'root'
})
export class AdminService {
  private baseUrl = 'https://localhost:44316/api';

  constructor(private http: HttpClient) {}

  /**
   * Get all unverified workshop profiles
   */
  getUnverifiedWorkshops(pageNumber: number = 1, pageSize: number = 10): Observable<PaginatedResponse<WorkshopProfile>> {
    const params = new HttpParams()
      .set('PageNumber', pageNumber.toString())
      .set('PageSize', pageSize.toString());

    return this.http.get<ApiResponse<PaginatedResponse<WorkshopProfile>>>(
      `${this.baseUrl}/WorkShopProfile/Get-All-Unverified-WorkShop-Profile`,
      { params }
    ).pipe(
      map(response => response.data)
    );
  }

  /**
   * Get all verified workshop profiles
   */
  getAllWorkshops(pageNumber: number = 1, pageSize: number = 10): Observable<PaginatedResponse<WorkshopProfile>> {
    const params = new HttpParams()
      .set('PageNumber', pageNumber.toString())
      .set('PageSize', pageSize.toString());

    return this.http.get<ApiResponse<PaginatedResponse<WorkshopProfile>>>(
      `${this.baseUrl}/WorkShopProfile/Get-All-WorkShop-Profiles`,
      { params }
    ).pipe(
      map(response => response.data)
    );
  }

  /**
   * Update workshop verification status
   */
  updateWorkshopStatus(request: UpdateWorkshopStatusRequest): Observable<any> {
    return this.http.put(
      `${this.baseUrl}/WorkShopProfile/Update-WorkShop-Profile-Status`,
      request
    );
  }

  /**
   * Verify a workshop (approve)
   */
  verifyWorkshop(workshopId: number): Observable<any> {
    return this.updateWorkshopStatus({
      id: workshopId,
      verificationStatus: 'Verified'
    });
  }

  /**
   * Reject a workshop
   */
  rejectWorkshop(workshopId: number): Observable<any> {
    return this.updateWorkshopStatus({
      id: workshopId,
      verificationStatus: 'Rejected'
    });
  }
}
