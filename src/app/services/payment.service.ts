import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import {
  CreatePaymentDTO,
  PaymentIntentResponse,
  PaymentDetailsResponse,
  PaymentDTO,
} from '../models/payment.model';

@Injectable({
  providedIn: 'root',
})
export class PaymentService {
  private readonly API_URL = 'https://localhost:44316/Payment';

  // Subject to track payment flow state
  private paymentFlowSubject = new BehaviorSubject<{
    active: boolean;
    bookingId?: number;
    amount?: number;
  }>({ active: false });

  public paymentFlow$ = this.paymentFlowSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Create a Stripe payment intent
   */
  createPaymentIntent(
    bookingId: number,
    totalAmount: number,
    token: string
  ): Observable<PaymentIntentResponse> {
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    const payload: CreatePaymentDTO = {
      bookingId,
      totalAmount,
    };

    console.log('📤 Sending payment intent request:', {
      endpoint: `${this.API_URL}/create-payment-intent`,
      bookingId,
      totalAmount,
    });

    return this.http
      .post<PaymentIntentResponse>(`${this.API_URL}/create-payment-intent`, payload, { headers })
      .pipe(
        map((response) => {
          console.log('✅ Payment intent response received:', response);
          if (!response.success) {
            console.error('❌ Backend returned success=false:', response.message);
          }
          return response;
        }),
        catchError((error) => {
          console.error('❌ HTTP Error creating payment intent:', {
            status: error.status,
            statusText: error.statusText,
            message: error.message,
            error: error.error,
          });
          throw error;
        })
      );
  }

  /**
   * Get payment details for a booking
   */
  getPaymentDetails(bookingId: number, token: string): Observable<PaymentDetailsResponse> {
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    return this.http
      .get<PaymentDetailsResponse>(`${this.API_URL}/booking/${bookingId}`, { headers })
      .pipe(
        map((response) => {
          console.log('📊 Payment details fetched:', response);
          return response;
        }),
        catchError((error) => {
          console.error('❌ Error fetching payment details:', error);
          throw error;
        })
      );
  }

  /**
   * Start payment flow
   */
  startPaymentFlow(bookingId: number, amount: number): void {
    this.paymentFlowSubject.next({
      active: true,
      bookingId,
      amount,
    });
  }

  /**
   * End payment flow
   */
  endPaymentFlow(): void {
    this.paymentFlowSubject.next({ active: false });
  }

  /**
   * Get current payment flow state
   */
  getPaymentFlowState() {
    return this.paymentFlowSubject.value;
  }

  /**
   * Calculate commission breakdown (for display purposes)
   */
  calculateCommissionBreakdown(totalAmount: number) {
    const commissionRate = 0.12; // 12%
    const commissionAmount = totalAmount * commissionRate;
    const workshopAmount = totalAmount - commissionAmount;

    return {
      totalAmount,
      commissionAmount,
      workshopAmount,
      commissionRate,
    };
  }

  /**
   * Confirm payment success on backend after Stripe confirmation
   */
  confirmPaymentSuccess(
    bookingId: number,
    paymentIntentId: string,
    token: string
  ): Observable<any> {
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    const payload = {
      bookingId,
      paymentIntentId,
      status: 'succeeded',
    };

    console.log('✅ Confirming payment success on backend:', {
      endpoint: `${this.API_URL}/confirm-payment`,
      payload,
    });

    return this.http.post<any>(`${this.API_URL}/confirm-payment`, payload, { headers }).pipe(
      map((response) => {
        console.log('✅ Payment confirmed on backend:', response);
        return response;
      }),
      catchError((error) => {
        console.error('❌ HTTP Error confirming payment:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          error: error.error,
        });
        throw error;
      })
    );
  }
}
