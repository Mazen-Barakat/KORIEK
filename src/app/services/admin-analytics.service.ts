import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  AdminDashboardStats,
  MonthlyRevenue,
  BookingStatusCount,
  WorkshopTypeCount,
  VerificationStatusCount,
  TopWorkshop,
  CarOriginCount,
  WorkshopPerformanceMetrics,
  RevenueAnalytics,
  PaymentMethodCount,
  CarBrandCount,
  CarModelCount,
  TransmissionTypeCount,
  FuelTypeCount,
  FleetAgeDistribution,
  GeographicDistribution,
  LanguagePreference,
  CustomerInsights,
  OperationalMetrics,
  RatingDistribution,
  RevenueByWorkshopType,
  WorkshopSizeCategory,
} from '../models/admin-dashboard-stats.model';

interface WorkshopProfile {
  id: number;
  name: string;
  rating: number;
  numbersOfTechnicians: number;
  country: string;
  governorate: string;
  city: string;
  verificationStatus: string;
  workShopType: string;
  logoImageUrl?: string | null;
}

interface CarOwnerProfile {
  id: number;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  country: string;
  governorate: string;
  city: string;
  preferredLanguage: string;
}

interface Car {
  id: number;
  make: string;
  model: string;
  year: number;
  origin: string;
  carOwnerProfileId: number;
  transmissionType: string;
  fuelType: string;
  currentMileage: number;
  engineCapacity: number;
}

interface Booking {
  id: number;
  status: string;
  appointmentDate: string;
  paidAmount: number;
  paymentStatus: string;
  createdAt: string;
  workShopProfileId: number;
  paymentMethod: string;
  carOwnerConfirmed: boolean | null;
  workshopOwnerConfirmed: boolean | null;
  issueDescription: string;
}

@Injectable({
  providedIn: 'root',
})
export class AdminAnalyticsService {
  constructor() {}

  /**
   * Calculate comprehensive dashboard statistics from raw API data
   */
  calculateDashboardStats(
    workshops: WorkshopProfile[],
    carOwners: CarOwnerProfile[],
    cars: Car[],
    allBookings: Booking[]
  ): AdminDashboardStats {
    // Basic counts
    const totalWorkshops = workshops.length;
    const totalCarOwners = carOwners.length;
    const totalCars = cars.length;
    const totalBookings = allBookings.length;
    const totalUsers = totalCarOwners + totalWorkshops;

    // Revenue calculation (only from completed & paid bookings)
    const completedBookings = allBookings.filter(
      (b) => b.status === 'Completed' && b.paymentStatus === 'Paid'
    );
    const totalRevenue = completedBookings.reduce((sum, b) => sum + (b.paidAmount || 0), 0);

    // Workshop statistics
    const verifiedWorkshops = workshops.filter((w) => w.verificationStatus === 'Verified').length;
    const pendingWorkshops = workshops.filter((w) => w.verificationStatus === 'Pending').length;
    const averageWorkshopRating =
      workshops.reduce((sum, w) => sum + w.rating, 0) / (workshops.length || 1);

    // Monthly revenue calculation
    const monthlyRevenue = this.calculateMonthlyRevenue(completedBookings);

    // Booking status distribution
    const bookingStatusDistribution = this.calculateBookingStatusDistribution(allBookings);

    // Workshop type distribution
    const workshopTypeDistribution = this.calculateWorkshopTypeDistribution(workshops);

    // Verification status distribution
    const verificationStatusDistribution =
      this.calculateVerificationStatusDistribution(workshops);

    // Top performing workshops (by booking count)
    const topPerformingWorkshops = this.calculateTopWorkshops(workshops, allBookings);

    // Car origin distribution
    const carOriginDistribution = this.calculateCarOriginDistribution(cars);

    // NEW ANALYTICS CALCULATIONS
    const paymentMethodDistribution = this.calculatePaymentMethodDistribution(completedBookings);
    const topCarBrands = this.calculateTopCarBrands(cars);
    const topCarModels = this.calculateTopCarModels(cars);
    const transmissionTypeDistribution = this.calculateTransmissionTypeDistribution(cars);
    const fuelTypeDistribution = this.calculateFuelTypeDistribution(cars);
    const fleetAgeDistribution = this.calculateFleetAgeDistribution(cars);
    const geographicDistribution = this.calculateGeographicDistribution(workshops, carOwners);
    const languagePreferences = this.calculateLanguagePreferences(carOwners);
    const customerInsights = this.calculateCustomerInsights(carOwners, allBookings);
    const operationalMetrics = this.calculateOperationalMetrics(allBookings);
    const ratingDistribution = this.calculateRatingDistribution(workshops);
    const revenueByWorkshopType = this.calculateRevenueByWorkshopType(workshops, completedBookings);
    const workshopSizeCategories = this.calculateWorkshopSizeCategories(workshops);
    const topWorkshopsByRevenue = this.calculateTopWorkshopsByRevenue(workshops, completedBookings);

    return {
      totalUsers,
      totalWorkshops,
      totalCarOwners,
      totalCars,
      totalBookings,
      totalRevenue,
      verifiedWorkshops,
      pendingWorkshops,
      averageWorkshopRating,
      monthlyRevenue,
      bookingStatusDistribution,
      workshopTypeDistribution,
      verificationStatusDistribution,
      topPerformingWorkshops,
      carOriginDistribution,
      paymentMethodDistribution,
      topCarBrands,
      topCarModels,
      transmissionTypeDistribution,
      fuelTypeDistribution,
      fleetAgeDistribution,
      geographicDistribution,
      languagePreferences,
      customerInsights,
      operationalMetrics,
      ratingDistribution,
      revenueByWorkshopType,
      workshopSizeCategories,
      topWorkshopsByRevenue,
    };
  }

  /**
   * Calculate monthly revenue for the last 6 months
   */
  private calculateMonthlyRevenue(bookings: Booking[]): MonthlyRevenue[] {
    const monthlyData = new Map<string, { revenue: number; count: number }>();
    const months = this.getLast6Months();

    // Initialize all months with zero
    months.forEach((month) => {
      monthlyData.set(month, { revenue: 0, count: 0 });
    });

    // Aggregate bookings by month
    bookings.forEach((booking) => {
      const date = new Date(booking.appointmentDate);
      const monthKey = date.toLocaleDateString('en-US', { month: 'short' });

      if (monthlyData.has(monthKey)) {
        const current = monthlyData.get(monthKey)!;
        current.revenue += booking.paidAmount || 0;
        current.count += 1;
      }
    });

    return months.map((month) => {
      const data = monthlyData.get(month) || { revenue: 0, count: 0 };
      return {
        month,
        revenue: data.revenue,
        bookingCount: data.count,
      };
    });
  }

  /**
   * Get last 6 months in short format (e.g., "Dec", "Nov")
   */
  private getLast6Months(): string[] {
    const months: string[] = [];
    const today = new Date();

    for (let i = 5; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      months.push(date.toLocaleDateString('en-US', { month: 'short' }));
    }

    return months;
  }

  /**
   * Calculate booking status distribution
   */
  private calculateBookingStatusDistribution(bookings: Booking[]): BookingStatusCount[] {
    const statusMap = new Map<string, number>();

    bookings.forEach((booking) => {
      const status = booking.status;
      statusMap.set(status, (statusMap.get(status) || 0) + 1);
    });

    const total = bookings.length || 1;

    return Array.from(statusMap.entries()).map(([status, count]) => ({
      status,
      count,
      percentage: Math.round((count / total) * 100),
    }));
  }

  /**
   * Calculate workshop type distribution
   */
  private calculateWorkshopTypeDistribution(workshops: WorkshopProfile[]): WorkshopTypeCount[] {
    const typeMap = new Map<string, number>();

    workshops.forEach((workshop) => {
      const type = workshop.workShopType;
      typeMap.set(type, (typeMap.get(type) || 0) + 1);
    });

    const total = workshops.length || 1;

    return Array.from(typeMap.entries()).map(([type, count]) => ({
      type,
      count,
      percentage: Math.round((count / total) * 100),
    }));
  }

  /**
   * Calculate verification status distribution
   */
  private calculateVerificationStatusDistribution(
    workshops: WorkshopProfile[]
  ): VerificationStatusCount[] {
    const statusMap = new Map<string, number>();

    workshops.forEach((workshop) => {
      const status = workshop.verificationStatus;
      statusMap.set(status, (statusMap.get(status) || 0) + 1);
    });

    const total = workshops.length || 1;

    return Array.from(statusMap.entries()).map(([status, count]) => ({
      status,
      count,
      percentage: Math.round((count / total) * 100),
    }));
  }

  /**
   * Calculate top 5 performing workshops by booking count
   */
  private calculateTopWorkshops(
    workshops: WorkshopProfile[],
    bookings: Booking[]
  ): TopWorkshop[] {
    const workshopBookings = new Map<number, { count: number; revenue: number }>();

    // Count bookings per workshop
    bookings.forEach((booking) => {
      const workshopId = booking.workShopProfileId;
      const current = workshopBookings.get(workshopId) || { count: 0, revenue: 0 };
      current.count += 1;
      if (booking.status === 'Completed' && booking.paymentStatus === 'Paid') {
        current.revenue += booking.paidAmount || 0;
      }
      workshopBookings.set(workshopId, current);
    });

    // Map to workshop data and sort
    const topWorkshops = workshops
      .map((workshop) => {
        const stats = workshopBookings.get(workshop.id) || { count: 0, revenue: 0 };
        return {
          id: workshop.id,
          name: workshop.name,
          rating: workshop.rating,
          totalBookings: stats.count,
          totalRevenue: stats.revenue,
          logoImageUrl: workshop.logoImageUrl,
        };
      })
      .sort((a, b) => b.totalBookings - a.totalBookings)
      .slice(0, 5);

    return topWorkshops;
  }

  /**
   * Calculate car origin distribution
   */
  private calculateCarOriginDistribution(cars: Car[]): CarOriginCount[] {
    const originMap = new Map<string, number>();

    cars.forEach((car) => {
      const origin = car.origin || 'Unknown';
      originMap.set(origin, (originMap.get(origin) || 0) + 1);
    });

    const total = cars.length || 1;

    return Array.from(originMap.entries())
      .map(([origin, count]) => ({
        origin,
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Calculate workshop performance metrics
   */
  calculateWorkshopPerformance(
    workshop: WorkshopProfile,
    bookings: Booking[]
  ): WorkshopPerformanceMetrics {
    const workshopBookings = bookings.filter((b) => b.workShopProfileId === workshop.id);
    const completedBookings = workshopBookings.filter((b) => b.status === 'Completed').length;
    const pendingBookings = workshopBookings.filter(
      (b) => b.status === 'Confirmed' || b.status === 'Pending'
    ).length;
    const totalRevenue = workshopBookings
      .filter((b) => b.status === 'Completed' && b.paymentStatus === 'Paid')
      .reduce((sum, b) => sum + (b.paidAmount || 0), 0);

    return {
      workshopId: workshop.id,
      workshopName: workshop.name,
      rating: workshop.rating,
      techniciansCount: workshop.numbersOfTechnicians,
      location: `${workshop.governorate}, ${workshop.city}`,
      workshopType: workshop.workShopType,
      verificationStatus: workshop.verificationStatus,
      totalBookings: workshopBookings.length,
      totalRevenue,
      completedBookings,
      pendingBookings,
      logoImageUrl: workshop.logoImageUrl,
    };
  }

  /**
   * Calculate revenue analytics
   */
  calculateRevenueAnalytics(monthlyRevenue: MonthlyRevenue[], totalBookings: number): RevenueAnalytics {
    const totalRevenue = monthlyRevenue.reduce((sum, m) => sum + m.revenue, 0);
    const averageBookingValue = totalBookings > 0 ? totalRevenue / totalBookings : 0;

    // Calculate monthly growth (last month vs previous month)
    const lastMonth = monthlyRevenue[monthlyRevenue.length - 1]?.revenue || 0;
    const previousMonth = monthlyRevenue[monthlyRevenue.length - 2]?.revenue || 0;
    const monthlyGrowth =
      previousMonth > 0 ? Math.round(((lastMonth - previousMonth) / previousMonth) * 100) : 0;

    // Find highest and lowest revenue months
    const sortedMonths = [...monthlyRevenue].sort((a, b) => b.revenue - a.revenue);
    const highestRevenueMonth = sortedMonths[0]?.month || 'N/A';
    const lowestRevenueMonth = sortedMonths[sortedMonths.length - 1]?.month || 'N/A';

    return {
      totalRevenue,
      maintenanceRevenue: totalRevenue, // All revenue is from maintenance in this context
      averageBookingValue,
      monthlyGrowth,
      highestRevenueMonth,
      lowestRevenueMonth,
    };
  }

  /**
   * Get the max value for bar chart scaling
   */
  getMaxRevenueValue(monthlyRevenue: MonthlyRevenue[]): number {
    return Math.max(...monthlyRevenue.map((m) => m.revenue), 1);
  }

  /**
   * Calculate bar height percentage for chart visualization
   */
  calculateBarHeight(value: number, maxValue: number): number {
    return maxValue > 0 ? (value / maxValue) * 100 : 0;
  }

  // ============================================
  // NEW ANALYTICS CALCULATION METHODS
  // ============================================

  /**
   * Calculate payment method distribution with revenue
   */
  private calculatePaymentMethodDistribution(bookings: Booking[]): PaymentMethodCount[] {
    const methodMap = new Map<string, { count: number; revenue: number }>();

    bookings.forEach((booking) => {
      const method = booking.paymentMethod || 'Unknown';
      const current = methodMap.get(method) || { count: 0, revenue: 0 };
      current.count += 1;
      current.revenue += booking.paidAmount || 0;
      methodMap.set(method, current);
    });

    const total = bookings.length || 1;

    return Array.from(methodMap.entries())
      .map(([method, data]) => ({
        method,
        count: data.count,
        revenue: data.revenue,
        percentage: Math.round((data.count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Calculate top 10 car brands
   */
  private calculateTopCarBrands(cars: Car[]): CarBrandCount[] {
    const brandMap = new Map<string, number>();

    cars.forEach((car) => {
      const brand = car.make || 'Unknown';
      brandMap.set(brand, (brandMap.get(brand) || 0) + 1);
    });

    const total = cars.length || 1;

    return Array.from(brandMap.entries())
      .map(([brand, count]) => ({
        brand,
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Calculate top car models
   */
  private calculateTopCarModels(cars: Car[]): CarModelCount[] {
    const modelMap = new Map<string, { brand: string; count: number }>();

    cars.forEach((car) => {
      const key = `${car.make}|${car.model}`;
      const current = modelMap.get(key) || { brand: car.make, count: 0 };
      current.count += 1;
      modelMap.set(key, current);
    });

    const total = cars.length || 1;

    return Array.from(modelMap.entries())
      .map(([key, data]) => {
        const [brand, model] = key.split('|');
        return {
          model,
          brand,
          count: data.count,
          percentage: Math.round((data.count / total) * 100),
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Calculate transmission type distribution
   */
  private calculateTransmissionTypeDistribution(cars: Car[]): TransmissionTypeCount[] {
    const typeMap = new Map<string, number>();

    cars.forEach((car) => {
      const type = car.transmissionType || 'Unknown';
      typeMap.set(type, (typeMap.get(type) || 0) + 1);
    });

    const total = cars.length || 1;

    return Array.from(typeMap.entries())
      .map(([type, count]) => ({
        type,
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Calculate fuel type distribution
   */
  private calculateFuelTypeDistribution(cars: Car[]): FuelTypeCount[] {
    const typeMap = new Map<string, number>();

    cars.forEach((car) => {
      const type = car.fuelType || 'Unknown';
      typeMap.set(type, (typeMap.get(type) || 0) + 1);
    });

    const total = cars.length || 1;

    return Array.from(typeMap.entries())
      .map(([type, count]) => ({
        type,
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Calculate fleet age distribution
   */
  private calculateFleetAgeDistribution(cars: Car[]): FleetAgeDistribution[] {
    const currentYear = new Date().getFullYear();
    const ageRanges = [
      { label: '0-3 years', min: currentYear - 3, max: currentYear },
      { label: '4-7 years', min: currentYear - 7, max: currentYear - 4 },
      { label: '8-12 years', min: currentYear - 12, max: currentYear - 8 },
      { label: '13-20 years', min: currentYear - 20, max: currentYear - 13 },
      { label: '20+ years', min: 0, max: currentYear - 21 },
    ];

    const ageCounts = new Map<string, number>();
    ageRanges.forEach((range) => ageCounts.set(range.label, 0));

    cars.forEach((car) => {
      const year = car.year;
      for (const range of ageRanges) {
        if (range.label === '20+ years' && year <= range.max) {
          ageCounts.set(range.label, (ageCounts.get(range.label) || 0) + 1);
          break;
        } else if (year >= range.min && year <= range.max) {
          ageCounts.set(range.label, (ageCounts.get(range.label) || 0) + 1);
          break;
        }
      }
    });

    const total = cars.length || 1;

    return ageRanges.map((range) => ({
      ageRange: range.label,
      count: ageCounts.get(range.label) || 0,
      percentage: Math.round(((ageCounts.get(range.label) || 0) / total) * 100),
    }));
  }

  /**
   * Calculate geographic distribution (workshops vs users by governorate)
   */
  private calculateGeographicDistribution(
    workshops: WorkshopProfile[],
    carOwners: CarOwnerProfile[]
  ): GeographicDistribution[] {
    const geoMap = new Map<string, { workshopCount: number; userCount: number }>();

    workshops.forEach((workshop) => {
      const gov = workshop.governorate || 'Unknown';
      const current = geoMap.get(gov) || { workshopCount: 0, userCount: 0 };
      current.workshopCount += 1;
      geoMap.set(gov, current);
    });

    carOwners.forEach((owner) => {
      const gov = owner.governorate || 'Unknown';
      const current = geoMap.get(gov) || { workshopCount: 0, userCount: 0 };
      current.userCount += 1;
      geoMap.set(gov, current);
    });

    return Array.from(geoMap.entries())
      .map(([governorate, data]) => ({
        governorate,
        workshopCount: data.workshopCount,
        userCount: data.userCount,
        totalCount: data.workshopCount + data.userCount,
      }))
      .sort((a, b) => b.totalCount - a.totalCount);
  }

  /**
   * Calculate language preferences
   */
  private calculateLanguagePreferences(carOwners: CarOwnerProfile[]): LanguagePreference[] {
    const langMap = new Map<string, number>();

    carOwners.forEach((owner) => {
      const lang = owner.preferredLanguage || 'Not Set';
      langMap.set(lang, (langMap.get(lang) || 0) + 1);
    });

    const total = carOwners.length || 1;

    return Array.from(langMap.entries())
      .map(([language, count]) => ({
        language,
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Calculate customer insights (repeat customers, active users, etc.)
   */
  private calculateCustomerInsights(
    carOwners: CarOwnerProfile[],
    bookings: Booking[]
  ): CustomerInsights {
    const totalCustomers = carOwners.length;

    // Group bookings by car owner
    const bookingsByOwner = new Map<number, number>();
    bookings.forEach((booking) => {
      // Note: We need to join with cars to get carOwnerProfileId
      // For now, we'll estimate based on unique booking patterns
    });

    // Count unique customers who made bookings
    const uniqueCustomerIds = new Set(
      bookings.map((b) => b.workShopProfileId) // This is a simplification
    );

    // Calculate repeat customers (those with more than 1 booking)
    const repeatCustomers = 0; // Will need proper join with cars table
    const repeatCustomerRate = 0; // Placeholder

    // Average bookings per customer
    const averageBookingsPerCustomer = totalCustomers > 0 ? bookings.length / totalCustomers : 0;

    // Active vs inactive (those who booked in last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const activeBookings = bookings.filter(
      (b) => new Date(b.createdAt) >= ninetyDaysAgo
    ).length;

    const activeCustomers = Math.min(activeBookings, totalCustomers);
    const inactiveCustomers = totalCustomers - activeCustomers;

    return {
      totalCustomers,
      repeatCustomers,
      repeatCustomerRate,
      averageBookingsPerCustomer: Math.round(averageBookingsPerCustomer * 100) / 100,
      activeCustomers,
      inactiveCustomers,
    };
  }

  /**
   * Calculate operational metrics (lead time, confirmation rate, etc.)
   */
  private calculateOperationalMetrics(bookings: Booking[]): OperationalMetrics {
    if (bookings.length === 0) {
      return {
        averageLeadTime: 0,
        confirmationRate: 0,
        completionRate: 0,
        averageServiceValue: 0,
      };
    }

    // Calculate average lead time (days between booking and appointment)
    const leadTimes = bookings
      .map((b) => {
        const created = new Date(b.createdAt);
        const appointment = new Date(b.appointmentDate);
        return (appointment.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      })
      .filter((days) => days >= 0);

    const averageLeadTime =
      leadTimes.length > 0
        ? Math.round((leadTimes.reduce((sum, d) => sum + d, 0) / leadTimes.length) * 10) / 10
        : 0;

    // Calculate confirmation rate (both parties confirmed)
    const confirmedBookings = bookings.filter(
      (b) => b.carOwnerConfirmed === true && b.workshopOwnerConfirmed === true
    ).length;
    const confirmationRate = Math.round((confirmedBookings / bookings.length) * 100);

    // Calculate completion rate
    const completedBookings = bookings.filter((b) => b.status === 'Completed').length;
    const completionRate = Math.round((completedBookings / bookings.length) * 100);

    // Calculate average service value (from completed & paid bookings)
    const paidBookings = bookings.filter(
      (b) => b.status === 'Completed' && b.paymentStatus === 'Paid'
    );
    const totalRevenue = paidBookings.reduce((sum, b) => sum + (b.paidAmount || 0), 0);
    const averageServiceValue =
      paidBookings.length > 0 ? Math.round(totalRevenue / paidBookings.length) : 0;

    return {
      averageLeadTime,
      confirmationRate,
      completionRate,
      averageServiceValue,
    };
  }

  /**
   * Calculate rating distribution (1-5 stars)
   */
  private calculateRatingDistribution(workshops: WorkshopProfile[]): RatingDistribution[] {
    const ratingCounts = new Map<number, number>();
    [1, 2, 3, 4, 5].forEach((rating) => ratingCounts.set(rating, 0));

    workshops.forEach((workshop) => {
      const rating = Math.round(workshop.rating);
      if (rating >= 1 && rating <= 5) {
        ratingCounts.set(rating, (ratingCounts.get(rating) || 0) + 1);
      }
    });

    const total = workshops.length || 1;

    return [1, 2, 3, 4, 5].map((rating) => ({
      rating,
      count: ratingCounts.get(rating) || 0,
      percentage: Math.round(((ratingCounts.get(rating) || 0) / total) * 100),
    }));
  }

  /**
   * Calculate revenue by workshop type
   */
  private calculateRevenueByWorkshopType(
    workshops: WorkshopProfile[],
    bookings: Booking[]
  ): RevenueByWorkshopType[] {
    const typeRevenueMap = new Map<string, { revenue: number; bookingCount: number }>();

    // Build workshop type lookup
    const workshopTypes = new Map<number, string>();
    workshops.forEach((w) => workshopTypes.set(w.id, w.workShopType));

    bookings.forEach((booking) => {
      const type = workshopTypes.get(booking.workShopProfileId) || 'Unknown';
      const current = typeRevenueMap.get(type) || { revenue: 0, bookingCount: 0 };
      current.revenue += booking.paidAmount || 0;
      current.bookingCount += 1;
      typeRevenueMap.set(type, current);
    });

    const totalRevenue = Array.from(typeRevenueMap.values()).reduce(
      (sum, data) => sum + data.revenue,
      0
    );

    return Array.from(typeRevenueMap.entries())
      .map(([type, data]) => ({
        type,
        revenue: data.revenue,
        bookingCount: data.bookingCount,
        averageValue: data.bookingCount > 0 ? Math.round(data.revenue / data.bookingCount) : 0,
        percentage: totalRevenue > 0 ? Math.round((data.revenue / totalRevenue) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  /**
   * Calculate workshop size categories by technician count
   */
  private calculateWorkshopSizeCategories(workshops: WorkshopProfile[]): WorkshopSizeCategory[] {
    const categories = [
      { category: 'Small (1-5)', min: 1, max: 5 },
      { category: 'Medium (6-15)', min: 6, max: 15 },
      { category: 'Large (16+)', min: 16, max: 9999 },
    ];

    const categoryCounts = new Map<string, number>();
    categories.forEach((cat) => categoryCounts.set(cat.category, 0));

    workshops.forEach((workshop) => {
      const techCount = workshop.numbersOfTechnicians;
      for (const cat of categories) {
        if (techCount >= cat.min && techCount <= cat.max) {
          categoryCounts.set(cat.category, (categoryCounts.get(cat.category) || 0) + 1);
          break;
        }
      }
    });

    const total = workshops.length || 1;

    return categories.map((cat) => ({
      category: cat.category,
      count: categoryCounts.get(cat.category) || 0,
      percentage: Math.round(((categoryCounts.get(cat.category) || 0) / total) * 100),
      minTechnicians: cat.min,
      maxTechnicians: cat.max === 9999 ? Infinity : cat.max,
    }));
  }

  /**
   * Calculate top workshops by revenue
   */
  private calculateTopWorkshopsByRevenue(
    workshops: WorkshopProfile[],
    bookings: Booking[]
  ): TopWorkshop[] {
    const workshopRevenue = new Map<number, { count: number; revenue: number }>();

    bookings.forEach((booking) => {
      const workshopId = booking.workShopProfileId;
      const current = workshopRevenue.get(workshopId) || { count: 0, revenue: 0 };
      current.count += 1;
      current.revenue += booking.paidAmount || 0;
      workshopRevenue.set(workshopId, current);
    });

    return workshops
      .map((workshop) => {
        const stats = workshopRevenue.get(workshop.id) || { count: 0, revenue: 0 };
        return {
          id: workshop.id,
          name: workshop.name,
          rating: workshop.rating,
          totalBookings: stats.count,
          totalRevenue: stats.revenue,
          logoImageUrl: workshop.logoImageUrl,
        };
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10);
  }
}
