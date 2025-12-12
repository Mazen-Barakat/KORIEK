import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

// API Request/Response Interfaces
export interface WorkshopServiceCreateRequest {
  serviceId: number;
  workShopProfileId: number;
  duration: number;
  minPrice: number;
  maxPrice: number;
  origin: string;
}

export interface WorkshopServiceAPIResponse {
  success: boolean;
  message: string;
  data: WorkshopServiceData | WorkshopServiceData[] | PaginatedWorkshopServices;
}

export interface PaginatedWorkshopServices {
  items: WorkshopServiceData[];
  pageNumber: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface WorkshopServiceData {
  id: number;
  serviceId: number;
  workShopProfileId: number;
  duration: number;
  minPrice: number;
  maxPrice: number;
  origin: string;
  serviceName?: string;
  serviceDescription?: string;
}

@Injectable({
  providedIn: 'root',
})
export class WorkshopServiceService {
  private apiUrl = 'https://korik-demo.runasp.net/api/WorkshopService';

  constructor(private http: HttpClient) {}

  /**
   * Create workshop services
   * Sends individual POST requests for each service configuration
   * Returns combined response when all requests complete
   */
  createWorkshopServices(services: WorkshopServiceCreateRequest[]): Observable<any> {
    console.log('=== WORKSHOP SERVICE API CALL ===');
    console.log('Total services to create:', services.length);

    if (services.length === 0) {
      return of({ success: true, message: 'No services to create', data: [] });
    }

    // Create individual POST requests for each service
    const requests = services.map((service, index) => {
      console.log(`Request ${index + 1}:`, {
        url: this.apiUrl,
        payload: service,
      });

      return this.http.post<WorkshopServiceAPIResponse>(this.apiUrl, service).pipe(
        map((response) => {
          console.log(`✓ Request ${index + 1} SUCCESS:`, response);
          return { ...response, success: true };
        }),
        catchError((error) => {
          console.error(`✗ Request ${index + 1} FAILED:`, {
            service,
            error: error.error,
            status: error.status,
            statusText: error.statusText,
            message: error.message,
          });
          return of({
            success: false,
            message: error.error?.message || error.message || 'Unknown error',
            data: null,
            error,
            failedService: service,
          });
        })
      );
    });

    // Wait for all requests to complete
    return forkJoin(requests).pipe(
      map((responses) => {
        const successCount = responses.filter((r: any) => r.success).length;
        const failedCount = responses.length - successCount;

        console.log('=== FINAL RESULTS ===');
        console.log(`Success: ${successCount}, Failed: ${failedCount}`);

        if (failedCount > 0) {
          const failedServices = responses
            .filter((r: any) => !r.success)
            .map((r: any) => r.failedService);
          console.error('Failed services:', failedServices);
        }

        return {
          success: failedCount === 0,
          message:
            failedCount === 0
              ? `Successfully created ${successCount} service record(s)`
              : `Created ${successCount} service(s), ${failedCount} failed`,
          data: responses,
          totalRequests: responses.length,
          successCount,
          failedCount,
        };
      })
    );
  }

  /**
   * Get all workshop services for a workshop profile
   * @param workShopProfileId - The workshop profile ID
   * @param pageNumber - Page number (default: 1)
   * @param pageSize - Number of items per page (default: 1000)
   */
  getWorkshopServices(
    workShopProfileId: number,
    pageNumber: number = 1,
    pageSize: number = 1000
  ): Observable<WorkshopServiceAPIResponse> {
    return this.http.get<WorkshopServiceAPIResponse>(
      `${this.apiUrl}/Get-Workshop-Services-By-Profile-ID?Id=${workShopProfileId}&PageNumber=${pageNumber}&PageSize=${pageSize}`
    );
  }

  /**
   * Update a workshop service
   */
  updateWorkshopService(
    id: number,
    service: Partial<WorkshopServiceCreateRequest>
  ): Observable<WorkshopServiceAPIResponse> {
    // PUT to base URL with ID in body (as per Swagger test)
    return this.http.put<WorkshopServiceAPIResponse>(`${this.apiUrl}`, service);
  }

  /**
   * Delete a workshop service
   */
  deleteWorkshopService(id: number): Observable<WorkshopServiceAPIResponse> {
    return this.http.delete<WorkshopServiceAPIResponse>(`${this.apiUrl}/${id}`);
  }

  /**
   * Group services by car origin for catalog display
   */
  groupServicesByOrigin(services: WorkshopServiceData[]): {
    [origin: string]: WorkshopServiceData[];
  } {
    return services.reduce((groups, service) => {
      const origin = service.origin || 'General';
      if (!groups[origin]) {
        groups[origin] = [];
      }
      groups[origin].push(service);
      return groups;
    }, {} as { [origin: string]: WorkshopServiceData[] });
  }

  /**
   * Get origin display name and icon
   */
  getOriginInfo(origin: string): { name: string; flag: string; color: string } {
    const originMap: { [key: string]: { name: string; flag: string; color: string } } = {
      General: { name: 'All Origins', flag: '🌍', color: '#6b7280' },
      Germany: { name: 'German', flag: '🇩🇪', color: '#ef4444' },
      Japan: { name: 'Japanese', flag: '🇯🇵', color: '#dc2626' },
      SouthKorea: { name: 'Korean', flag: '🇰🇷', color: '#0891b2' },
      USA: { name: 'American', flag: '🇺🇸', color: '#2563eb' },
      China: { name: 'Chinese', flag: '🇨🇳', color: '#dc2626' },
      France: { name: 'French', flag: '🇫🇷', color: '#3b82f6' },
      Italy: { name: 'Italian', flag: '🇮🇹', color: '#22c55e' },
      UK: { name: 'British', flag: '🇬🇧', color: '#3b82f6' },
      CzechRepublic: { name: 'Czech', flag: '🇨🇿', color: '#6366f1' },
      Sweden: { name: 'Swedish', flag: '🇸🇪', color: '#3b82f6' },
      Malaysia: { name: 'Malaysian', flag: '🇲🇾', color: '#eab308' },
    };
    return originMap[origin] || { name: origin, flag: '🚗', color: '#6b7280' };
  }
}
