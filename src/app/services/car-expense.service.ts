import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export type ExpenseType = 'Fuel' | 'Maintainance' | 'Repair' | 'Insurance' | 'Other';

export interface CreateCarExpenseRequest {
  amount: number;
  description: string;
  expenseDate: string; // yyyy-MM-dd
  expenseType: ExpenseType;
  carId: number;
}

export interface CarExpenseDto {
  id: number;
  amount: number;
  description: string;
  expenseDate: string;
  expenseType: ExpenseType;
  carId: number;
}

@Injectable({ providedIn: 'root' })
export class CarExpenseService {
  private readonly baseUrl = 'https://localhost:44316/api';

  constructor(private http: HttpClient) {}

  addExpense(payload: CreateCarExpenseRequest): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/CarExpense`, payload);
  }

  getByCarId(carId: number): Observable<CarExpenseDto[]> {
    return this.http.get<any>(`${this.baseUrl}/CarExpense/ByCarId/${carId}`).pipe(
      map((resp: any) => {
        // Backend might wrap data or return array directly
        if (resp && Array.isArray(resp.data)) return resp.data as CarExpenseDto[];
        if (Array.isArray(resp)) return resp as CarExpenseDto[];
        return [];
      })
    );
  }

  deleteExpense(id: number): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/CarExpense/${id}`);
  }
}
