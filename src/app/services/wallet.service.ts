import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, forkJoin } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { Transaction, PayoutSchedule, WalletSummary } from '../models/wallet.model';

@Injectable({
  providedIn: 'root'
})
export class WalletService {
  private apiUrl = 'https://localhost:44316/api';

  private walletSummarySubject = new BehaviorSubject<WalletSummary>({
    availableBalance: 12450.75,
    pendingBalance: 3200.00,
    totalEarnings: 45678.50,
    monthlyRevenue: 15250.00,
    revenueChange: 12.5,
    nextPayoutAmount: 8500.00,
    nextPayoutDate: new Date(2025, 10, 25)
  });

  private transactionsSubject = new BehaviorSubject<Transaction[]>([
    {
      id: 'txn-001',
      type: 'credit',
      amount: 450.00,
      description: 'Oil Change & Filter - Toyota Camry',
      date: new Date(2025, 10, 21, 14, 30),
      status: 'completed',
      category: 'booking',
      customerName: 'John Smith'
    },
    {
      id: 'txn-002',
      type: 'credit',
      amount: 1250.00,
      description: 'Brake System Repair - Honda Accord',
      date: new Date(2025, 10, 20, 10, 15),
      status: 'completed',
      category: 'booking',
      customerName: 'Sarah Johnson'
    },
    {
      id: 'txn-003',
      type: 'debit',
      amount: 8500.00,
      description: 'Weekly Payout',
      date: new Date(2025, 10, 18, 9, 0),
      status: 'completed',
      category: 'payout',
      reference: 'PAY-2025-1118'
    },
    {
      id: 'txn-004',
      type: 'credit',
      amount: 850.00,
      description: 'Tire Replacement - BMW X5',
      date: new Date(2025, 10, 19, 16, 45),
      status: 'completed',
      category: 'booking',
      customerName: 'Mike Wilson'
    },
    {
      id: 'txn-005',
      type: 'debit',
      amount: 125.00,
      description: 'Platform Fee',
      date: new Date(2025, 10, 21, 0, 0),
      status: 'completed',
      category: 'fee'
    },
    {
      id: 'txn-006',
      type: 'credit',
      amount: 650.00,
      description: 'Engine Diagnostic - Ford F-150',
      date: new Date(2025, 10, 17, 11, 20),
      status: 'pending',
      category: 'booking',
      customerName: 'Emily Davis'
    }
  ]);

  private payoutScheduleSubject = new BehaviorSubject<PayoutSchedule[]>([
    {
      id: 'payout-001',
      amount: 8500.00,
      scheduledDate: new Date(2025, 10, 25),
      status: 'scheduled',
      bankAccount: '****4532'
    },
    {
      id: 'payout-002',
      amount: 7200.00,
      scheduledDate: new Date(2025, 10, 18),
      status: 'completed',
      bankAccount: '****4532'
    }
  ]);

  constructor(private http: HttpClient) {}

  getWalletSummary(): Observable<WalletSummary> {
    return this.walletSummarySubject.asObservable();
  }

  getTransactions(): Observable<Transaction[]> {
    return this.transactionsSubject.asObservable();
  }

  /**
   * Fetch completed bookings by workshop profile ID and transform to transactions
   */
  getTransactionsByWorkshop(workshopProfileId: number): Observable<Transaction[]> {
    console.log('🔍 Fetching bookings for workshop:', workshopProfileId);

    return this.http.get<any>(`${this.apiUrl}/Booking/ByWorkshop/${workshopProfileId}`).pipe(
      switchMap((response: any) => {
        const allBookings = response?.data || response || [];
        console.log('📦 Total bookings:', allBookings.length);

        // Calculate wallet summary from all bookings
        this.calculateWalletSummary(allBookings);

        // Filter only completed bookings
        const completedBookings = allBookings.filter((booking: any) => {
          const status = (booking.status || booking.Status || '').toLowerCase();
          return status === 'completed';
        });

        console.log('✅ Completed bookings:', completedBookings.length);

        if (!completedBookings || completedBookings.length === 0) {
          return of([]);
        }

        // Fetch additional data for each booking
        const transactionObservables = completedBookings.map((booking: any) => {
          // First get WorkshopService to extract ServiceId, then fetch from Service table
          const workshopServiceCall = this.http.get<any>(`${this.apiUrl}/WorkshopService/${booking.workshopServiceId}`).pipe(
            switchMap((wsResponse: any) => {
              const wsData = wsResponse?.data || wsResponse;
              const serviceId = wsData?.serviceId || wsData?.ServiceId;
              if (serviceId) {
                return this.http.get<any>(`${this.apiUrl}/Service/${serviceId}`).pipe(
                  catchError(() => of({ serviceName: 'Service' }))
                );
              }
              return of({ serviceName: 'Service' });
            }),
            catchError(() => of({ serviceName: 'Service' }))
          );

          return forkJoin({
            service: workshopServiceCall,
            carOwner: this.http.get<any>(`${this.apiUrl}/CarOwnerProfile/by-booking/${booking.id}`).pipe(
              catchError(() => of({ fullName: 'Customer' }))
            ),
            car: this.http.get<any>(`${this.apiUrl}/Car/${booking.carId}`).pipe(
              catchError(() => of({ make: '', model: 'Vehicle' }))
            )
          }).pipe(
            map(({ service, carOwner, car }) => {
              const serviceData = service?.data || service;
              const carOwnerData = carOwner?.data || carOwner;
              const carData = car?.data || car;

              // Extract service name from Service table response
              const serviceName = serviceData?.serviceName ||
                                 serviceData?.ServiceName ||
                                 serviceData?.name ||
                                 serviceData?.Name ||
                                 'Unknown Service';
              const customerName = carOwnerData?.fullName || carOwnerData?.FullName || 'Customer';
              const carName = carData ? `${carData.make || ''} ${carData.model || ''}`.trim() : 'Vehicle';

              // Calculate workshop's 88% share
              const workshopAmount = booking.paidAmount * 0.88;

              const transaction: Transaction = {
                id: `booking-${booking.id}`,
                type: 'credit',
                amount: workshopAmount,
                description: `${serviceName} - ${carName}`,
                date: new Date(booking.appointmentDate),
                status: 'completed',
                category: 'booking',
                reference: `BK${String(booking.id).padStart(6, '0')}`,
                customerName: customerName
              };

              return transaction;
            })
          );
        });

        if (transactionObservables.length === 0) {
          return of([]);
        }

        return (forkJoin(transactionObservables) as Observable<Transaction[]>).pipe(
          map((transactions: Transaction[]) => {
            return transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
          })
        );
      }),
      catchError((err) => {
        console.error('❌ Error fetching transactions:', err);
        return of([]);
      })
    );
  }

  /**
   * Calculate wallet summary from bookings
   */
  private calculateWalletSummary(allBookings: any[]): void {
    let totalEarnings = 0;
    let pendingBalance = 0;
    let completedBalance = 0;

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    let monthlyRevenue = 0;

    allBookings.forEach((booking: any) => {
      const workshopAmount = (booking.paidAmount || 0) * 0.88;
      const status = (booking.status || booking.Status || '').toLowerCase();
      const bookingDate = new Date(booking.appointmentDate);

      if (status === 'completed') {
        totalEarnings += workshopAmount;
        completedBalance += workshopAmount;

        if (bookingDate.getMonth() === currentMonth && bookingDate.getFullYear() === currentYear) {
          monthlyRevenue += workshopAmount;
        }
      } else if (status === 'pending' || status === 'in-progress') {
        pendingBalance += workshopAmount;
      }
    });

    const summary: WalletSummary = {
      availableBalance: completedBalance,
      pendingBalance: pendingBalance,
      totalEarnings: totalEarnings,
      monthlyRevenue: monthlyRevenue,
      revenueChange: 12.5, // TODO: Calculate from previous period
      nextPayoutAmount: 0, // TODO: Calculate from schedule
      nextPayoutDate: new Date() // TODO: Get from schedule
    };

    this.walletSummarySubject.next(summary);
  }

  getPayoutSchedule(): Observable<PayoutSchedule[]> {
    return this.payoutScheduleSubject.asObservable();
  }

  requestPayout(amount: number): Observable<any> {
    // Mock implementation
    return new Observable(observer => {
      setTimeout(() => {
        observer.next({ success: true, message: 'Payout request submitted' });
        observer.complete();
      }, 1000);
    });
  }

  getTransactionsByDateRange(startDate: Date, endDate: Date): Transaction[] {
    return this.transactionsSubject.value.filter(txn =>
      txn.date >= startDate && txn.date <= endDate
    );
  }

  getTransactionsByCategory(category: string): Transaction[] {
    return this.transactionsSubject.value.filter(txn => txn.category === category);
  }
}
