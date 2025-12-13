import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { VehicleInfoComponent } from './vehicle-info/vehicle-info.component';
import { environment } from '../../../environments/environment';
import {
  CarExpenseService,
  CreateCarExpenseRequest,
  ExpenseType,
} from '../../services/car-expense.service';

interface Vehicle {
  id: string;
  year: number;
  make: string;
  model: string;
  licensePlate: string;
  currentMileage: number;
  vin: string;
  engineType: string;
  color: string;
  imageUrl: string;
  lastMaintenanceDate: string;
  nextMaintenanceDate: string;
  nextMaintenanceMileage: number;
  conditionIndicators: ConditionIndicator[];
}

type IndicatorType =
  | 'ACService'
  | 'CarLicenseAndEnsuranceExpiry'
  | 'GeneralMaintenance'
  | 'OilChange'
  | 'BatteryHealth'
  | 'TireChange';
type CarStatus = 'Normal' | 'Warning' | 'Critical' | 'UnKnown';

interface ConditionIndicator {
  id: number;
  indicatorType: IndicatorType;
  carStatus: CarStatus;
  lastCheckedDate: string;
  nextCheckedDate: string;
  nextMileage: number;
  mileageDifference: number;
  timeDifference: string;
  timeDifferenceAsPercentage: number;
  carId: number;
  // UI properties
  name: string;
  type: IndicatorType;
  status: CarStatus;
  icon: string;
  lastInspectionDate: string;
  nextInspectionDate: string;
  remaining: number;
  reminderEnabled: boolean;
  notes: string;
  trend: 'improving' | 'stable' | 'declining';
  lastServiceCost: number;
}

interface TimelineEvent {
  date: Date;
  indicator: ConditionIndicator;
  isPast: boolean;
  dayOffset: number;
}

interface CalendarDay {
  date: number;
  services: ConditionIndicator[];
  isToday: boolean;
  isWeekend: boolean;
}

interface IndicatorHistory {
  month: string;
  condition: number;
}

interface ServiceHistory {
  date: string;
  type: string;
  mileage: number;
  cost: number;
}

// API Response interface for booking services with review
interface BookingServiceWithReview {
  id: number;
  appointmentDate: string;
  issueDescription: string;
  reviewPaidAmount: number;
  serviceName: string;
  serviceDescription: string;
}

interface ServiceCenter {
  name: string;
  distance: number;
  rating: number;
}

interface SmartAlert {
  type: string;
  message: string;
}

interface Expense {
  id: number | undefined;
  name: string;
  date: string;
  amount: number;
  icon: string;
  carId: number | null;
  description?: string;
}

interface NewExpenseForm {
  expenseType: ExpenseType | '';
  expenseDate: string;
  amount: number | null;
  description: string;
  carId: number | null;
  icon: string;
}

@Component({
  selector: 'app-car-details',
  standalone: true,
  imports: [CommonModule, FormsModule, VehicleInfoComponent],
  templateUrl: './car-details.component.html',
  styleUrls: ['./car-details.component.css'],
})
export class CarDetailsComponent implements OnInit {
  vehicle: Vehicle | null = null;
  vehicleId: string | null = null;
  imageLoaded = true;
  imageError = false;
  isLoadingIndicators = true;

  // New properties for enhanced features
  remindersEnabled = true;
  editMileage = false;
  selectedPackage: 'basic' | 'premium' = 'premium';
  showChecklist = true;
  expandedIndicators = new Set<number>();

  // Condition Indicators enhanced properties
  indicatorView: 'grid' | 'timeline' | 'calendar' = 'grid';
  calendarMonth = 10; // November (0-indexed)
  calendarYear = 2025;

  // Expense state
  expenses: Expense[] = [];
  deletingExpenseIds: Set<number> = new Set<number>();
  isAddExpenseModalOpen = false;
  isSavingExpense = false;
  expenseMessage = '';
  expenseMessageType: 'success' | 'error' | null = null;
  submittedExpense = false;
  newExpenseForm: NewExpenseForm = {
    expenseType: '',
    expenseDate: new Date().toISOString().split('T')[0],
    amount: null,
    description: '',
    carId: null,
    icon: '⛽',
  };
  expenseTypes: ExpenseType[] = ['Fuel', 'Maintenance', 'Repair', 'Insurance', 'Other'];

  // Service History from API
  bookingServiceHistory: BookingServiceWithReview[] = [];
  isLoadingServiceHistory = false;
  serviceHistoryError = '';

  private apiUrl = `${environment.apiBase}/CarIndicator/car`;
  private bookingApiUrl = `${environment.apiBase}/Booking`;
  private pendingFragment: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private carExpenseService: CarExpenseService
  ) {}

  ngOnInit(): void {
    // Scroll to top when component loads
    window.scrollTo(0, 0);

    this.vehicleId = this.route.snapshot.paramMap.get('id');
    this.loadVehicleDetails();
    this.loadExpensesForCar();
    this.loadServiceHistory();

    // Listen for fragment navigation (e.g., from My Vehicles indicators)
    this.route.fragment.subscribe((fragment) => {
      if (!fragment) return;
      // store pending fragment and attempt to scroll when indicators are ready
      this.pendingFragment = fragment;
      this.tryScrollToFragment();
    });
  }

  loadVehicleDetails(): void {
    // Mock vehicle data - replace with actual service call
    const imageUrl = this.getRealCarImage('Toyota', 'Camry', 2020);

    this.vehicle = {
      id: this.vehicleId || '2',
      year: 2020,
      make: 'Toyota',
      model: 'Camry',
      licensePlate: 'ABC 1234',
      currentMileage: 50000,
      vin: 'THGB541A0M100196',
      engineType: '2.5L 4-Cylinder',
      color: 'Pearl White',
      imageUrl: imageUrl,
      lastMaintenanceDate: '10/28/2025',
      nextMaintenanceDate: '11/25/2025',
      nextMaintenanceMileage: 50000,
      conditionIndicators: [],
    };

    // Preload the image
    this.preloadImage(imageUrl);

    // Load indicators from API
    this.loadIndicatorsFromAPI();
  }

  preloadImage(url: string): void {
    // Show generic car immediately
    this.vehicle!.imageUrl = '/Assets/images/Generic-Car2.jpg';
    this.imageLoaded = true;
    this.imageError = false;

    // Try to load the actual image in background
    if (url && url !== '/Assets/images/Generic-Car2.jpg') {
      const timeout = setTimeout(() => {
        console.log('Image loading timeout, keeping generic image');
      }, 3000); // 3 second timeout

      const img = new Image();
      img.onload = () => {
        clearTimeout(timeout);
        // Replace generic with actual image
        this.vehicle!.imageUrl = url;
        console.log('Actual car image loaded successfully');
      };
      img.onerror = () => {
        clearTimeout(timeout);
        console.log('Image failed to load, keeping generic image');
      };
      img.src = url;
    }
  }

  loadIndicatorsFromAPI(): void {
    const carId = this.vehicleId || '2';
    this.isLoadingIndicators = true;
    this.http.get<any>(`${this.apiUrl}/${carId}`).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.vehicle!.conditionIndicators = response.data.map((indicator: any) =>
            this.mapIndicatorFromAPI(indicator)
          );
        }
        this.isLoadingIndicators = false;
        // Attempt to scroll if navigation requested a fragment
        this.tryScrollToFragment();
      },
      error: (error) => {
        console.error('Error loading indicators:', error);
        // Load fallback mock data
        this.loadMockIndicators();
        this.isLoadingIndicators = false;
        // Attempt to scroll if navigation requested a fragment
        this.tryScrollToFragment();
      },
    });
  }

  private tryScrollToFragment(): void {
    if (!this.pendingFragment) return;
    // Only scroll when indicators have finished loading
    if (this.isLoadingIndicators) return;

    // Small timeout to ensure DOM has rendered
    setTimeout(() => {
      const fragment = this.pendingFragment as string;
      this.pendingFragment = null;
      if (fragment === 'vehicle-health') {
        const el = document.getElementById('vehicle-health-status');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          // add a temporary highlight for visibility
          el.classList.add('highlight-fragment');
          setTimeout(() => el.classList.remove('highlight-fragment'), 2200);
        }
      }
    }, 120);
  }

  mapIndicatorFromAPI(apiIndicator: any): ConditionIndicator {
    const indicatorNames: Record<IndicatorType, string> = {
      ACService: 'AC Service',
      CarLicenseAndEnsuranceExpiry: 'Car License & Insurance Expiry',
      GeneralMaintenance: 'General Maintenance',
      OilChange: 'Oil Change',
      BatteryHealth: 'Battery Health',
      TireChange: 'Tire Change',
    };

    const indicatorIcons: Record<IndicatorType, string> = {
      ACService: '❄️',
      CarLicenseAndEnsuranceExpiry: '📄',
      GeneralMaintenance: '⚠️',
      OilChange: '💧',
      BatteryHealth: '🔋',
      TireChange: '🔴',
    };

    // Calculate remaining days or km
    const remaining =
      apiIndicator.indicatorType === 'CarLicenseAndEnsuranceExpiry'
        ? Math.floor(this.parseDuration(apiIndicator.timeDifference) / (1000 * 60 * 60 * 24))
        : apiIndicator.mileageDifference;

    return {
      // API fields
      id: apiIndicator.id,
      indicatorType: apiIndicator.indicatorType,
      carStatus: apiIndicator.carStatus,
      lastCheckedDate: apiIndicator.lastCheckedDate,
      nextCheckedDate: apiIndicator.nextCheckedDate,
      nextMileage: apiIndicator.nextMileage,
      mileageDifference: apiIndicator.mileageDifference,
      timeDifference: apiIndicator.timeDifference,
      timeDifferenceAsPercentage: apiIndicator.timeDifferenceAsPercentage,
      carId: apiIndicator.carId,
      // UI fields
      name:
        indicatorNames[apiIndicator.indicatorType as IndicatorType] || apiIndicator.indicatorType,
      type: apiIndicator.indicatorType,
      status: apiIndicator.carStatus,
      icon: indicatorIcons[apiIndicator.indicatorType as IndicatorType] || '🔧',
      lastInspectionDate: new Date(apiIndicator.lastCheckedDate).toLocaleDateString('en-US'),
      nextInspectionDate: new Date(apiIndicator.nextCheckedDate).toLocaleDateString('en-US'),
      remaining: remaining,
      reminderEnabled: true,
      notes: '',
      trend: this.calculateTrend(apiIndicator.timeDifferenceAsPercentage),
      lastServiceCost: this.estimateCost(apiIndicator.indicatorType),
    };
  }

  parseDuration(duration: string): number {
    // Parse .NET TimeSpan format "11.18:19:57.5439425"
    const parts = duration.split(':');
    const days = parseInt(parts[0].split('.')[0] || '0');
    const hours = parseInt(parts[0].split('.')[1] || '0');
    const minutes = parseInt(parts[1] || '0');
    const seconds = parseFloat(parts[2] || '0');
    return (days * 24 * 60 * 60 + hours * 60 * 60 + minutes * 60 + seconds) * 1000;
  }

  calculateTrend(percentage: number): 'improving' | 'stable' | 'declining' {
    if (percentage > 50) return 'improving';
    if (percentage > 20) return 'stable';
    return 'declining';
  }

  estimateCost(type: IndicatorType): number {
    const costs: Record<IndicatorType, number> = {
      ACService: 350,
      CarLicenseAndEnsuranceExpiry: 500,
      GeneralMaintenance: 1200,
      OilChange: 250,
      BatteryHealth: 450,
      TireChange: 800,
    };
    return costs[type] || 300;
  }

  loadMockIndicators(): void {
    // Fallback mock data if API fails
    this.vehicle!.conditionIndicators = [
      {
        id: 1,
        indicatorType: 'OilChange',
        carStatus: 'Normal',
        lastCheckedDate: '2025-10-28T10:00:00',
        nextCheckedDate: '2025-11-25T10:00:00',
        nextMileage: 50000,
        mileageDifference: 5000,
        timeDifference: '27.00:00:00',
        timeDifferenceAsPercentage: 45,
        carId: 2,
        name: 'Oil Change',
        type: 'OilChange',
        status: 'Normal',
        icon: '💧',
        lastInspectionDate: '10/28/2025',
        nextInspectionDate: '11/25/2025',
        remaining: 5000,
        reminderEnabled: true,
        notes: '',
        trend: 'stable',
        lastServiceCost: 250,
      },
      {
        id: 2,
        indicatorType: 'TireChange',
        carStatus: 'Warning',
        lastCheckedDate: '2025-09-15T10:00:00',
        nextCheckedDate: '2025-11-20T10:00:00',
        nextMileage: 47000,
        mileageDifference: 2000,
        timeDifference: '1.00:00:00',
        timeDifferenceAsPercentage: 15,
        carId: 2,
        name: 'Tire Change',
        type: 'TireChange',
        status: 'Warning',
        icon: '🔴',
        lastInspectionDate: '9/15/2025',
        nextInspectionDate: '11/20/2025',
        remaining: 2000,
        reminderEnabled: true,
        notes: 'Front tires showing wear',
        trend: 'declining',
        lastServiceCost: 800,
      },
      {
        id: 3,
        indicatorType: 'BatteryHealth',
        carStatus: 'Normal',
        lastCheckedDate: '2025-08-20T10:00:00',
        nextCheckedDate: '2026-02-20T10:00:00',
        nextMileage: 60000,
        mileageDifference: 15000,
        timeDifference: '93.00:00:00',
        timeDifferenceAsPercentage: 75,
        carId: 2,
        name: 'Battery Health',
        type: 'BatteryHealth',
        status: 'Normal',
        icon: '🔋',
        lastInspectionDate: '8/20/2025',
        nextInspectionDate: '2/20/2026',
        remaining: 15000,
        reminderEnabled: false,
        notes: '',
        trend: 'improving',
        lastServiceCost: 450,
      },
      {
        id: 4,
        indicatorType: 'ACService',
        carStatus: 'Warning',
        lastCheckedDate: '2025-05-10T10:00:00',
        nextCheckedDate: '2025-11-10T10:00:00',
        nextMileage: 46000,
        mileageDifference: 1000,
        timeDifference: '0.12:00:00',
        timeDifferenceAsPercentage: 2,
        carId: 2,
        name: 'AC Service',
        type: 'ACService',
        status: 'Warning',
        icon: '❄️',
        lastInspectionDate: '5/10/2025',
        nextInspectionDate: '11/10/2025',
        remaining: 1000,
        reminderEnabled: true,
        notes: 'Low refrigerant level detected',
        trend: 'declining',
        lastServiceCost: 350,
      },
      {
        id: 5,
        indicatorType: 'GeneralMaintenance',
        carStatus: 'Critical',
        lastCheckedDate: '2025-10-01T10:00:00',
        nextCheckedDate: '2025-11-18T10:00:00',
        nextMileage: 45500,
        mileageDifference: 500,
        timeDifference: '0.06:00:00',
        timeDifferenceAsPercentage: 1,
        carId: 2,
        name: 'General Maintenance',
        type: 'GeneralMaintenance',
        status: 'Critical',
        icon: '⚠️',
        lastInspectionDate: '10/1/2025',
        nextInspectionDate: '11/18/2025',
        remaining: 500,
        reminderEnabled: true,
        notes: 'Urgent: Multiple systems need attention',
        trend: 'declining',
        lastServiceCost: 1200,
      },
      {
        id: 6,
        indicatorType: 'CarLicenseAndEnsuranceExpiry',
        carStatus: 'Warning',
        lastCheckedDate: '2025-01-01T10:00:00',
        nextCheckedDate: '2026-01-01T10:00:00',
        nextMileage: 0,
        mileageDifference: 0,
        timeDifference: '43.00:00:00',
        timeDifferenceAsPercentage: 11.8,
        carId: 2,
        name: 'Car License & Insurance Expiry',
        type: 'CarLicenseAndEnsuranceExpiry',
        status: 'Warning',
        icon: '📄',
        lastInspectionDate: '1/1/2025',
        nextInspectionDate: '1/1/2026',
        remaining: 43,
        reminderEnabled: true,
        notes: 'Renewal documents prepared',
        trend: 'stable',
        lastServiceCost: 500,
      },
    ];
  }

  updateMileage(miles: number): void {
    if (this.vehicle) {
      this.vehicle.currentMileage = miles;
    }
  }

  updateVehicleInfo(info: any): void {
    if (!this.vehicle) return;

    // Update only the header/basic fields coming from the API
    if (info.make !== undefined) this.vehicle.make = info.make;
    if (info.model !== undefined) this.vehicle.model = info.model;
    if (info.year !== undefined) this.vehicle.year = info.year;
    if (info.licensePlate !== undefined) this.vehicle.licensePlate = info.licensePlate;
    if (info.currentMileage !== undefined) this.vehicle.currentMileage = info.currentMileage;

    // Update car image with real image when vehicle info is available
    if (info.make && info.model && info.year) {
      this.vehicle.imageUrl = this.getRealCarImage(info.make, info.model, info.year);
      // Reset image loading state to show the new image
      this.imageLoaded = false;
      this.imageError = false;
    }
    // If engineCapacity is present and you want to show it elsewhere, map it accordingly
    // Leave maintenance and condition indicators untouched
  }

  goBack(): void {
    this.router.navigate(['/my-vehicles']);
  }

  editCarAndIndicators(): void {
    if (this.vehicle?.id) {
      this.router.navigate(['/edit-car', this.vehicle.id]);
    }
  }

  onImageLoad(): void {
    this.imageLoaded = true;
    this.imageError = false;
  }

  onImageError(): void {
    // If the real car image fails, fallback to generic image
    if (this.vehicle && this.vehicle.imageUrl !== '/Assets/images/Generic-Car2.jpg') {
      console.log('Real car image failed to load:', this.vehicle.imageUrl);
      console.log('Falling back to generic image');
      this.vehicle.imageUrl = '/Assets/images/Generic-Car2.jpg';
      this.imageLoaded = false;
      this.imageError = false;
    } else {
      console.log('Generic image also failed to load');
      this.imageLoaded = false;
      this.imageError = true;
    }
  }

  getStatusClass(status: CarStatus): string {
    return `status-${status.toLowerCase()}`;
  }

  // Get icon for indicator type
  getIndicatorIcon(type: IndicatorType): string {
    const iconMap: Record<IndicatorType, string> = {
      OilChange: '🛢️',
      TireChange: '🔴',
      BatteryHealth: '🔋',
      ACService: '❄️',
      GeneralMaintenance: '🔧',
      CarLicenseAndEnsuranceExpiry: '📄',
    };
    return iconMap[type] || '🔧';
  }

  getRealCarImage(make: string, model: string, year: number): string {
    // Using Imagin Studio API for real car images
    const makeNormalized = make?.trim() || '';
    const modelNormalized = model?.trim() || '';

    // Fetch real car image with watermark
    const imaginUrl = `https://cdn.imagin.studio/getimage?customer=hrjavascript-mastery&make=${makeNormalized}&modelFamily=${modelNormalized}&zoomType=fullscreen&year=${year}&angle=01`;

    console.log('Generated car image URL:', imaginUrl);
    return imaginUrl;
  }

  getCarLogo(make: string): string {
    const makeNormalized = make?.toLowerCase().trim() || '';
    const logoMap: { [key: string]: string } = {
      toyota: 'https://www.carlogos.org/car-logos/toyota-logo.png',
      honda: 'https://www.carlogos.org/car-logos/honda-logo.png',
      ford: 'https://www.carlogos.org/car-logos/ford-logo.png',
      chevrolet: 'https://www.carlogos.org/car-logos/chevrolet-logo.png',
      bmw: 'https://www.carlogos.org/car-logos/bmw-logo.png',
      mercedes: 'https://www.carlogos.org/car-logos/mercedes-benz-logo.png',
      'mercedes-benz': 'https://www.carlogos.org/car-logos/mercedes-benz-logo.png',
      audi: 'https://www.carlogos.org/car-logos/audi-logo.png',
      volkswagen: 'https://www.carlogos.org/car-logos/volkswagen-logo.png',
      nissan: 'https://www.carlogos.org/car-logos/nissan-logo.png',
      hyundai: 'https://www.carlogos.org/car-logos/hyundai-logo.png',
      kia: 'https://www.carlogos.org/car-logos/kia-logo.png',
      mazda: 'https://www.carlogos.org/car-logos/mazda-logo.png',
      subaru: 'https://www.carlogos.org/car-logos/subaru-logo.png',
      lexus: 'https://www.carlogos.org/car-logos/lexus-logo.png',
      tesla: 'https://www.carlogos.org/car-logos/tesla-logo.png',
      porsche: 'https://www.carlogos.org/car-logos/porsche-logo.png',
      jeep: 'https://www.carlogos.org/car-logos/jeep-logo.png',
      dodge: 'https://www.carlogos.org/car-logos/dodge-logo.png',
      ram: 'https://www.carlogos.org/car-logos/ram-logo.png',
      volvo: 'https://www.carlogos.org/car-logos/volvo-logo.png',
      'land rover': 'https://www.carlogos.org/car-logos/land-rover-logo.png',
      jaguar: 'https://www.carlogos.org/car-logos/jaguar-logo.png',
      mitsubishi: 'https://www.carlogos.org/car-logos/mitsubishi-logo.png',
      peugeot: 'https://www.carlogos.org/car-logos/peugeot-logo.png',
      renault: 'https://www.carlogos.org/car-logos/renault-logo.png',
      fiat: 'https://www.carlogos.org/car-logos/fiat-logo.png',
      'alfa romeo': 'https://www.carlogos.org/car-logos/alfa-romeo-logo.png',
      mini: 'https://www.carlogos.org/car-logos/mini-logo.png',
      skoda: 'https://www.carlogos.org/car-logos/skoda-logo.png',
      seat: 'https://www.carlogos.org/car-logos/seat-logo.png',
    };
    return logoMap[makeNormalized] || '';
  }

  parseLicensePlate(plate: string): { letters: string; numbers: string } {
    if (!plate) return { letters: '', numbers: '' };
    const letters = plate.replace(/[0-9]/g, '').trim();
    const numbers = plate.replace(/[^0-9]/g, '').trim();
    return { letters, numbers };
  }

  // Phase 1: Summary counts
  getGoodCount(): number {
    return this.vehicle?.conditionIndicators.filter((i) => i.status === 'Normal').length || 0;
  }

  getAttentionCount(): number {
    return this.vehicle?.conditionIndicators.filter((i) => i.status === 'Warning').length || 0;
  }

  getUrgentCount(): number {
    return this.vehicle?.conditionIndicators.filter((i) => i.status === 'Critical').length || 0;
  }

  // Toggle indicator expansion
  toggleIndicator(index: number): void {
    if (this.expandedIndicators.has(index)) {
      this.expandedIndicators.delete(index);
    } else {
      this.expandedIndicators.add(index);
    }
  }

  // Calculate progress percentage
  getProgressPercentage(indicator: ConditionIndicator): number {
    const total = indicator.nextMileage - (this.vehicle?.currentMileage || 0) + indicator.remaining;
    const remaining = indicator.remaining;
    return Math.max(0, Math.min(100, Math.round((remaining / total) * 100)));
  }

  // Get progress class for color coding
  getProgressClass(indicator: ConditionIndicator): string {
    const percentage = this.getProgressPercentage(indicator);
    if (percentage > 50) return 'progress-normal';
    if (percentage > 20) return 'progress-warning';
    return 'progress-critical';
  }

  // Get recommendation based on indicator status
  getRecommendation(indicator: ConditionIndicator): string {
    switch (indicator.status) {
      case 'Normal':
        return 'Continue regular monitoring';
      case 'Warning':
        return 'Schedule service within 2 weeks';
      case 'Critical':
        return 'Service required immediately';
      case 'UnKnown':
        return 'Status check needed';
      default:
        return 'Monitor regularly';
    }
  }

  // ===== NEW METHODS FOR ENHANCED MAINTENANCE UI =====

  // Reminders Toggle
  toggleReminders(): void {
    this.remindersEnabled = !this.remindersEnabled;
    console.log('Reminders', this.remindersEnabled ? 'enabled' : 'disabled');
  }

  // Smart Alert System
  getSmartAlert(): SmartAlert | null {
    if (!this.vehicle) return null;

    const remainingKm = this.getRemainingKm();
    const daysUntil = this.getDaysUntilMaintenance();

    if (remainingKm <= 500 || daysUntil <= 3) {
      return {
        type: 'urgent',
        message: '⚠️ Urgent: Book your service now! You have less than 500 km or 3 days remaining.',
      };
    } else if (remainingKm <= 1000 || daysUntil <= 7) {
      return {
        type: 'warning',
        message: '⚡ Book soon! Your service is approaching in the next week or 1,000 km.',
      };
    } else if (remainingKm <= 2000) {
      return {
        type: 'info',
        message: '📅 Plan ahead: Schedule your maintenance for optimal convenience.',
      };
    }
    return null;
  }

  // Circular Gauge Calculations
  getMileageCircumference(): string {
    const radius = 85;
    const circumference = 2 * Math.PI * radius;
    return `${circumference} ${circumference}`;
  }

  getMileageProgress(): number {
    if (!this.vehicle) return 0;
    const radius = 85;
    const circumference = 2 * Math.PI * radius;
    const totalMileage = this.vehicle.nextMaintenanceMileage;
    const currentMileage = this.vehicle.currentMileage;
    const percentage = (currentMileage / totalMileage) * 100;
    return circumference - (circumference * percentage) / 100;
  }

  getMileageUrgencyClass(): string {
    const remaining = this.getRemainingKm();
    if (remaining <= 500) return 'gauge-urgent';
    if (remaining <= 2000) return 'gauge-warning';
    return 'gauge-good';
  }

  getRemainingKm(): number {
    if (!this.vehicle) return 0;
    return Math.max(0, this.vehicle.nextMaintenanceMileage - this.vehicle.currentMileage);
  }

  // Countdown Calculations
  getDaysUntilMaintenance(): number {
    if (!this.vehicle) return 0;
    const today = new Date('2025-11-19'); // Current date from context
    const nextDate = new Date(this.vehicle.nextMaintenanceDate);
    const diffTime = nextDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }

  getDaysUrgencyClass(): string {
    const days = this.getDaysUntilMaintenance();
    if (days <= 3) return 'countdown-urgent';
    if (days <= 7) return 'countdown-warning';
    return 'countdown-good';
  }

  // Mileage Editing
  saveMileage(): void {
    this.editMileage = false;
    console.log('Mileage updated to:', this.vehicle?.currentMileage);
    // Here you would call your API to save the mileage
  }

  // Service Package Selection
  selectPackage(packageType: 'basic' | 'premium'): void {
    this.selectedPackage = packageType;
    console.log('Selected package:', packageType);
  }

  getEstimatedCost(packageType: 'basic' | 'premium'): number {
    return packageType === 'basic' ? 800 : 1500;
  }

  // Service History - Load from API
  loadServiceHistory(): void {
    if (!this.vehicleId) return;

    this.isLoadingServiceHistory = true;
    this.serviceHistoryError = '';

    this.http
      .get<{
        success: boolean;
        message: string;
        data: BookingServiceWithReview[];
      }>(`${this.bookingApiUrl}/Get-Booking-Services-With-Review-By-CarId/${this.vehicleId}`)
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.bookingServiceHistory = response.data;
          } else {
            this.bookingServiceHistory = [];
          }
          this.isLoadingServiceHistory = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error loading service history:', error);
          this.serviceHistoryError = 'Failed to load service history';
          this.bookingServiceHistory = [];
          this.isLoadingServiceHistory = false;
          this.cdr.markForCheck();
        },
      });
  }

  // Format date for display
  formatServiceDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  // Legacy method - kept for compatibility
  getRecentServices(): ServiceHistory[] {
    return [
      { date: 'Oct 28, 2025', type: 'Regular Maintenance', mileage: 40000, cost: 1200 },
      { date: 'Jul 15, 2025', type: 'Oil Change', mileage: 35000, cost: 600 },
      { date: 'Apr 10, 2025', type: 'Tire Rotation', mileage: 30000, cost: 400 },
    ];
  }

  viewAllHistory(): void {
    console.log('View all service history');
    // Navigate to full history page
  }

  // Nearby Service Centers
  getNearbyServiceCenters(): ServiceCenter[] {
    return [
      { name: 'Toyota Service Center - Nasr City', distance: 2.5, rating: 4.8 },
      { name: 'Auto Care Plus', distance: 3.2, rating: 4.6 },
      { name: 'Premium Motors Workshop', distance: 4.1, rating: 4.9 },
    ];
  }

  scheduleAtCenter(center: ServiceCenter): void {
    console.log('Schedule at:', center.name);
    // Open booking dialog
  }

  // Cost Tracking - Dynamic Analytics
  getCostHistory(): Array<{ month: string; cost: number }> {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const now = new Date();
    const result: Array<{ month: string; cost: number }> = [];

    // Get last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = months[date.getMonth()];

      // Calculate expenses for this month
      const expenseCost = this.expenses
        .filter((e) => e.date.startsWith(monthKey))
        .reduce((sum, e) => sum + e.amount, 0);

      // Calculate maintenance cost for this month
      const maintenanceCost = this.bookingServiceHistory
        .filter((s) => s.appointmentDate.startsWith(monthKey))
        .reduce((sum, s) => sum + s.reviewPaidAmount, 0);

      result.push({ month: monthName, cost: expenseCost + maintenanceCost });
    }

    return result;
  }

  getBarHeight(cost: number): number {
    const maxCost = Math.max(...this.getCostHistory().map((m) => m.cost), 100);
    return maxCost > 0 ? (cost / maxCost) * 100 : 0;
  }

  getTotalCost(): number {
    return this.getCostHistory().reduce((sum, month) => sum + month.cost, 0);
  }

  getAverageCost(): number {
    const history = this.getCostHistory();
    const nonZeroMonths = history.filter((m) => m.cost > 0).length || 1;
    return Math.round(this.getTotalCost() / nonZeroMonths);
  }

  // Advanced Analytics Methods
  getTotalMaintenanceCost(): number {
    return this.bookingServiceHistory.reduce((sum, s) => sum + s.reviewPaidAmount, 0);
  }

  getTotalExpensesCost(): number {
    return this.expenses.reduce((sum, e) => sum + e.amount, 0);
  }

  getMaintenanceCount(): number {
    return this.bookingServiceHistory.length;
  }

  getExpensesCount(): number {
    return this.expenses.length;
  }

  getGrandTotal(): number {
    return this.getTotalMaintenanceCost() + this.getTotalExpensesCost();
  }

  getMaintenancePercentage(): number {
    const total = this.getGrandTotal();
    return total > 0 ? Math.round((this.getTotalMaintenanceCost() / total) * 100) : 0;
  }

  getExpensesPercentage(): number {
    const total = this.getGrandTotal();
    return total > 0 ? Math.round((this.getTotalExpensesCost() / total) * 100) : 0;
  }

  getHighestSpendingMonth(): { month: string; cost: number } {
    const history = this.getCostHistory();
    return history.reduce((max, m) => (m.cost > max.cost ? m : max), { month: '-', cost: 0 });
  }

  getLowestSpendingMonth(): { month: string; cost: number } {
    const history = this.getCostHistory();
    const nonZero = history.filter((m) => m.cost > 0);
    if (nonZero.length === 0) return { month: '-', cost: 0 };
    return nonZero.reduce((min, m) => (m.cost < min.cost ? m : min), nonZero[0]);
  }

  getSpendingTrend(): 'up' | 'down' | 'stable' {
    const history = this.getCostHistory();
    if (history.length < 2) return 'stable';

    const recent = history.slice(-3).reduce((sum, m) => sum + m.cost, 0) / 3;
    const earlier = history.slice(0, 3).reduce((sum, m) => sum + m.cost, 0) / 3;

    if (recent > earlier * 1.1) return 'up';
    if (recent < earlier * 0.9) return 'down';
    return 'stable';
  }

  getExpensesByType(): Array<{ type: string; amount: number; percentage: number; icon: string }> {
    const typeMap = new Map<string, number>();

    // Add maintenance as a type
    if (this.getTotalMaintenanceCost() > 0) {
      typeMap.set('Maintenance', this.getTotalMaintenanceCost());
    }

    // Group expenses by type (name)
    this.expenses.forEach((e) => {
      const current = typeMap.get(e.name) || 0;
      typeMap.set(e.name, current + e.amount);
    });

    const total = this.getGrandTotal();
    const result: Array<{ type: string; amount: number; percentage: number; icon: string }> = [];

    const icons: { [key: string]: string } = {
      Maintenance: '🔧',
      Fuel: '⛽',
      Insurance: '🛡️',
      Repair: '🔨',
      Other: '📦',
    };

    typeMap.forEach((amount, type) => {
      result.push({
        type,
        amount,
        percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
        icon: icons[type] || '💰',
      });
    });

    return result.sort((a, b) => b.amount - a.amount);
  }

  getMonthlyAverage(): number {
    const history = this.getCostHistory();
    return Math.round(history.reduce((sum, m) => sum + m.cost, 0) / 6);
  }

  getLastMaintenanceDate(): string {
    if (this.bookingServiceHistory.length === 0) return 'N/A';
    const latest = this.bookingServiceHistory[0];
    return this.formatServiceDate(latest.appointmentDate);
  }

  getDaysSinceLastMaintenance(): number {
    if (this.bookingServiceHistory.length === 0) return 0;
    const latest = new Date(this.bookingServiceHistory[0].appointmentDate);
    const now = new Date();
    const diff = Math.floor((now.getTime() - latest.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff); // Return 0 if negative (future date in DB)
  }

  // Schedule Maintenance - Navigate to booking page
  scheduleMaintenanceDialog(): void {
    this.router.navigate(['/booking']);
  }

  // Service Checklist
  getServiceChecklist(): Array<{ name: string; note: string }> {
    return [
      { name: 'Engine Oil Replacement', note: 'Synthetic 5W-30' },
      { name: 'Oil Filter Change', note: 'OEM quality' },
      { name: 'Air Filter Inspection', note: 'Clean or replace' },
      { name: 'Brake System Check', note: 'Pads & fluid' },
      { name: 'Tire Pressure & Tread', note: 'All 4 wheels' },
      { name: 'Battery Health Test', note: 'Voltage check' },
      { name: 'Lights & Signals', note: 'All exterior lights' },
      { name: 'Fluid Level Check', note: 'Coolant, brake, etc.' },
    ];
  }

  // Seasonal Recommendation
  getSeasonalRecommendation(): { title: string; description: string } | null {
    const month = 11; // November from context
    if (month >= 11 || month <= 2) {
      return {
        title: 'Winter Preparation',
        description:
          'Consider checking antifreeze levels, battery health, and tire condition for winter driving.',
      };
    } else if (month >= 6 && month <= 8) {
      return {
        title: 'Summer Care',
        description: 'Hot weather tip: Check your AC system and coolant levels before summer heat.',
      };
    }
    return null;
  }

  // Predictive Maintenance
  getPredictiveInsight(): string {
    if (!this.vehicle) return '';
    const avgKmPerDay = 50; // Mock calculation
    const daysToNextService = Math.floor(this.getRemainingKm() / avgKmPerDay);

    if (daysToNextService < 30) {
      return `Based on your average daily usage of ${avgKmPerDay} km, you'll need service in approximately ${daysToNextService} days. We recommend booking in the next 2 weeks.`;
    }
    return `You're averaging ${avgKmPerDay} km per day. At this rate, you'll reach your next service milestone in about ${daysToNextService} days. Your vehicle is well-maintained!`;
  }

  // ===== CONDITION INDICATORS ENHANCEMENT METHODS =====

  // Priority Sorting
  getSortedIndicators(): ConditionIndicator[] {
    if (!this.vehicle?.conditionIndicators) return [];

    const priorityOrder = { Critical: 0, Warning: 1, Normal: 2, UnKnown: 3 };

    return [...this.vehicle.conditionIndicators].sort((a, b) => {
      // Sort by status priority first
      const priorityDiff = priorityOrder[a.status] - priorityOrder[b.status];
      if (priorityDiff !== 0) return priorityDiff;

      // Then by remaining km/days
      return (a.remaining || 0) - (b.remaining || 0);
    });
  }

  // Trend Analysis
  getTrendClass(trend: string): string {
    const trendMap: { [key: string]: string } = {
      improving: 'trend-improving',
      stable: 'trend-stable',
      declining: 'trend-declining',
    };
    return trendMap[trend] || 'trend-stable';
  }

  getTrendIcon(trend: string): string {
    const iconMap: { [key: string]: string } = {
      improving: '📈',
      stable: '➡️',
      declining: '📉',
    };
    return iconMap[trend] || '➡️';
  }

  getTrendText(trend: string): string {
    const textMap: { [key: string]: string } = {
      improving: 'Improving',
      stable: 'Stable',
      declining: 'Declining',
    };
    return textMap[trend] || 'Stable';
  }

  // Badge Display
  getRemainingUrgencyClass(remaining: number, type: IndicatorType): string {
    if (type === 'CarLicenseAndEnsuranceExpiry') {
      // Days-based
      if (remaining <= 30) return 'urgency-critical';
      if (remaining <= 60) return 'urgency-warning';
      return 'urgency-normal';
    } else {
      // Km-based
      if (remaining <= 1000) return 'urgency-critical';
      if (remaining <= 3000) return 'urgency-warning';
      return 'urgency-normal';
    }
  }

  getRemainingDisplay(indicator: ConditionIndicator): string {
    if (indicator.type === 'CarLicenseAndEnsuranceExpiry') {
      return `${indicator.remaining} days`;
    }
    return `${indicator.remaining} km`;
  }

  formatTimeDifference(timeDifference: string): string {
    // Parse .NET TimeSpan format "11.18:19:57.5439425" or "27.00:00:00"
    try {
      const parts = timeDifference.split(':');
      const daysPart = parts[0].split('.');

      const days = parseInt(daysPart[0] || '0');
      const hours = parseInt(daysPart[1] || '0');
      const minutes = parseInt(parts[1] || '0');

      if (days > 0) {
        return `${days} days, ${hours} hours`;
      } else if (hours > 0) {
        return `${hours} hours, ${minutes} minutes`;
      } else {
        return `${minutes} minutes`;
      }
    } catch (error) {
      return timeDifference; // Return raw value if parsing fails
    }
  }

  getPercentageClass(percentage: number): string {
    if (percentage > 50) {
      return 'percentage-good';
    } else if (percentage > 20) {
      return 'percentage-warning';
    } else {
      return 'percentage-critical';
    }
  }

  getServiceCost(indicator: ConditionIndicator): string {
    // Mock cost estimation based on service type
    const costMap: { [key: string]: number } = {
      OilChange: 250,
      TireChange: 800,
      BatteryHealth: 450,
      ACService: 350,
      GeneralMaintenance: 1200,
      CarLicenseAndEnsuranceExpiry: 500,
    };

    const baseCost = costMap[indicator.type] || 300;
    return `${baseCost} - ${baseCost + 200} EGP`;
  }

  // Provider Recommendations
  getRecommendedProvider(indicator: ConditionIndicator): string {
    const providerMap: { [key: string]: string } = {
      OilChange: 'QuickLube Center',
      TireChange: 'Tire Masters Egypt',
      BatteryHealth: 'Battery Pro',
      ACService: 'Climate Control Experts',
      GeneralMaintenance: 'Toyota Service Center',
      CarLicenseAndEnsuranceExpiry: 'Traffic Department',
    };
    return providerMap[indicator.type] || 'Authorized Service Center';
  }

  // Historical Data
  getIndicatorHistory(indicator: ConditionIndicator): IndicatorHistory[] {
    // Mock historical data for the last 6 services
    const months = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];
    const baseCondition =
      indicator.status === 'Normal' ? 85 : indicator.status === 'Warning' ? 65 : 45;

    return months.map((month, index) => ({
      month,
      condition: Math.min(100, baseCondition + index * 5 - Math.random() * 10),
    }));
  }

  getHistoryBarClass(percentage: number): string {
    if (percentage >= 80) return 'history-bar-good';
    if (percentage >= 60) return 'history-bar-warning';
    return 'history-bar-critical';
  }

  // Related Services
  getRelatedServices(indicator: ConditionIndicator): string[] {
    const relatedMap: { [key: string]: string[] } = {
      OilChange: ['Oil Filter', 'Engine Flush', 'Air Filter'],
      TireChange: ['Wheel Alignment', 'Tire Rotation', 'Balancing'],
      BatteryHealth: ['Alternator Check', 'Electrical System', 'Starter Motor'],
      ACService: ['Cabin Filter', 'Refrigerant Refill', 'AC Belt'],
      GeneralMaintenance: ['Full Inspection', 'Fluid Top-up', 'Brake Check'],
      CarLicenseAndEnsuranceExpiry: ['Vehicle Inspection', 'Insurance Renewal', 'Registration'],
    };
    return relatedMap[indicator.type] || [];
  }

  // User Actions
  toggleIndicatorReminder(indicator: ConditionIndicator): void {
    indicator.reminderEnabled = !indicator.reminderEnabled;
    console.log(
      `Reminder ${indicator.reminderEnabled ? 'enabled' : 'disabled'} for ${indicator.name}`
    );
    // Call service to save preference
  }

  scheduleService(indicator: ConditionIndicator): void {
    if (this.vehicle?.id) {
      this.router.navigate(['/edit-car', this.vehicle.id], {
        fragment: 'condition-indicators',
      });
    }
  }

  markAsCompleted(indicator: ConditionIndicator): void {
    console.log(`Marking ${indicator.name} as completed`);
    // Update indicator status and reset timeline
    indicator.lastInspectionDate = new Date().toLocaleDateString('en-US');
    indicator.status = 'Normal';
    // Call service to save changes
  }

  snoozeReminder(indicator: ConditionIndicator, days: number): void {
    console.log(`Snoozing ${indicator.name} reminder for ${days} days`);
    // Implement snooze logic
  }

  shareIndicator(indicator: ConditionIndicator): void {
    const shareText = `${indicator.name} - Due: ${
      indicator.nextInspectionDate
    }, Remaining: ${this.getRemainingDisplay(indicator)}`;
    console.log(`Sharing: ${shareText}`);
    // Implement share functionality (WhatsApp, Email, etc.)
  }

  compareServiceCosts(indicator: ConditionIndicator): void {
    console.log(`Comparing service costs for ${indicator.name}`);
    // Open price comparison dialog showing different providers
  }

  // Timeline View
  getTimelineEvents(): TimelineEvent[] {
    if (!this.vehicle?.conditionIndicators) return [];

    const today = new Date();
    const events: TimelineEvent[] = [];

    this.vehicle.conditionIndicators.forEach((indicator) => {
      if (indicator.nextInspectionDate) {
        const eventDate = new Date(indicator.nextInspectionDate);
        const daysFromToday = Math.floor(
          (eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysFromToday >= -30 && daysFromToday <= 90) {
          events.push({
            date: eventDate,
            indicator: indicator,
            isPast: daysFromToday < 0,
            dayOffset: daysFromToday,
          });
        }
      }
    });

    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  // Calendar View
  changeCalendarMonth(direction: number): void {
    this.calendarMonth += direction;
    if (this.calendarMonth > 11) {
      this.calendarMonth = 0;
      this.calendarYear++;
    } else if (this.calendarMonth < 0) {
      this.calendarMonth = 11;
      this.calendarYear--;
    }
  }

  getCalendarMonthName(): string {
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    return months[this.calendarMonth];
  }

  getCalendarDays(): CalendarDay[] {
    const days: CalendarDay[] = [];
    const firstDay = new Date(this.calendarYear, this.calendarMonth, 1);
    const lastDay = new Date(this.calendarYear, this.calendarMonth + 1, 0);
    const startingDayOfWeek = firstDay.getDay();

    // Add empty days for alignment
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push({ date: 0, services: [], isToday: false, isWeekend: false });
    }

    // Add days of the month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const currentDate = new Date(this.calendarYear, this.calendarMonth, day);
      const dayOfWeek = currentDate.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isToday = this.isToday(currentDate);

      // Find services due on this day
      const services =
        this.vehicle?.conditionIndicators.filter((indicator) => {
          if (indicator.nextInspectionDate) {
            const serviceDate = new Date(indicator.nextInspectionDate);
            return (
              serviceDate.getDate() === day &&
              serviceDate.getMonth() === this.calendarMonth &&
              serviceDate.getFullYear() === this.calendarYear
            );
          }
          return false;
        }) || [];

      days.push({ date: day, services, isToday, isWeekend });
    }

    return days;
  }

  private isToday(date: Date): boolean {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  }

  // Cost Forecasting
  getUpcomingCosts(): Array<{ period: string; services: string[]; amount: number }> {
    if (!this.vehicle?.conditionIndicators) return [];

    const today = new Date();
    const forecasts = [
      { period: 'This Month', services: [] as string[], amount: 0 },
      { period: 'Next Month', services: [] as string[], amount: 0 },
      { period: 'Next 3 Months', services: [] as string[], amount: 0 },
    ];

    this.vehicle.conditionIndicators.forEach((indicator) => {
      if (indicator.nextInspectionDate && indicator.lastServiceCost) {
        const serviceDate = new Date(indicator.nextInspectionDate);
        const monthsDiff =
          (serviceDate.getFullYear() - today.getFullYear()) * 12 +
          (serviceDate.getMonth() - today.getMonth());

        if (monthsDiff === 0) {
          forecasts[0].services.push(indicator.name);
          forecasts[0].amount += indicator.lastServiceCost;
        } else if (monthsDiff === 1) {
          forecasts[1].services.push(indicator.name);
          forecasts[1].amount += indicator.lastServiceCost;
        } else if (monthsDiff >= 0 && monthsDiff <= 3) {
          forecasts[2].services.push(indicator.name);
          forecasts[2].amount += indicator.lastServiceCost;
        }
      }
    });

    return forecasts.filter((f) => f.services.length > 0);
  }

  getUpcomingServicesCount(): number {
    const today = new Date();
    const threeMonthsLater = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);

    return (
      this.vehicle?.conditionIndicators.filter((indicator) => {
        if (indicator.nextInspectionDate) {
          const serviceDate = new Date(indicator.nextInspectionDate);
          return serviceDate >= today && serviceDate <= threeMonthsLater;
        }
        return false;
      }).length || 0
    );
  }

  // Vehicle Health Score
  getVehicleHealthScore(): number {
    if (!this.vehicle?.conditionIndicators) return 0;

    const indicators = this.vehicle.conditionIndicators;

    // Return 0 if no indicators exist
    if (indicators.length === 0) return 0;

    let totalScore = 0;

    indicators.forEach((indicator) => {
      let score = 0;
      switch (indicator.status) {
        case 'Normal':
          score = 100;
          break;
        case 'Warning':
          score = 60;
          break;
        case 'Critical':
          score = 20;
          break;
        case 'UnKnown':
          score = 50;
          break;
      }

      // Adjust score based on remaining km/days
      if (indicator.type === 'CarLicenseAndEnsuranceExpiry') {
        if (indicator.remaining <= 30) score *= 0.5;
        else if (indicator.remaining <= 60) score *= 0.75;
      } else {
        if (indicator.remaining <= 1000) score *= 0.5;
        else if (indicator.remaining <= 3000) score *= 0.75;
      }

      totalScore += score;
    });

    return Math.round(totalScore / indicators.length);
  }

  getHealthScoreClass(): string {
    const score = this.getVehicleHealthScore();
    if (score >= 80) return 'health-excellent';
    if (score >= 60) return 'health-good';
    if (score >= 40) return 'health-fair';
    return 'health-poor';
  }

  // Expense Tracker Methods
  loadExpensesForCar(): void {
    if (!this.vehicleId) return;
    const carId = Number(this.vehicleId);
    this.carExpenseService.getByCarId(carId).subscribe({
      next: (arr) => {
        const iconMap: Record<string, string> = {
          Fuel: '⛽',
          Maintenance: '🔧',
          Repair: '🛠️',
          Insurance: '📋',
          Other: '📌',
        };
        this.expenses = arr.map((dto: any) => ({
          id: dto.id,
          name: dto.expenseType,
          date: dto.expenseDate,
          amount: dto.amount,
          icon: iconMap[dto.expenseType] ?? '📌',
          carId: carId,
          description: dto.description,
        }));
        this.expenses.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading expenses:', err);
        this.expenses = [];
      },
    });
  }

  openAddExpenseModal(): void {
    this.expenseMessage = '';
    this.expenseMessageType = null;
    this.submittedExpense = false;
    this.isAddExpenseModalOpen = true;
    this.newExpenseForm = {
      expenseType: '',
      expenseDate: new Date().toISOString().split('T')[0],
      amount: null,
      description: '',
      carId: this.vehicleId ? Number(this.vehicleId) : null,
      icon: '⛽',
    };
    // Scroll to top to show the modal fully
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  closeAddExpenseModal(): void {
    this.isAddExpenseModalOpen = false;
  }

  addExpense(): void {
    this.submittedExpense = true;
    if (
      !this.newExpenseForm.carId ||
      !this.newExpenseForm.expenseType ||
      !this.newExpenseForm.amount
    ) {
      this.expenseMessageType = 'error';
      this.expenseMessage = 'Please select expense type and enter amount.';
      return;
    }
    if ((this.newExpenseForm.amount ?? 0) <= 0) {
      this.expenseMessageType = 'error';
      this.expenseMessage = 'Amount must be greater than zero.';
      return;
    }

    const payload: CreateCarExpenseRequest = {
      amount: Number(this.newExpenseForm.amount),
      description: this.newExpenseForm.description?.trim() || '',
      expenseDate: this.newExpenseForm.expenseDate,
      expenseType: this.newExpenseForm.expenseType as ExpenseType,
      carId: Number(this.newExpenseForm.carId),
    };

    this.isSavingExpense = true;
    this.expenseMessage = '';
    this.expenseMessageType = null;

    this.carExpenseService.addExpense(payload).subscribe({
      next: (resp) => {
        this.isSavingExpense = false;
        const success = resp?.success ?? true;
        this.expenseMessageType = success ? 'success' : 'error';
        this.expenseMessage = success
          ? 'The expense created successfully'
          : resp?.message ?? 'Failed to add expense';
        if (success) {
          this.loadExpensesForCar();
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isSavingExpense = false;
        const raw = err?.error ?? err;
        const msg = (raw?.message ?? 'Failed to add expense').toString();
        this.expenseMessageType = 'error';
        this.expenseMessage = msg;
        this.cdr.detectChanges();
      },
    });
  }

  deleteExpense(id: number | undefined): void {
    if (!id) return;
    const numericId = Number(id);
    const backup = [...this.expenses];
    this.expenses = this.expenses.filter((e) => e.id !== numericId);
    this.deletingExpenseIds.add(numericId);
    this.cdr.detectChanges();

    this.carExpenseService.deleteExpense(numericId).subscribe({
      next: () => {
        this.deletingExpenseIds.delete(numericId);
        this.expenseMessageType = 'success';
        this.expenseMessage = 'Expense removed successfully.';
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to delete expense', err);
        this.deletingExpenseIds.delete(numericId);
        this.expenses = backup;
        this.expenseMessageType = 'error';
        this.expenseMessage = 'Failed to remove expense. Please try again.';
        this.cdr.detectChanges();
      },
    });
  }

  updateExpenseType(expenseType: ExpenseType | ''): void {
    const map: Record<string, string> = {
      Fuel: '⛽',
      Maintenance: '🔧',
      Repair: '🛠️',
      Insurance: '📋',
      Other: '📌',
    };
    if (expenseType) {
      this.newExpenseForm.icon = map[expenseType] ?? '📌';
    }
  }

  // Export PDF - Generate a comprehensive car report
  exportToPDF(): void {
    if (!this.vehicle) return;

    const vehicle = this.vehicle;
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Generate status summary
    const indicators = vehicle.conditionIndicators || [];
    const normalCount = indicators.filter((i) => i.status === 'Normal').length;
    const warningCount = indicators.filter((i) => i.status === 'Warning').length;
    const criticalCount = indicators.filter((i) => i.status === 'Critical').length;

    // Build indicator rows HTML
    const indicatorRows = indicators
      .map(
        (ind) => `
      <tr>
        <td>${ind.name}</td>
        <td><span class="status-badge ${ind.status.toLowerCase()}">${ind.status}</span></td>
        <td>${ind.lastInspectionDate}</td>
        <td>${ind.nextInspectionDate}</td>
        <td>${
          ind.type === 'CarLicenseAndEnsuranceExpiry'
            ? `${ind.remaining} days`
            : `${ind.remaining.toLocaleString()} km`
        }</td>
      </tr>
    `
      )
      .join('');

    // Build maintenance history rows
    const maintenanceRows = this.bookingServiceHistory
      .map(
        (service) => `
      <tr>
        <td>${this.formatServiceDate(service.appointmentDate)}</td>
        <td>${service.serviceName}</td>
        <td>${service.serviceDescription || '-'}</td>
        <td class="amount">${service.reviewPaidAmount.toLocaleString()} EGP</td>
      </tr>
    `
      )
      .join('');

    // Build expenses rows
    const expenseRows = this.expenses
      .map(
        (expense) => `
      <tr>
        <td>${new Date(expense.date).toLocaleDateString('en-US')}</td>
        <td>${expense.name}</td>
        <td>${expense.description || '-'}</td>
        <td class="amount">${expense.amount.toLocaleString()} EGP</td>
      </tr>
    `
      )
      .join('');

    // Build expense breakdown
    const expensesByType = this.getExpensesByType();
    const breakdownRows = expensesByType
      .map(
        (item) => `
      <tr>
        <td>${item.type}</td>
        <td class="amount">${item.amount.toLocaleString()} EGP</td>
        <td>${item.percentage}%</td>
      </tr>
    `
      )
      .join('');

    // Generate PDF-ready HTML
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Vehicle Report - ${vehicle.make} ${vehicle.model}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            color: #1f2937;
            line-height: 1.5;
            padding: 40px;
            max-width: 900px;
            margin: 0 auto;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 20px;
            border-bottom: 3px solid #ef4444;
            margin-bottom: 30px;
          }
          .header-left {
            display: flex;
            flex-direction: column;
          }
          .header-right {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 8px;
          }
          .koriek-logo {
            width: 80px;
            height: auto;
          }
          .logo { font-size: 28px; font-weight: 700; color: #ef4444; }
          .report-title { font-size: 14px; color: #6b7280; margin-top: 4px; }
          .report-date { font-size: 12px; color: #9ca3af; text-align: right; }

          .vehicle-header {
            background: linear-gradient(135deg, #fee2e2 0%, #fef3c7 100%);
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 24px;
          }
          .vehicle-title-row {
            display: flex;
            align-items: center;
            gap: 16px;
          }
          .car-brand-logo {
            width: 60px;
            height: 60px;
            object-fit: contain;
            background: white;
            border-radius: 12px;
            padding: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          .vehicle-info { flex: 1; }
          .vehicle-name { font-size: 24px; font-weight: 700; color: #111827; }
          .vehicle-year { font-size: 14px; color: #6b7280; margin-top: 4px; }
          .vehicle-details {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
            margin-top: 16px;
          }
          .detail-item { }
          .detail-label { font-size: 11px; color: #9ca3af; text-transform: uppercase; }
          .detail-value { font-size: 14px; font-weight: 600; color: #374151; }

          .section {
            margin-bottom: 28px;
            page-break-inside: avoid;
          }
          .section-title {
            font-size: 16px;
            font-weight: 700;
            color: #111827;
            padding-bottom: 8px;
            border-bottom: 2px solid #e5e7eb;
            margin-bottom: 16px;
          }

          .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 20px;
          }
          .summary-card {
            background: #f9fafb;
            border-radius: 8px;
            padding: 16px;
            text-align: center;
          }
          .summary-card.normal { border-left: 4px solid #22c55e; }
          .summary-card.warning { border-left: 4px solid #f59e0b; }
          .summary-card.critical { border-left: 4px solid #ef4444; }
          .summary-card.total { border-left: 4px solid #3b82f6; }
          .summary-number { font-size: 28px; font-weight: 700; }
          .summary-card.normal .summary-number { color: #22c55e; }
          .summary-card.warning .summary-number { color: #f59e0b; }
          .summary-card.critical .summary-number { color: #ef4444; }
          .summary-card.total .summary-number { color: #3b82f6; }
          .summary-label { font-size: 11px; color: #6b7280; text-transform: uppercase; }

          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }
          th {
            background: #f3f4f6;
            padding: 10px 12px;
            text-align: left;
            font-weight: 600;
            color: #374151;
            border-bottom: 2px solid #e5e7eb;
          }
          td {
            padding: 10px 12px;
            border-bottom: 1px solid #e5e7eb;
          }
          td.amount { text-align: right; font-weight: 600; color: #111827; }
          tr:last-child td { border-bottom: none; }

          .status-badge {
            display: inline-block;
            padding: 3px 10px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
          }
          .status-badge.normal { background: #dcfce7; color: #166534; }
          .status-badge.warning { background: #fef3c7; color: #92400e; }
          .status-badge.critical { background: #fee2e2; color: #991b1b; }

          .cost-summary {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
            margin-bottom: 20px;
          }
          .cost-card {
            background: #f9fafb;
            border-radius: 8px;
            padding: 16px;
            text-align: center;
          }
          .cost-amount { font-size: 22px; font-weight: 700; color: #111827; }
          .cost-label { font-size: 11px; color: #6b7280; }

          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #9ca3af;
            font-size: 11px;
          }

          .no-data { color: #9ca3af; font-style: italic; padding: 20px; text-align: center; }

          @media print {
            body { padding: 20px; }
            .section { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            <div class="logo">KORIEK</div>
            <div class="report-title">Vehicle Comprehensive Report</div>
          </div>
          <div class="header-right">
            <img class="koriek-logo" src="${
              window.location.origin
            }/Assets/logo.png" alt="KORIEK Logo" onerror="this.style.display='none'" />
            <div class="report-date">Generated: ${today}</div>
          </div>
        </div>

        <div class="vehicle-header">
          <div class="vehicle-title-row">
            ${
              this.getCarLogo(vehicle.make)
                ? `<img class="car-brand-logo" src="${this.getCarLogo(vehicle.make)}" alt="${
                    vehicle.make
                  } Logo" />`
                : ''
            }
            <div class="vehicle-info">
              <div class="vehicle-name">${vehicle.make} ${vehicle.model}</div>
              <div class="vehicle-year">${vehicle.year}</div>
            </div>
          </div>
          <div class="vehicle-details">
            <div class="detail-item">
              <div class="detail-label">License Plate</div>
              <div class="detail-value">${vehicle.licensePlate}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Current Mileage</div>
              <div class="detail-value">${vehicle.currentMileage.toLocaleString()} km</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">VIN</div>
              <div class="detail-value">${vehicle.vin}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Engine Type</div>
              <div class="detail-value">${vehicle.engineType}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Color</div>
              <div class="detail-value">${vehicle.color}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Last Maintenance</div>
              <div class="detail-value">${vehicle.lastMaintenanceDate}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Vehicle Health Summary</div>
          <div class="summary-grid">
            <div class="summary-card normal">
              <div class="summary-number">${normalCount}</div>
              <div class="summary-label">Normal</div>
            </div>
            <div class="summary-card warning">
              <div class="summary-number">${warningCount}</div>
              <div class="summary-label">Warning</div>
            </div>
            <div class="summary-card critical">
              <div class="summary-number">${criticalCount}</div>
              <div class="summary-label">Critical</div>
            </div>
            <div class="summary-card total">
              <div class="summary-number">${indicators.length}</div>
              <div class="summary-label">Total Indicators</div>
            </div>
          </div>

          ${
            indicators.length > 0
              ? `
          <table>
            <thead>
              <tr>
                <th>Indicator</th>
                <th>Status</th>
                <th>Last Check</th>
                <th>Next Check</th>
                <th>Remaining</th>
              </tr>
            </thead>
            <tbody>
              ${indicatorRows}
            </tbody>
          </table>
          `
              : '<div class="no-data">No condition indicators available</div>'
          }
        </div>

        <div class="section">
          <div class="section-title">Cost Analytics</div>
          <div class="cost-summary">
            <div class="cost-card">
              <div class="cost-amount">${this.getTotalMaintenanceCost().toLocaleString()} EGP</div>
              <div class="cost-label">Total Maintenance</div>
            </div>
            <div class="cost-card">
              <div class="cost-amount">${this.getTotalExpensesCost().toLocaleString()} EGP</div>
              <div class="cost-label">Total Expenses</div>
            </div>
            <div class="cost-card">
              <div class="cost-amount" style="color: #ef4444;">${this.getGrandTotal().toLocaleString()} EGP</div>
              <div class="cost-label">Grand Total</div>
            </div>
          </div>

          ${
            expensesByType.length > 0
              ? `
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th style="text-align: right;">Amount</th>
                <th>Percentage</th>
              </tr>
            </thead>
            <tbody>
              ${breakdownRows}
            </tbody>
          </table>
          `
              : ''
          }
        </div>

        <div class="section">
          <div class="section-title">Maintenance History (${
            this.bookingServiceHistory.length
          } records)</div>
          ${
            this.bookingServiceHistory.length > 0
              ? `
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Service</th>
                <th>Description</th>
                <th style="text-align: right;">Cost</th>
              </tr>
            </thead>
            <tbody>
              ${maintenanceRows}
            </tbody>
          </table>
          `
              : '<div class="no-data">No maintenance records found</div>'
          }
        </div>

        <div class="section">
          <div class="section-title">Expenses (${this.expenses.length} records)</div>
          ${
            this.expenses.length > 0
              ? `
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Description</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${expenseRows}
            </tbody>
          </table>
          `
              : '<div class="no-data">No expense records found</div>'
          }
        </div>

        <div class="footer">
          <p>This report was automatically generated by KORIEK Vehicle Management System.</p>
          <p>For questions or support, please contact us through the app.</p>
        </div>
      </body>
      </html>
    `;

    // Open print window
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();

      // Wait for content to load, then trigger print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 250);
      };
    }
  }
}
