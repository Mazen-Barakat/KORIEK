import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  Job,
  JobStatus,
  Quote,
  AdditionalRepair,
  ChatMessage,
  MediaItem,
  DashboardMetrics,
  Transaction,
  Payout
} from '../models/booking.model';

@Injectable({
  providedIn: 'root'
})
export class BookingService {
  public apiUrl = 'https://localhost:44316/api';
  private jobsSubject = new BehaviorSubject<Job[]>([]);
  public jobs$ = this.jobsSubject.asObservable();

  constructor(public http: HttpClient) {
    this.loadInitialData();
  }

  private loadInitialData(): void {
    // Load mock data for now - replace with API calls
    const mockJobs = this.generateMockJobs();
    this.jobsSubject.next(mockJobs);
  }

  // =============== Booking Creation ===============

  /**
   * Create a new booking with date/time in Africa/Cairo timezone
   * @param bookingData Booking information matching API request format
   */
  createBooking(bookingData: {
    AppointmentDate: string;       // ISO string (UTC) - e.g., "2025-11-30T15:33:11.286Z"
    IssueDescription: string;       // Description of the issue/notes
    PaymentMethod: string;          // "Cash" or "CreditCard"
    CarId: number;                  // Vehicle ID
    WorkShopProfileId: number;      // Workshop profile ID
    WorkshopServiceId: number;      // Workshop service ID
    Photos?: string[];              // Optional array of photo URLs
  }): Observable<{
    success: boolean;
    message: string;
    data: {
      id: number;
      status: string;
      appointmentDate: string;
      issueDescription: string;
      paymentMethod: string;
      paidAmount: number;
      paymentStatus: string;
      createdAt: string;
      carId: number;
      workShopProfileId: number;
      workshopServiceId: number;
    };
  }> {
    console.log('Creating booking with data:', bookingData);
    console.log('AppointmentDate (ISO/UTC):', bookingData.AppointmentDate);
    console.log('AppointmentDate (Cairo):', new Date(bookingData.AppointmentDate).toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));

    // Build FormData for multipart/form-data submission
    const formData = new FormData();
    formData.append('AppointmentDate', bookingData.AppointmentDate);
    formData.append('IssueDescription', bookingData.IssueDescription);
    formData.append('PaymentMethod', bookingData.PaymentMethod);
    formData.append('CarId', bookingData.CarId.toString());
    formData.append('WorkShopProfileId', bookingData.WorkShopProfileId.toString());
    formData.append('WorkshopServiceId', bookingData.WorkshopServiceId.toString());

    // Add photos if provided
    if (bookingData.Photos && bookingData.Photos.length > 0) {
      bookingData.Photos.forEach((photo, index) => {
        formData.append('Photos', photo);
      });
    }

    // Send to backend API as multipart/form-data
    return this.http.post<{
      success: boolean;
      message: string;
      data: {
        id: number;
        status: string;
        appointmentDate: string;
        issueDescription: string;
        paymentMethod: string;
        paidAmount: number;
        paymentStatus: string;
        createdAt: string;
        carId: number;
        workShopProfileId: number;
        workshopServiceId: number;
      };
    }>(`${this.apiUrl}/Booking`, formData);
  }

  /**
   * Get booked time slots for a specific workshop and date
   * @param workshopId Workshop profile ID
   * @param serviceId Service ID
   * @param date Date in YYYY-MM-DD format
   */
  getBookedSlots(workshopId: number, serviceId: number, date: string): Observable<string[]> {
    return this.http.get<any>(`${this.apiUrl}/Booking/booked-slots`, {
      params: {
        workshopId: workshopId.toString(),
        serviceId: serviceId.toString(),
        date: date
      }
    }).pipe(
      map(response => {
        // Assuming response returns array of ISO datetime strings
        return response.data || response || [];
      })
    );
  }

  /**
   * Get bookings for a specific car
   * @param carId Car ID
   */
  getBookingsByCar(carId: number): Observable<{
    success: boolean;
    message: string;
    data: Array<{
      id: number;
      status: string;
      appointmentDate: string;
      issueDescription: string;
      paymentMethod: string;
      paidAmount: number;
      paymentStatus: string;
      createdAt: string;
      carId: number;
      workShopProfileId: number;
      workshopServiceId: number;
    }>;
  }> {
    return this.http.get<{
      success: boolean;
      message: string;
      data: Array<{
        id: number;
        status: string;
        appointmentDate: string;
        issueDescription: string;
        paymentMethod: string;
        paidAmount: number;
        paymentStatus: string;
        createdAt: string;
        carId: number;
        workShopProfileId: number;
        workshopServiceId: number;
      }>;
    }>(`${this.apiUrl}/Booking/ByCar/${carId}`);
  }

  // =============== Job Management ===============

  getJobs(): Observable<Job[]> {
    return this.jobs$;
  }

  getJobsByStatus(status: JobStatus): Observable<Job[]> {
    return this.jobs$.pipe(
      map(jobs => jobs.filter(job => job.status === status))
    );
  }

  getJobById(jobId: string): Observable<Job | undefined> {
    return this.jobs$.pipe(
      map(jobs => jobs.find(job => job.id === jobId))
    );
  }

  updateJobStatus(jobId: string, status: JobStatus): Observable<Job> {
    const jobs = this.jobsSubject.value;
    const jobIndex = jobs.findIndex(j => j.id === jobId);

    if (jobIndex !== -1) {
      jobs[jobIndex] = {
        ...jobs[jobIndex],
        status,
        updatedAt: new Date()
      };
      this.jobsSubject.next([...jobs]);
      return of(jobs[jobIndex]);
    }

    throw new Error('Job not found');
  }

  updateJobStage(jobId: string, stage: Job['stage']): Observable<Job> {
    const jobs = this.jobsSubject.value;
    const jobIndex = jobs.findIndex(j => j.id === jobId);

    if (jobIndex !== -1) {
      jobs[jobIndex] = {
        ...jobs[jobIndex],
        stage,
        updatedAt: new Date()
      };
      this.jobsSubject.next([...jobs]);
      return of(jobs[jobIndex]);
    }

    throw new Error('Job not found');
  }

  // =============== Quote Management ===============

  createQuote(jobId: string, quote: Partial<Quote>): Observable<Quote> {
    // Mock implementation - replace with API call
    const newQuote: Quote = {
      id: this.generateId(),
      jobId,
      services: quote.services || [],
      parts: quote.parts || [],
      laborCost: quote.laborCost || 0,
      partsCost: quote.partsCost || 0,
      subtotal: quote.subtotal || 0,
      tax: quote.tax || 0,
      discount: quote.discount || 0,
      total: quote.total || 0,
      status: 'draft',
      notes: quote.notes
    };

    const jobs = this.jobsSubject.value;
    const jobIndex = jobs.findIndex(j => j.id === jobId);

    if (jobIndex !== -1) {
      jobs[jobIndex] = {
        ...jobs[jobIndex],
        quote: newQuote,
        updatedAt: new Date()
      };
      this.jobsSubject.next([...jobs]);
    }

    return of(newQuote);
  }

  sendQuote(quoteId: string): Observable<Quote> {
    // Mock implementation - replace with API call
    const jobs = this.jobsSubject.value;

    for (let job of jobs) {
      if (job.quote?.id === quoteId) {
        job.quote = {
          ...job.quote,
          status: 'sent',
          sentAt: new Date()
        };
        job.updatedAt = new Date();
        this.jobsSubject.next([...jobs]);
        return of(job.quote);
      }
    }

    throw new Error('Quote not found');
  }

  approveQuote(quoteId: string): Observable<Quote> {
    // Mock implementation - replace with API call
    const jobs = this.jobsSubject.value;

    for (let job of jobs) {
      if (job.quote?.id === quoteId) {
        job.quote = {
          ...job.quote,
          status: 'approved',
          approvedAt: new Date()
        };
        job.status = 'in-progress';
        job.updatedAt = new Date();
        this.jobsSubject.next([...jobs]);
        return of(job.quote);
      }
    }

    throw new Error('Quote not found');
  }

  // =============== Additional Repairs (Upsell) ===============

  suggestAdditionalRepair(jobId: string, repair: Partial<AdditionalRepair>): Observable<AdditionalRepair> {
    const newRepair: AdditionalRepair = {
      id: this.generateId(),
      jobId,
      title: repair.title || '',
      description: repair.description || '',
      media: repair.media || [],
      estimatedCost: repair.estimatedCost || 0,
      status: 'pending',
      createdAt: new Date()
    };

    const jobs = this.jobsSubject.value;
    const jobIndex = jobs.findIndex(j => j.id === jobId);

    if (jobIndex !== -1) {
      jobs[jobIndex] = {
        ...jobs[jobIndex],
        additionalRepairs: [...jobs[jobIndex].additionalRepairs, newRepair],
        updatedAt: new Date()
      };
      this.jobsSubject.next([...jobs]);
    }

    return of(newRepair);
  }

  approveAdditionalRepair(jobId: string, repairId: string): Observable<AdditionalRepair> {
    const jobs = this.jobsSubject.value;
    const jobIndex = jobs.findIndex(j => j.id === jobId);

    if (jobIndex !== -1) {
      const repairIndex = jobs[jobIndex].additionalRepairs.findIndex(r => r.id === repairId);
      if (repairIndex !== -1) {
        jobs[jobIndex].additionalRepairs[repairIndex] = {
          ...jobs[jobIndex].additionalRepairs[repairIndex],
          status: 'approved',
          respondedAt: new Date()
        };
        jobs[jobIndex].updatedAt = new Date();
        this.jobsSubject.next([...jobs]);
        return of(jobs[jobIndex].additionalRepairs[repairIndex]);
      }
    }

    throw new Error('Additional repair not found');
  }

  // =============== Chat Messages ===============

  sendMessage(jobId: string, message: Partial<ChatMessage>): Observable<ChatMessage> {
    const newMessage: ChatMessage = {
      id: this.generateId(),
      senderId: message.senderId || '',
      senderName: message.senderName || '',
      senderType: message.senderType || 'workshop',
      message: message.message || '',
      timestamp: new Date(),
      read: false
    };

    const jobs = this.jobsSubject.value;
    const jobIndex = jobs.findIndex(j => j.id === jobId);

    if (jobIndex !== -1) {
      jobs[jobIndex] = {
        ...jobs[jobIndex],
        chatMessages: [...jobs[jobIndex].chatMessages, newMessage],
        updatedAt: new Date()
      };
      this.jobsSubject.next([...jobs]);
    }

    return of(newMessage);
  }

  // =============== Media Upload ===============

  uploadMedia(jobId: string, media: Partial<MediaItem>): Observable<MediaItem> {
    const newMedia: MediaItem = {
      id: this.generateId(),
      type: media.type || 'image',
      url: media.url || '',
      thumbnail: media.thumbnail,
      uploadedAt: new Date(),
      caption: media.caption,
      uploadedBy: media.uploadedBy
    };

    const jobs = this.jobsSubject.value;
    const jobIndex = jobs.findIndex(j => j.id === jobId);

    if (jobIndex !== -1) {
      jobs[jobIndex] = {
        ...jobs[jobIndex],
        media: [...jobs[jobIndex].media, newMedia],
        updatedAt: new Date()
      };
      this.jobsSubject.next([...jobs]);
    }

    return of(newMedia);
  }

  // =============== Dashboard Metrics ===============

  getDashboardMetrics(): Observable<DashboardMetrics> {
    const jobs = this.jobsSubject.value;

    // Calculate metrics from current jobs
    const metrics: DashboardMetrics = {
      monthlyRevenue: this.calculateMonthlyRevenue(jobs),
      revenueChange: 12.5,
      pendingPayouts: this.calculatePendingPayouts(jobs),
      payoutsChange: -3.2,
      shopRating: 4.8,
      totalReviews: 247,
      newBookingRequests: jobs.filter(j => j.status === 'new').length,
      quotesAwaitingApproval: jobs.filter(j => j.quote?.status === 'sent').length,
      carsReadyForPickup: jobs.filter(j => j.status === 'ready').length,
      activeJobs: jobs.filter(j => j.status === 'in-progress').length
    };

    return of(metrics);
  }

  // =============== Financial Management ===============

  getTransactions(): Observable<Transaction[]> {
    // Mock transactions - replace with API call
    return of(this.generateMockTransactions());
  }

  getPayouts(): Observable<Payout[]> {
    // Mock payouts - replace with API call
    return of(this.generateMockPayouts());
  }

  // =============== Helper Methods ===============

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateMonthlyRevenue(jobs: Job[]): number {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    return jobs
      .filter(job => {
        const jobDate = new Date(job.createdAt);
        return jobDate.getMonth() === currentMonth && jobDate.getFullYear() === currentYear && job.invoice;
      })
      .reduce((sum, job) => sum + (job.invoice?.quote.total || 0), 0);
  }

  private calculatePendingPayouts(jobs: Job[]): number {
    return jobs
      .filter(job => job.status === 'completed' && job.invoice?.paymentStatus === 'paid')
      .reduce((sum, job) => sum + (job.invoice?.quote.total || 0), 0) * 0.85; // 85% after platform fee
  }

  private generateMockJobs(): Job[] {
    // Generate mock jobs for demonstration
    return [
      {
        id: 'job-001',
        bookingId: 'booking-001',
        customer: {
          id: 'cust-001',
          name: 'Ahmed Hassan',
          email: 'ahmed.hassan@email.com',
          phone: '+20 123 456 7890',
          avatar: 'https://i.pravatar.cc/150?img=12'
        },
        vehicle: {
          id: 'vehicle-001',
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          plateNumber: 'ABC 1234',
          vin: '1HGBH41JXMN109186',
          color: 'Silver',
          mileage: 45000
        },
        status: 'new',
        stage: 'received',
        urgency: 'high',
        customerComplaint: 'Strange noise from engine, especially when accelerating. Check engine light is on.',
        requestedServices: ['Engine Diagnostics', 'Oil Change'],
        scheduledDate: new Date(Date.now() + 86400000),
        media: [],
        chatMessages: [],
        additionalRepairs: [],
        createdAt: new Date(Date.now() - 3600000),
        updatedAt: new Date(Date.now() - 3600000),
        tags: ['urgent', 'engine']
      },
      {
        id: 'job-002',
        bookingId: 'booking-002',
        customer: {
          id: 'cust-002',
          name: 'Sara Mohamed',
          email: 'sara.mohamed@email.com',
          phone: '+20 111 222 3333',
          avatar: 'https://i.pravatar.cc/150?img=5'
        },
        vehicle: {
          id: 'vehicle-002',
          make: 'Honda',
          model: 'Civic',
          year: 2019,
          plateNumber: 'XYZ 5678',
          vin: '2HGFC2F59KH542893',
          color: 'Blue',
          mileage: 62000
        },
        status: 'in-progress',
        stage: 'repairing',
        urgency: 'normal',
        customerComplaint: 'Brake pads need replacement and routine maintenance',
        requestedServices: ['Brake Service', 'Oil Change', 'Tire Rotation'],
        scheduledDate: new Date(Date.now() - 86400000),
        dropoffDate: new Date(Date.now() - 86400000),
        estimatedCompletionDate: new Date(Date.now() + 3600000 * 2),
        assignedTechnicianName: 'Mahmoud Ali',
        media: [],
        chatMessages: [
          {
            id: 'msg-001',
            senderId: 'tech-001',
            senderName: 'Mahmoud Ali',
            senderType: 'workshop',
            message: 'Started working on the brake service. Will update you in 2 hours.',
            timestamp: new Date(Date.now() - 7200000),
            read: true
          }
        ],
        additionalRepairs: [],
        quote: {
          id: 'quote-001',
          jobId: 'job-002',
          services: [
            {
              id: 'svc-001',
              name: 'Brake Pad Replacement',
              description: 'Replace front brake pads',
              duration: 120,
              price: 800,
              quantity: 1,
              total: 800
            }
          ],
          parts: [
            {
              id: 'part-001',
              name: 'Brake Pads (Front)',
              price: 350,
              quantity: 1,
              total: 350
            }
          ],
          laborCost: 800,
          partsCost: 350,
          subtotal: 1150,
          tax: 172.5,
          discount: 0,
          total: 1322.5,
          status: 'approved',
          approvedAt: new Date(Date.now() - 82800000)
        },
        createdAt: new Date(Date.now() - 172800000),
        updatedAt: new Date(Date.now() - 3600000),
        tags: ['brake-service']
      }
    ];
  }

  private generateMockTransactions(): Transaction[] {
    return [
      {
        id: 'txn-001',
        type: 'income',
        amount: 1322.5,
        description: 'Brake Service - Honda Civic',
        date: new Date(Date.now() - 86400000),
        status: 'completed',
        fee: 198.375,
        invoiceId: 'inv-001'
      },
      {
        id: 'txn-002',
        type: 'income',
        amount: 2500,
        description: 'Engine Repair - Toyota Corolla',
        date: new Date(Date.now() - 172800000),
        status: 'completed',
        fee: 375,
        invoiceId: 'inv-002'
      }
    ];
  }

  private generateMockPayouts(): Payout[] {
    return [
      {
        id: 'payout-001',
        amount: 5000,
        fee: 750,
        netAmount: 4250,
        scheduledDate: new Date(Date.now() + 259200000),
        status: 'scheduled',
        method: 'Bank Transfer',
        transactions: []
      }
    ];
  }
}
