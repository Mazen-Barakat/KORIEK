import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  BookingApiResponse,
  WorkshopApiResponse,
  ReviewApiResponse,
  ReviewSubmitDto,
} from '../models/review.model';

@Injectable({
  providedIn: 'root',
})
export class ReviewService {
  private readonly apiUrl = 'https://localhost:44316/api';

  constructor(private http: HttpClient) {}

  /**
   * Get booking details by ID
   * GET https://localhost:44316/api/Booking/{id}
   */
  getBookingById(bookingId: number): Observable<BookingApiResponse> {
    return this.http.get<BookingApiResponse>(`${this.apiUrl}/Booking/${bookingId}`);
  }

  /**
   * Get workshop profile details by ID
   * GET https://localhost:44316/api/WorkShopProfile/Get-WorkShop-ById-Profile?id={id}
   */
  getWorkshopById(workshopId: number): Observable<WorkshopApiResponse> {
    return this.http.get<WorkshopApiResponse>(
      `${this.apiUrl}/WorkShopProfile/Get-WorkShop-ById-Profile?id=${workshopId}`
    );
  }

  /**
   * Get car owner profile by booking ID
   * GET https://localhost:44316/api/CarOwnerProfile/by-booking/{bookingId}
   */
  getCarOwnerProfileByBooking(bookingId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/CarOwnerProfile/by-booking/${bookingId}`);
  }

  /**
   * Submit a new review
   * POST https://localhost:44316/api/Review
   */
  createReview(review: ReviewSubmitDto): Observable<ReviewApiResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });

    return this.http.post<ReviewApiResponse>(`${this.apiUrl}/Review`, review, { headers });
  }

  /**
   * Update booking paid amount
   * This may need to be called after review submission if paidAmount needs separate update
   * PUT https://localhost:44316/api/Booking/Update-Paid-Amount (assuming this endpoint exists)
   */
  updateBookingPaidAmount(bookingId: number, paidAmount: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/Booking/Update-Paid-Amount`, {
      bookingId,
      paidAmount,
    });
  }
}
