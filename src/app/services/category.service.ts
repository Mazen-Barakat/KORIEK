import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { Category, CategoryResponse } from '../models/category.model';
import { Subcategory, SubcategoryResponse } from '../models/subcategory.model';
import { Service, ServiceResponse } from '../models/service.model';

@Injectable({
  providedIn: 'root'
})
export class CategoryService {
  private readonly apiBase = 'https://localhost:44316/api';
  private categoriesCache$?: Observable<Category[]>;
  private subcategoriesCache: Map<number, Observable<Subcategory[]>> = new Map();
  private servicesCache: Map<number, Observable<Service[]>> = new Map();

  constructor(private http: HttpClient) {}

  /**
   * Get all categories from the backend API
   * Uses caching to avoid multiple API calls
   */
  getCategories(): Observable<Category[]> {
    if (!this.categoriesCache$) {
      this.categoriesCache$ = this.http.get<CategoryResponse>(`${this.apiBase}/Category`).pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          return [];
        }),
        shareReplay(1),
        catchError(this.handleError)
      );
    }
    return this.categoriesCache$;
  }

  /**
   * Get subcategories for a specific category
   * @param categoryId The ID of the category
   * @returns Observable of subcategories array
   */
  getSubcategoriesByCategory(categoryId: number): Observable<Subcategory[]> {
    // Return cached result if available
    if (this.subcategoriesCache.has(categoryId)) {
      return this.subcategoriesCache.get(categoryId)!;
    }

    const subcategories$ = this.http.get<SubcategoryResponse>(`${this.apiBase}/Subcategory/ByCategory/${categoryId}`).pipe(
      map(response => {
        if (response.success && response.data) {
          return response.data;
        }
        return [];
      }),
      shareReplay(1),
      catchError(this.handleError)
    );

    this.subcategoriesCache.set(categoryId, subcategories$);
    return subcategories$;
  }

  /**
   * Clear the cache to force a fresh API call
   */
  clearCache(): void {
    this.categoriesCache$ = undefined;
    this.subcategoriesCache.clear();
    this.servicesCache.clear();
  }

  /**
   * Clear subcategories cache for a specific category
   */
  clearSubcategoryCache(categoryId: number): void {
    this.subcategoriesCache.delete(categoryId);
  }

  /**
   * Get services for a specific subcategory
   * @param subcategoryId The ID of the subcategory
   * @returns Observable of services array
   */
  getServicesBySubcategory(subcategoryId: number): Observable<Service[]> {
    // Return cached result if available
    if (this.servicesCache.has(subcategoryId)) {
      return this.servicesCache.get(subcategoryId)!;
    }

    const services$ = this.http.get<ServiceResponse>(`${this.apiBase}/Service/subcategory/${subcategoryId}`).pipe(
      map(response => {
        if (response.success && response.data) {
          return response.data;
        }
        return [];
      }),
      shareReplay(1),
      catchError(this.handleError)
    );

    this.servicesCache.set(subcategoryId, services$);
    return services$;
  }

  /**
   * Clear services cache for a specific subcategory
   */
  clearServiceCache(subcategoryId: number): void {
    this.servicesCache.delete(subcategoryId);
  }

  /**
   * Handle HTTP errors
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An error occurred while fetching categories';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
    }
    
    console.error('CategoryService Error:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}
