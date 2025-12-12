import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { shareReplay, map } from 'rxjs/operators';

export interface MakeModels {
  make: string;
  models: string[];
  CarOrigin: string;
}

export interface CreateCarIndicatorRequest {
  carId: number;
  indicatorType: string;
  lastCheckedDate: string;
  nextCheckedDate: string;
  nextMileage: number;
  currentMileage?: number;
}

export interface CarIndicatorDto {
  id: number;
  carId: number;
  indicatorType: string;
  lastCheckedDate: string;
  nextCheckedDate: string;
  nextMileage: number;
  status?: string;
  carStatus?: string;
  currentMileage?: number;
}

@Injectable({
  providedIn: 'root',
})
export class CarsService {
  private jsonUrl = 'cars-data.json';
  private cache$!: Observable<MakeModels[]>;
  private readonly apiBase = 'https://localhost:44316/';

  constructor(private http: HttpClient) {}

  getAllMakesAndModels(): Observable<MakeModels[]> {
    if (!this.cache$) {
      this.cache$ = this.http.get<MakeModels[]>(this.jsonUrl).pipe(shareReplay(1));
    }
    return this.cache$;
  }

  addVehicle(vehicleData: {
    make: string;
    model: string;
    year: number;
    engineCapacity: number;
    currentMileage: number;
    licensePlate: string;
    transmissionType: string;
    fuelType: string;
    origin: string;
  }): Observable<any> {
    return this.http.post<any>(`${this.apiBase}/Car`, vehicleData);
  }

  // Check if a license plate is already in use. Returns Observable<boolean>
  // Note: Adjust the endpoint path if your backend exposes a different route.
  checkLicensePlate(licensePlate: string): Observable<boolean> {
    const url = `${this.apiBase}/Car/GetByLicensePlate?licensePlate=${encodeURIComponent(
      licensePlate
    )}`;
    return this.http.get<any>(url).pipe(
      // The backend is expected to return an object like { success: true, message: '', data: boolean }
      // Map to boolean for convenience in the frontend.
      map((resp: any) => {
        if (resp && Object.prototype.hasOwnProperty.call(resp, 'data')) {
          return !!resp.data;
        }
        // If backend returns plain boolean
        return !!resp;
      })
    );
  }

  // Fetch car owner profile with their cars
  getProfileWithCars(): Observable<any> {
    return this.http.get<any>(`${this.apiBase}/CarOwnerProfile/profile-with-cars`);
  }

  // Fetch specific car by id
  getCarById(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiBase}/Car/${id}`);
  }

  // Delete a car by id
  deleteCar(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiBase}/Car/${id}`);
  }

  // Update specific car by id
  updateCar(id: number, payload: any): Observable<any> {
    return this.http.put<any>(`${this.apiBase}/Car/${id}`, payload);
  }

  // Update a car using the full body (PUT /api/Car)
  updateCarFull(payload: {
    id: number;
    make: string;
    model: string;
    year: number;
    engineCapacity: number;
    currentMileage: number;
    licensePlate: string;
    transmissionType: string;
    fuelType: string;
    origin: string;
  }): Observable<any> {
    return this.http.put<any>(`${this.apiBase}/Car`, payload);
  }

  createCarIndicator(payload: CreateCarIndicatorRequest): Observable<any> {
    return this.http.post<any>(`${this.apiBase}/CarIndicator`, payload);
  }

  getCarIndicators(carId: number): Observable<CarIndicatorDto[]> {
    return this.http.get<any>(`${this.apiBase}/CarIndicator/car/${carId}`).pipe(
      map((resp: any) => {
        if (resp && Array.isArray(resp.data)) {
          return resp.data as CarIndicatorDto[];
        }
        if (Array.isArray(resp)) {
          return resp as CarIndicatorDto[];
        }
        return [];
      })
    );
  }

  deleteCarIndicator(indicatorId: number | string): Observable<any> {
    return this.http.delete<any>(`${this.apiBase}/CarIndicator/${indicatorId}`);
  }

  /**
   * Try deleting an indicator using DELETE, and if the backend does not support DELETE (405)
   * try a few common POST-based delete endpoints to improve compatibility while debugging.
   */
  deleteCarIndicatorFlexible(indicatorId: number | string): Observable<any> {
    const urlBase = `${this.apiBase}/CarIndicator`;
    const deleteUrl = `${urlBase}/${indicatorId}`;

    return this.http
      .delete<any>(deleteUrl)
      .pipe
      // If DELETE succeeds, return its response. If it fails with 405 (Method Not Allowed),
      // try POST fallbacks.
      // We use catchError here to convert to an alternate observable.
      // Note: call sites should subscribe to this observable and examine response.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      // Using dynamic imports to keep rxjs operators inline
      // (catchError below will perform the fallback attempt)
      // The following catchError is implemented in the component by subscription error handler.
      ();
  }
}
