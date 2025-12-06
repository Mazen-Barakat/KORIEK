// Enhanced Booking Notification Service

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, interval } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { 
  EnhancedBookingNotification, 
  BookingResponseStatus,
  canChangeBookingResponse,
  generateBookingReference 
} from '../models/enhanced-booking-notification.model';

@Injectable({
  providedIn: 'root'
})
export class EnhancedBookingService {
  private apiUrl = 'https://localhost:44316/api';
  
  // Store bookings with precise timing
  private bookingsSubject = new BehaviorSubject<Map<number, EnhancedBookingNotification>>(new Map());
  public bookings$ = this.bookingsSubject.asObservable();
  
  // Track which bookings need confirmation modal
  private modalTriggersSubject = new BehaviorSubject<number[]>([]);
  public modalTriggers$ = this.modalTriggersSubject.asObservable();

  constructor(private http: HttpClient) {
    // Start precision timer check (every second)
    this.startPrecisionTimerCheck();
  }

  /**
   * Fetch booking with complete details
   */
  getBookingDetails(bookingId: number): Observable<EnhancedBookingNotification> {
    return this.http.get<any>(`${this.apiUrl}/Booking/${bookingId}/details`).pipe(
      map(response => this.mapToEnhancedNotification(response.data || response)),
      catchError(error => {
        console.error('Error fetching booking details:', error);
        throw error;
      })
    );
  }

  /**
   * Change booking response (Accept/Decline) - can be toggled before appointment time
   */
  changeBookingResponse(
    bookingId: number,
    newStatus: BookingResponseStatus,
    userRole: 'workshop' | 'customer'
  ): Observable<any> {
    return this.http.put(`${this.apiUrl}/Booking/${bookingId}/response`, {
      responseStatus: newStatus,
      changedBy: userRole
    }).pipe(
      map(response => {
        // Update local cache
        this.updateLocalBookingStatus(bookingId, newStatus);
        return response;
      })
    );
  }

  /**
   * Check if booking appointment time has arrived (precise to the second)
   */
  checkBookingTimeStatus(bookingId: number): Observable<{
    hasArrived: boolean;
    secondsUntilArrival: number;
    exactArrivalTime: Date;
    canStillChangeResponse: boolean;
  }> {
    return this.http.get<any>(`${this.apiUrl}/Booking/${bookingId}/time-status`);
  }

  /**
   * Start precision timer that checks every second for appointment arrivals
   * This ensures modals appear EXACTLY at booking time (not before)
   */
  private startPrecisionTimerCheck(): void {
    interval(1000).subscribe(() => {
      const now = new Date();
      const bookings = this.bookingsSubject.value;
      const triggeredBookings: number[] = [];

      bookings.forEach((booking, bookingId) => {
        const appointmentTime = new Date(booking.exactAppointmentTime);
        const timeDiff = appointmentTime.getTime() - now.getTime();
        
        // Don't trigger modal if booking is already in progress or completed
        const shouldSkip = booking.jobStatus === 'in-progress' || 
                           booking.jobStatus === 'completed' || 
                           booking.jobStatus === 'ready' ||
                           booking.jobStatus === 'cancelled' ||
                           booking.bothConfirmed === true || // Both parties confirmed
                           booking.status === 'InProgress'; // Backend status is InProgress
        
        // STRICT: Only trigger when time has arrived and within 30 seconds (0.5 minutes) window
        // timeDiff is in milliseconds, negative means time has passed
        const hasTimeArrived = timeDiff <= 0 && timeDiff >= -30000; // 30 seconds = 30000ms
        
        if (hasTimeArrived && !booking.hasAppointmentTimePassed && !shouldSkip) {
          console.log(`🎯 PRECISE TRIGGER: Booking ${booking.bookingReference} appointment time has arrived! (${Math.abs(timeDiff)}ms past, ${(Math.abs(timeDiff) / 60000).toFixed(2)} minutes)`);
          triggeredBookings.push(bookingId);
          
          // Mark as triggered
          booking.hasAppointmentTimePassed = true;
          booking.shouldShowConfirmationModal = true;
        }
      });

      if (triggeredBookings.length > 0) {
        this.modalTriggersSubject.next(triggeredBookings);
      }
    });
  }

  /**
   * Update local booking cache
   */
  private updateLocalBookingStatus(bookingId: number, newStatus: BookingResponseStatus): void {
    const bookings = this.bookingsSubject.value;
    const booking = bookings.get(bookingId);
    
    if (booking) {
      booking.responseStatus = newStatus;
      booking.lastResponseChangedAt = new Date();
      booking.canChangeResponse = canChangeBookingResponse(
        newStatus,
        booking.exactAppointmentTime,
        'workshop' // Adjust based on actual user role
      );
      
      bookings.set(bookingId, booking);
      this.bookingsSubject.next(bookings);
    }
  }

  /**
   * Map backend response to EnhancedBookingNotification
   */
  private mapToEnhancedNotification(data: any): EnhancedBookingNotification {
    const appointmentTime = new Date(data.exactAppointmentTime || data.appointmentDate);
    const now = new Date();
    const timeUntilAppointment = Math.floor((appointmentTime.getTime() - now.getTime()) / 1000);

    return {
      id: data.id,
      bookingId: data.bookingId || data.id,
      bookingReference: data.bookingReference || generateBookingReference(data.id),
      
      // Customer info
      customerName: data.customerName || 'Unknown Customer',
      customerPhone: data.customerPhone || '',
      customerPhoto: data.customerPhoto,
      
      // Vehicle info
      vehicleInfo: data.vehicleInfo || `${data.vehicleYear} ${data.vehicleMake} ${data.vehicleModel} - ${data.vehiclePlateNumber}`,
      vehicleMake: data.vehicleMake || '',
      vehicleModel: data.vehicleModel || '',
      vehicleYear: data.vehicleYear || new Date().getFullYear(),
      vehiclePlateNumber: data.vehiclePlateNumber || '',
      
      // Service info
      serviceType: data.serviceType || data.serviceName || 'General Service',
      serviceList: data.serviceList || [data.serviceName || 'Service'],
      estimatedDuration: data.estimatedDuration || 60,
      estimatedCost: data.estimatedCost || data.totalCost || 0,
      
      // Timing
      exactAppointmentTime: appointmentTime,
      appointmentTimeSeconds: appointmentTime.getTime(),
      createdAt: new Date(data.createdAt),
      
      // Workshop info
      workshopName: data.workshopName,
      workshopAddress: data.workshopAddress,
      workshopPhone: data.workshopPhone,
      
      // Job status
      jobStatus: data.jobStatus || data.status,
      status: data.status,
      
      // Confirmation status - Reset to false if booking is InProgress
      carOwnerConfirmed: (data.status === 'InProgress' || data.jobStatus === 'in-progress') ? false : data.carOwnerConfirmed,
      workshopConfirmed: (data.status === 'InProgress' || data.jobStatus === 'in-progress') ? false : data.workshopConfirmed,
      hasCurrentUserConfirmed: (data.status === 'InProgress' || data.jobStatus === 'in-progress') ? false : (data.hasCurrentUserConfirmed || false),
      bothConfirmed: (data.status === 'InProgress' || data.jobStatus === 'in-progress') ? false : (data.bothConfirmed || false),
      confirmationSentAt: data.confirmationSentAt ? new Date(data.confirmationSentAt) : undefined,
      confirmationDeadline: data.confirmationDeadline ? new Date(data.confirmationDeadline) : undefined,
      
      // Response status
      responseStatus: data.responseStatus || BookingResponseStatus.Pending,
      canChangeResponse: canChangeBookingResponse(
        data.responseStatus || BookingResponseStatus.Pending,
        appointmentTime,
        'workshop'
      ),
      lastResponseChangedAt: data.lastResponseChangedAt ? new Date(data.lastResponseChangedAt) : undefined,
      responseChangedBy: data.responseChangedBy,
      
      // Notification metadata
      notificationType: data.notificationType || 0,
      priority: data.priority || 'high',
      isRead: data.isRead || false,
      
      // Time-based logic
      timeUntilAppointment: timeUntilAppointment,
      hasAppointmentTimePassed: timeUntilAppointment <= 0,
      shouldShowConfirmationModal: false
    };
  }

  /**
   * Add booking to precision tracking
   */
  addBookingToTracking(booking: EnhancedBookingNotification): void {
    const bookings = this.bookingsSubject.value;
    bookings.set(booking.bookingId, booking);
    this.bookingsSubject.next(bookings);
    
    console.log(`📍 Tracking booking ${booking.bookingReference} - Appointment at ${booking.exactAppointmentTime.toISOString()}`);
  }

  /**
   * Remove booking from tracking (after confirmation or cancellation)
   */
  removeBookingFromTracking(bookingId: number): void {
    const bookings = this.bookingsSubject.value;
    bookings.delete(bookingId);
    this.bookingsSubject.next(bookings);
  }

  /**
   * Get all bookings awaiting response
   */
  getBookingsAwaitingResponse(): EnhancedBookingNotification[] {
    const bookings = this.bookingsSubject.value;
    return Array.from(bookings.values()).filter(b => 
      (b.responseStatus === BookingResponseStatus.Pending ||
       b.responseStatus === BookingResponseStatus.Declined) &&
      b.jobStatus !== 'in-progress' &&
      b.jobStatus !== 'completed' &&
      b.jobStatus !== 'ready' &&
      b.jobStatus !== 'cancelled' &&
      b.bothConfirmed !== true &&
      b.status !== 'InProgress'
    );
  }

  /**
   * Get confirmation status for a booking
   */
  getConfirmationStatus(bookingId: number): Observable<{
    bookingId: number;
    carOwnerConfirmed: boolean;
    workshopConfirmed: boolean;
    bothConfirmed: boolean;
    status: string;
    confirmationSentAt: Date;
    confirmationDeadline: Date;
    remainingSeconds: number;
  }> {
    return this.http.get<any>(`${this.apiUrl}/Booking/${bookingId}/confirmation-status`).pipe(
      map(response => response.data || response)
    );
  }

  /**
   * Confirm appointment arrival
   */
  confirmAppointment(bookingId: number, isConfirmed: boolean): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/Booking/confirm-appointment`, {
      bookingId: bookingId,
      isConfirmed: isConfirmed
    }).pipe(
      map(response => {
        // If both confirmed, update job status to InProgress and remove from tracking
        if (response.data?.status === 'InProgress' || response.data?.bothConfirmed === true) {
          this.updateLocalBookingJobStatus(bookingId, 'in-progress');
          // Remove from tracking to prevent dialog from showing again
          this.removeBookingFromTracking(bookingId);
          console.log(`✅ Both parties confirmed. Removed booking ${bookingId} from tracking.`);
        }
        return response;
      })
    );
  }

  /**
   * Update local booking job status
   */
  private updateLocalBookingJobStatus(bookingId: number, jobStatus: string): void {
    const bookings = this.bookingsSubject.value;
    const booking = bookings.get(bookingId);
    
    if (booking) {
      booking.jobStatus = jobStatus;
      booking.status = jobStatus === 'in-progress' ? 'InProgress' : booking.status;
      bookings.set(bookingId, booking);
      this.bookingsSubject.next(bookings);
    }
  }

  /**
   * Format time remaining until appointment
   */
  formatTimeRemaining(seconds: number): string {
    if (seconds <= 0) return 'Time arrived';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }
}
