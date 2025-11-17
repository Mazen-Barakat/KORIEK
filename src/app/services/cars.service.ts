import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { shareReplay, map } from 'rxjs/operators';

export interface MakeModels {
  make: string;
  models: string[];
}

@Injectable({
  providedIn: 'root'
})
export class CarsService {
  private jsonUrl = 'cars-data.json';
  private cache$!: Observable<MakeModels[]>;

  constructor(private http: HttpClient) {}

  getAllMakesAndModels(): Observable<MakeModels[]> {
    if (!this.cache$) {
      this.cache$ = this.http.get<MakeModels[]>(this.jsonUrl).pipe(
        shareReplay(1)
      );
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
  }): Observable<any> {
    const apiUrl = 'https://localhost:44316/api/Car';
    return this.http.post<any>(apiUrl, vehicleData);
  }

  // Check if a license plate is already in use. Returns Observable<boolean>
  // Note: Adjust the endpoint path if your backend exposes a different route.
  checkLicensePlate(licensePlate: string): Observable<boolean> {
    const url = `https://localhost:44316/api/Car/GetByLicensePlate?licensePlate=${encodeURIComponent(licensePlate)}`;
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
    const url = 'https://localhost:44316/api/CarOwnerProfile/profile-with-cars';
    return this.http.get<any>(url);
  }

  // Fetch specific car by id
  getCarById(id: number): Observable<any> {
    const url = `https://localhost:44316/api/Car/${id}`;
    return this.http.get<any>(url);
  }

  // Delete a car by id
  deleteCar(id: number): Observable<any> {
    const url = `https://localhost:44316/api/Car/${id}`;
    return this.http.delete<any>(url);
  }

  // Update specific car by id
  updateCar(id: number, payload: any): Observable<any> {
    const url = `https://localhost:44316/api/Car/${id}`;
    return this.http.put<any>(url, payload);
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
  }): Observable<any> {
    const url = 'https://localhost:44316/api/Car';
    return this.http.put<any>(url, payload);
  }
}
