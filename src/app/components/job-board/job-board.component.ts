import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, forkJoin, of, Observable } from 'rxjs';
import { takeUntil, switchMap, map, catchError } from 'rxjs/operators';
import { BookingService, BookingResponse } from '../../services/booking.service';
import { WorkshopProfileService } from '../../services/workshop-profile.service';
import { CarsService } from '../../services/cars.service';
import { Job, JobStatus } from '../../models/booking.model';
import { HttpClient } from '@angular/common/http';
import { ConfirmationPopupComponent } from '../shared/confirmation-popup/confirmation-popup.component';
import { ToastService } from '../../services/toast.service';
import { NotificationType } from '../../models/notification.model';

// Interface for real booking with enriched data
export interface RealBooking {
  id: number;
  status: string;
  appointmentDate: Date;
  issueDescription: string;
  paymentMethod: string;
  carId: number;
  workshopServiceId: number;
  // Enriched data
  customerName: string;
  customerAvatar?: string;
  carMake: string;
  carModel: string;
  carYear: number;
  carLicensePlate: string;
  serviceName: string;
  urgency: string;
  createdAt?: Date;
}

// Interface for car owner profile from API
interface CarOwnerProfile {
  id?: number;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  profileImageUrl?: string;
  country?: string;
  governorate?: string;
  city?: string;
}

@Component({
  selector: 'app-job-board',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ConfirmationPopupComponent],
  templateUrl: './job-board.component.html',
  styleUrls: ['./job-board.component.css']
})
export class JobBoardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private apiUrl = 'https://localhost:44316/api';
  // Retry control for defensive re-loading when initial load returns empty
  private tryLoadRetries = 0;
  private readonly maxLoadRetries = 3;

  selectedTab: JobStatus = 'new';
  viewMode: 'kanban' | 'list' = 'kanban';

  // Real bookings from API
  workshopProfileId: number = 0;
  realBookings: RealBooking[] = [];
  isLoadingRealBookings = false;

  // Categorized real bookings by status
  pendingBookings: RealBooking[] = [];      // new requests (Pending)
  acceptedBookings: RealBooking[] = [];     // upcoming (Accepted)
  inProgressBookings: RealBooking[] = [];   // in progress
  readyForPickupBookings: RealBooking[] = []; // ready for pickup
  completedBookings: RealBooking[] = [];    // completed

  // Keep mock jobs for backward compatibility (will be phased out)
  jobs: Job[] = [];
  newJobs: Job[] = [];
  upcomingJobs: Job[] = [];
  inProgressJobs: Job[] = [];
  readyJobs: Job[] = [];
  completedJobs: Job[] = [];

  searchQuery: string = '';
  filterUrgency: string = 'all';

  draggedJob: Job | null = null;

  // Confirmation popup state
  showDeclineConfirmation: boolean = false;
  bookingToDecline: RealBooking | null = null;

  // Accordion state - track which booking cards are expanded
  expandedBookings: Set<number> = new Set();

  constructor(
    private bookingService: BookingService,
    private workshopProfileService: WorkshopProfileService,
    private carsService: CarsService,
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    // Check for tab query param
    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        this.selectedTab = params['tab'] as JobStatus;
      }
    });

    // Load workshop profile first, then load real bookings
    this.loadWorkshopProfileAndBookings();

    // Keep mock jobs for backward compatibility
    this.loadJobs();

    // Listen for booking status changes triggered elsewhere (e.g., from notifications)
    window.addEventListener('booking:status-changed', this.onExternalBookingStatusChanged as EventListener);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    window.removeEventListener('booking:status-changed', this.onExternalBookingStatusChanged as EventListener);
  }

  // Handler for external booking status change events
  private onExternalBookingStatusChanged = (event: any): void => {
    try {
      const detail = event?.detail || {};
      const status = detail.status || '';
      // Refresh bookings to pick up the change
      this.loadRealBookings();
      // If a booking was confirmed, switch to Upcoming tab so user sees it immediately
      if (status && status.toLowerCase() === 'confirmed') {
        this.selectedTab = 'upcoming';
      }
    } catch (e) {
      console.error('Error handling external booking status change event', e);
    }
  }

  private loadWorkshopProfileAndBookings(): void {
    this.isLoadingRealBookings = true;
    this.workshopProfileService.getMyWorkshopProfile()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (resp: any) => {
          const data = resp?.data ?? resp;
          if (data && data.id) {
            this.workshopProfileId = Number(data.id);
            console.log('Workshop Profile ID loaded:', this.workshopProfileId);
            this.loadRealBookings();
          } else {
            console.error('No workshop profile ID found in response:', resp);
            this.isLoadingRealBookings = false;
          }
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error loading workshop profile:', err);
          this.isLoadingRealBookings = false;
          this.cdr.detectChanges();
        }
      });
  }

  private loadRealBookings(): void {
    if (!this.workshopProfileId) {
      console.warn('Workshop profile ID not available yet');
      return;
    }

    this.isLoadingRealBookings = true;

    this.bookingService.getBookingsByWorkshop(this.workshopProfileId)
      .pipe(
        takeUntil(this.destroy$),
        switchMap((bookings: BookingResponse[]) => {
          if (!bookings || bookings.length === 0) {
            return of([]);
          }

          // For each booking, fetch car owner profile and car details
          const enrichedRequests = bookings.map(booking => {
            const carOwnerRequest = this.getCarOwnerByBookingId(booking.id);
            const carRequest = this.carsService.getCarById(booking.carId);
            const serviceRequest = this.getServiceName(booking.workshopServiceId);

            return forkJoin({
              carOwner: carOwnerRequest,
              car: carRequest,
              serviceName: serviceRequest
            }).pipe(
              map(({ carOwner, car, serviceName }) => {
                const carData = car?.data ?? car;
                return {
                  id: booking.id,
                  status: booking.status,
                  appointmentDate: new Date(booking.appointmentDate),
                  issueDescription: booking.issueDescription || '',
                  paymentMethod: booking.paymentMethod,
                  carId: booking.carId,
                  workshopServiceId: booking.workshopServiceId,
                  customerName: carOwner ? `${carOwner.firstName || ''} ${carOwner.lastName || ''}`.trim() || 'Unknown Customer' : 'Unknown Customer',
                  customerAvatar: carOwner?.profileImageUrl ? `https://localhost:44316${carOwner.profileImageUrl}` : undefined,
                  carMake: carData?.make || 'Unknown',
                  carModel: carData?.model || 'Unknown',
                  carYear: carData?.year || 0,
                  carLicensePlate: carData?.licensePlate || '',
                  serviceName: serviceName || 'Service',
                  urgency: this.determineUrgency(new Date(booking.appointmentDate)),
                  createdAt: booking.createdAt ? new Date(booking.createdAt) : undefined
                } as RealBooking;
              }),
              catchError(() => of({
                id: booking.id,
                status: booking.status,
                appointmentDate: new Date(booking.appointmentDate),
                issueDescription: booking.issueDescription || '',
                paymentMethod: booking.paymentMethod,
                carId: booking.carId,
                workshopServiceId: booking.workshopServiceId,
                customerName: 'Unknown Customer',
                carMake: 'Unknown',
                carModel: 'Unknown',
                carYear: 0,
                carLicensePlate: '',
                serviceName: 'Service',
                urgency: 'normal'
              } as RealBooking))
            );
          });

          return forkJoin(enrichedRequests);
        })
      )
      .subscribe({
        next: (enrichedBookings) => {
          this.realBookings = enrichedBookings;
          this.categorizeRealBookings();
          this.isLoadingRealBookings = false;
          console.log('Bookings loaded successfully:', enrichedBookings.length);
          console.log('Categorized - Pending:', this.pendingBookings.length,
                      'Accepted:', this.acceptedBookings.length,
                      'InProgress:', this.inProgressBookings.length,
                      'Completed:', this.completedBookings.length);
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error loading real bookings:', err);
          this.isLoadingRealBookings = false;
          this.cdr.detectChanges();
        }
      });
  }

  private getCarOwnerByBookingId(bookingId: number): Observable<CarOwnerProfile | null> {
    return this.http.get<any>(`${this.apiUrl}/CarOwnerProfile/by-booking/${bookingId}`).pipe(
      map(response => (response?.data || response) as CarOwnerProfile),
      catchError(() => of(null))
    );
  }

  private getServiceName(workshopServiceId: number): any {
    return this.http.get<any>(`${this.apiUrl}/WorkshopService/${workshopServiceId}`).pipe(
      switchMap((wsResponse: any) => {
        const wsData = wsResponse?.data || wsResponse;
        const serviceId = wsData?.serviceId;
        if (serviceId) {
          return this.http.get<any>(`${this.apiUrl}/Service/${serviceId}`).pipe(
            map(svcResponse => {
              const svcData = svcResponse?.data || svcResponse;
              return svcData?.name || 'Service';
            }),
            catchError(() => of('Service'))
          );
        }
        return of(wsData?.name || 'Service');
      }),
      catchError(() => of('Service'))
    );
  }

  private determineUrgency(appointmentDate: Date): string {
    const now = new Date();
    const diffHours = (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (diffHours < 24) return 'urgent';
    if (diffHours < 48) return 'high';
    if (diffHours < 72) return 'normal';
    return 'low';
  }

  private categorizeRealBookings(): void {
    // Ensure arrays are initialized
    this.pendingBookings = [];
    this.acceptedBookings = [];
    this.inProgressBookings = [];
    this.readyForPickupBookings = [];
    this.completedBookings = [];

    // Categorize bookings by status
    this.realBookings.forEach(booking => {
      const status = booking.status.toLowerCase().trim();

      if (status === 'pending') {
        this.pendingBookings.push(booking);
      } else if (status === 'accepted' || status === 'confirmed') {
        this.acceptedBookings.push(booking);
      } else if (status === 'inprogress' || status === 'in-progress' || status === 'in progress') {
        this.inProgressBookings.push(booking);
      } else if (status === 'readyforpickup' || status === 'ready-for-pickup' || status === 'ready for pickup') {
        this.readyForPickupBookings.push(booking);
      } else if (status === 'completed') {
        this.completedBookings.push(booking);
      } else {
        console.warn('Unknown booking status:', booking.status, 'for booking:', booking.id);
      }
    });

    console.log('Bookings categorized:', {
      pending: this.pendingBookings.length,
      accepted: this.acceptedBookings.length,
      inProgress: this.inProgressBookings.length,
      readyForPickup: this.readyForPickupBookings.length,
      completed: this.completedBookings.length
    });
  }

  // Confirm a booking (accept it)
  confirmBooking(booking: RealBooking, event: Event): void {
    event.stopPropagation();

    // Immediately update UI: remove from pending, add to accepted
    this.pendingBookings = this.pendingBookings.filter(b => b.id !== booking.id);
    const confirmedBooking = { ...booking, status: 'Confirmed' };
    this.acceptedBookings = [confirmedBooking, ...this.acceptedBookings];

    // Switch to upcoming tab so user sees the confirmed booking immediately
    this.selectedTab = 'upcoming';

    this.http.put(`${this.apiUrl}/Booking/Update-Booking-Status`, { id: booking.id, status: 'Confirmed' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          console.log(`Booking ${booking.id} confirmed`);
          // Show success toast
          this.toastService.success(
            'Booking Confirmed',
            `Booking from ${booking.customerName} for ${booking.carMake} ${booking.carModel} has been accepted`
          );
          // Reload bookings to ensure data consistency with backend
          this.loadRealBookings();
          // Trigger change detection to refresh UI
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error confirming booking:', err);
          this.toastService.error('Error', 'Failed to confirm booking');
          // Revert UI changes on error
          this.acceptedBookings = this.acceptedBookings.filter(b => b.id !== booking.id);
          this.pendingBookings = [booking, ...this.pendingBookings];
          this.selectedTab = 'new';
          this.cdr.detectChanges();
        }
      });
  }

  // Decline a booking (reject it) - shows confirmation popup first
  declineBooking(booking: RealBooking, event: Event): void {
    event.stopPropagation();
    this.bookingToDecline = booking;
    this.showDeclineConfirmation = true;
  }

  // Handle decline confirmation from popup
  onDeclineConfirmed(): void {
    if (!this.bookingToDecline) return;

    const booking = this.bookingToDecline;

    // Immediately update UI: remove from pending
    this.pendingBookings = this.pendingBookings.filter(b => b.id !== booking.id);

    this.http.put(`${this.apiUrl}/Booking/Update-Booking-Status`, { id: booking.id, status: 'Rejected' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          console.log(`Booking ${booking.id} declined`);
          // Show success toast
          this.toastService.success(
            'Booking Declined',
            `Booking request from ${booking.customerName} has been declined`
          );
          // Reload bookings to ensure data consistency with backend
          this.loadRealBookings();
          // Trigger change detection to refresh UI
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error declining booking:', err);
          this.toastService.error('Error', 'Failed to decline booking');
          // Revert UI changes on error
          this.pendingBookings = [booking, ...this.pendingBookings];
          this.cdr.detectChanges();
        }
      });

    // Close popup and reset state
    this.showDeclineConfirmation = false;
    this.bookingToDecline = null;
  }

  // Handle decline cancellation from popup
  onDeclineCancelled(): void {
    this.showDeclineConfirmation = false;
    this.bookingToDecline = null;
  }

  // Mark an in-progress booking as ready for pickup
  markAsReady(booking: RealBooking, event: Event): void {
    event.stopPropagation();

    // Immediately update UI: remove from in-progress, add to ready for pickup
    this.inProgressBookings = this.inProgressBookings.filter(b => b.id !== booking.id);
    const readyBooking = { ...booking, status: 'ReadyForPickup' };
    this.readyForPickupBookings = [readyBooking, ...this.readyForPickupBookings];

    // Switch to ready tab so user sees the booking immediately
    this.selectedTab = 'ready';

    this.http.put(`${this.apiUrl}/Booking/Update-Booking-Status`, { id: booking.id, status: 'ReadyForPickup' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          console.log(`Booking ${booking.id} marked as ready for pickup`);
          // Show success toast
          this.toastService.success(
            'Ready for Pickup',
            `${booking.customerName}'s ${booking.carMake} ${booking.carModel} is ready!`
          );
          // Reload bookings to ensure data consistency with backend
          this.loadRealBookings();
          // Trigger change detection to refresh UI
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error marking booking as ready:', err);
          this.toastService.error('Error', 'Failed to mark booking as ready');
          // Revert UI changes on error
          this.readyForPickupBookings = this.readyForPickupBookings.filter(b => b.id !== booking.id);
          this.inProgressBookings = [booking, ...this.inProgressBookings];
          this.selectedTab = 'in-progress';
          this.cdr.detectChanges();
        }
      });
  }

  // Complete a booking (mark as completed after pickup)
  completeBooking(booking: RealBooking, event: Event): void {
    event.stopPropagation();

    // Immediately update UI: remove from ready for pickup, add to completed
    this.readyForPickupBookings = this.readyForPickupBookings.filter(b => b.id !== booking.id);
    const completedBooking = { ...booking, status: 'Completed' };
    this.completedBookings = [completedBooking, ...this.completedBookings];

    // Switch to completed tab so user sees the booking immediately
    this.selectedTab = 'completed';

    this.http.put(`${this.apiUrl}/Booking/Update-Booking-Status`, { id: booking.id, status: 'Completed' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          console.log(`Booking ${booking.id} completed`);
          // Show success toast
          this.toastService.success(
            'Booking Completed',
            `Service for ${booking.customerName}'s ${booking.carMake} ${booking.carModel} has been completed!`
          );
          // Reload bookings to ensure data consistency with backend
          this.loadRealBookings();
          // Trigger change detection to refresh UI
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error completing booking:', err);
          this.toastService.error('Error', 'Failed to complete booking');
          // Revert UI changes on error
          this.completedBookings = this.completedBookings.filter(b => b.id !== booking.id);
          this.readyForPickupBookings = [booking, ...this.readyForPickupBookings];
          this.selectedTab = 'ready';
          this.cdr.detectChanges();
        }
      });
  }

  // Notify customer that their vehicle is ready for pickup
  notifyCustomer(booking: RealBooking, event: Event): void {
    event.stopPropagation();

    // Update booking with same ReadyForPickup status to trigger notification to car owner
    this.http.put(`${this.apiUrl}/Booking/Update-Booking-Status`, {
      id: booking.id,
      status: 'ReadyForPickup'
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          console.log(`Customer notified for booking ${booking.id} - vehicle ready for pickup`);
          this.toastService.success(
            'Customer Notified ✅',
            `${booking.customerName} has been notified that their ${booking.carMake} ${booking.carModel} is ready for pickup!`
          );
        },
        error: (err) => {
          console.error('Error notifying customer:', err);
          this.toastService.error('Notification Failed', 'Failed to send notification to customer. Please try again.');
        }
      });
  }

  // View booking details
  viewBookingDetails(booking: RealBooking): void {
    this.router.navigate(['/workshop/job', booking.id.toString()]);
  }

  private loadJobs(): void {
    this.bookingService.getJobs().subscribe({
      next: (jobs) => {
        this.jobs = jobs;
        this.categorizeJobs();
      },
      error: (error) => {
        console.error('Error loading jobs:', error);
      }
    });
  }

  private categorizeJobs(): void {
    this.newJobs = this.jobs.filter(j => j.status === 'new');
    this.upcomingJobs = this.jobs.filter(j => j.status === 'upcoming');
    this.inProgressJobs = this.jobs.filter(j => j.status === 'in-progress');
    this.readyJobs = this.jobs.filter(j => j.status === 'ready');
    this.completedJobs = this.jobs.filter(j => j.status === 'completed');
  }

  switchTab(tab: JobStatus): void {
    this.selectedTab = tab;
  }

  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'kanban' ? 'list' : 'kanban';
  }

  getJobsByStatus(status: JobStatus): Job[] {
    switch (status) {
      case 'new': return this.newJobs;
      case 'upcoming': return this.upcomingJobs;
      case 'in-progress': return this.inProgressJobs;
      case 'ready': return this.readyJobs;
      case 'completed': return this.completedJobs;
      default: return [];
    }
  }

  getStatusLabel(status: JobStatus): string {
    const labels: Record<JobStatus, string> = {
      'new': 'New Requests',
      'upcoming': 'Upcoming',
      'in-progress': 'In Progress',
      'ready': 'Ready for Pickup',
      'completed': 'Completed',
      'cancelled': 'Cancelled'
    };
    return labels[status];
  }

  getStatusCount(status: JobStatus): number {
    return this.getJobsByStatus(status).length;
  }

  getUrgencyClass(urgency: string): string {
    const classes: Record<string, string> = {
      'urgent': 'urgency-urgent',
      'high': 'urgency-high',
      'normal': 'urgency-normal',
      'low': 'urgency-low'
    };
    return classes[urgency] || 'urgency-normal';
  }

  getUrgencyLabel(urgency: string): string {
    return urgency.charAt(0).toUpperCase() + urgency.slice(1);
  }

  viewJobDetails(jobId: string): void {
    this.router.navigate(['/workshop/job', jobId]);
  }

  // Drag and Drop functionality
  onDragStart(event: DragEvent, job: Job): void {
    this.draggedJob = job;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/html', event.target as any);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onDrop(event: DragEvent, newStatus: JobStatus): void {
    event.preventDefault();

    if (this.draggedJob && this.draggedJob.status !== newStatus) {
      this.updateJobStatus(this.draggedJob.id, newStatus);
    }

    this.draggedJob = null;
  }

  onDragEnd(): void {
    this.draggedJob = null;
  }

  updateJobStatus(jobId: string, newStatus: JobStatus): void {
    this.bookingService.updateJobStatus(jobId, newStatus).subscribe({
      next: () => {
        this.loadJobs();
        // TODO: Show success notification
        console.log('Job status updated successfully');
      },
      error: (error) => {
        console.error('Error updating job status:', error);
        // TODO: Show error notification
      }
    });
  }

  formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getStageProgress(stage: string): number {
    const stages = ['received', 'diagnosing', 'repairing', 'testing', 'done'];
    const index = stages.indexOf(stage);
    return ((index + 1) / stages.length) * 100;
  }

  getStageLabel(stage: string): string {
    const labels: Record<string, string> = {
      'received': 'Received',
      'diagnosing': 'Diagnosing',
      'repairing': 'Repairing',
      'testing': 'Testing',
      'done': 'Done'
    };
    return labels[stage] || stage;
  }

  // Accordion functionality
  toggleBookingExpanded(bookingId: number, event: Event): void {
    event.stopPropagation();
    event.preventDefault();

    if (this.expandedBookings.has(bookingId)) {
      this.expandedBookings.delete(bookingId);
      console.log('Collapsed booking:', bookingId);
    } else {
      this.expandedBookings.add(bookingId);
      console.log('Expanded booking:', bookingId);
    }

    // Force change detection
    this.cdr.detectChanges();
  }

  isBookingExpanded(bookingId: number): boolean {
    return this.expandedBookings.has(bookingId);
  }

  // TrackBy function for better performance with large lists
  trackByBookingId(index: number, booking: RealBooking): number {
    return booking.id;
  }
}
