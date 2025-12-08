export interface AdminDashboardStats {
  totalUsers: number;
  totalWorkshops: number;
  totalCarOwners: number;
  totalCars: number;
  totalBookings: number;
  totalRevenue: number;
  verifiedWorkshops: number;
  pendingWorkshops: number;
  averageWorkshopRating: number;
  monthlyRevenue: MonthlyRevenue[];
  bookingStatusDistribution: BookingStatusCount[];
  workshopTypeDistribution: WorkshopTypeCount[];
  verificationStatusDistribution: VerificationStatusCount[];
  topPerformingWorkshops: TopWorkshop[];
  carOriginDistribution: CarOriginCount[];

  // NEW ANALYTICS
  paymentMethodDistribution: PaymentMethodCount[];
  topCarBrands: CarBrandCount[];
  topCarModels: CarModelCount[];
  transmissionTypeDistribution: TransmissionTypeCount[];
  fuelTypeDistribution: FuelTypeCount[];
  fleetAgeDistribution: FleetAgeDistribution[];
  geographicDistribution: GeographicDistribution[];
  languagePreferences: LanguagePreference[];
  customerInsights: CustomerInsights;
  operationalMetrics: OperationalMetrics;
  ratingDistribution: RatingDistribution[];
  revenueByWorkshopType: RevenueByWorkshopType[];
  workshopSizeCategories: WorkshopSizeCategory[];
  topWorkshopsByRevenue: TopWorkshop[];
}

export interface MonthlyRevenue {
  month: string;
  revenue: number;
  bookingCount: number;
}

export interface BookingStatusCount {
  status: string;
  count: number;
  percentage: number;
}

export interface WorkshopTypeCount {
  type: string;
  count: number;
  percentage: number;
}

export interface VerificationStatusCount {
  status: string;
  count: number;
  percentage: number;
}

export interface TopWorkshop {
  id: number;
  name: string;
  rating: number;
  totalBookings: number;
  totalRevenue: number;
  logoImageUrl?: string | null;
}

export interface CarOriginCount {
  origin: string;
  count: number;
  percentage: number;
}

export interface WorkshopPerformanceMetrics {
  workshopId: number;
  workshopName: string;
  rating: number;
  techniciansCount: number;
  location: string;
  workshopType: string;
  verificationStatus: string;
  totalBookings: number;
  totalRevenue: number;
  completedBookings: number;
  pendingBookings: number;
  logoImageUrl?: string | null;
}

export interface BookingTrendData {
  date: string;
  bookingCount: number;
  revenue: number;
}

export interface RevenueAnalytics {
  totalRevenue: number;
  maintenanceRevenue: number;
  averageBookingValue: number;
  monthlyGrowth: number;
  highestRevenueMonth: string;
  lowestRevenueMonth: string;
}

// ============================================
// NEW ANALYTICS INTERFACES
// ============================================

export interface PaymentMethodCount {
  method: string;
  count: number;
  revenue: number;
  percentage: number;
}

export interface CarBrandCount {
  brand: string;
  count: number;
  percentage: number;
}

export interface CarModelCount {
  model: string;
  brand: string;
  count: number;
  percentage: number;
}

export interface TransmissionTypeCount {
  type: string;
  count: number;
  percentage: number;
}

export interface FuelTypeCount {
  type: string;
  count: number;
  percentage: number;
}

export interface FleetAgeDistribution {
  ageRange: string;
  count: number;
  percentage: number;
}

export interface GeographicDistribution {
  governorate: string;
  workshopCount: number;
  userCount: number;
  totalCount: number;
}

export interface LanguagePreference {
  language: string;
  count: number;
  percentage: number;
}

export interface CustomerInsights {
  totalCustomers: number;
  repeatCustomers: number;
  repeatCustomerRate: number;
  averageBookingsPerCustomer: number;
  activeCustomers: number;
  inactiveCustomers: number;
}

export interface OperationalMetrics {
  averageLeadTime: number; // days between booking creation and appointment
  confirmationRate: number; // percentage of bookings confirmed by both parties
  completionRate: number; // percentage of bookings completed
  averageServiceValue: number;
}

export interface RatingDistribution {
  rating: number;
  count: number;
  percentage: number;
}

export interface RevenueByWorkshopType {
  type: string;
  revenue: number;
  bookingCount: number;
  averageValue: number;
  percentage: number;
}

export interface WorkshopSizeCategory {
  category: string; // Small (1-5), Medium (6-15), Large (16+)
  count: number;
  percentage: number;
  minTechnicians: number;
  maxTechnicians: number;
}
