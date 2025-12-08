import { Component, OnInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CarsService, MakeModels } from '../../services/cars.service';
import { CategoryService } from '../../services/category.service';
import { WorkshopProfileService } from '../../services/workshop-profile.service';
import { BookingService } from '../../services/booking.service';
import { Category } from '../../models/category.model';
import { Subcategory } from '../../models/subcategory.model';
import { Service } from '../../models/service.model';
import { PaymentMethodPopupComponent } from '../payment-method-popup/payment-method-popup.component';

interface Vehicle {
  id: number;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  mileage: number;
  // Optional origin fields that may come from backend
  origin?: string;
  country?: string;
  CarOrigin?: string;
  carOrigin?: string;
}

interface ServiceType {
  id: string;
  name: string;
  icon: string;
  description: string;
  estimatedDuration: string;
  basePrice: number;
}

interface Workshop {
  id: number;
  name: string;
  rating: number;
  reviewCount: number;
  distance?: number;
  eta?: string;
  address: string;
  phone?: string;
  availability?: string;
  services?: string[];
  priceMultiplier?: number;
  // Additional fields from API response
  workshopProfileId?: number;
  workshopName?: string;
  workshopDescription?: string;
  workshopType?: string; // e.g., 'Independent', 'Franchise'
  serviceId?: number;
  workshopServiceID?: number; // Workshop service ID from API (used for booking)
  serviceName?: string;
  serviceDescription?: string;
  price?: number;
  minPrice?: number;
  maxPrice?: number;
  logoUrl?: string;
  city?: string;
  country?: string;
  governorate?: string;
  averageRating?: number;
  totalReviews?: number;
  latitude?: number;
  longitude?: number;
  email?: string;
  origin?: string; // Vehicle origin this workshop serves
  duration?: number; // Service duration in minutes
  numbersOfTechnicians?: number;
  isClosed?: boolean; // Whether workshop is currently closed
}

interface BookingDraft {
  step: number;
  vehicleId: number | null;
  categoryId: number | null;
  serviceNotes: string;
  selectedDate: string | null;
  selectedTimeSlot: string | null;
  workshopIds: number[]; // Changed to array for multi-selection
  paymentMethod: string | null;
  timestamp: number;
}

@Component({
  selector: 'app-booking',
  standalone: true,
  imports: [CommonModule, FormsModule, PaymentMethodPopupComponent, RouterLink],
  templateUrl: './booking.component.html',
  styleUrls: ['./booking.component.css'],
})
export class BookingComponent implements OnInit {
  @ViewChild('categoriesGrid') categoriesGrid?: ElementRef;
  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  // Multi-step state
  currentStep = 1;
  totalSteps = 5;

  // User vehicles
  userVehicles: Vehicle[] = [];
  selectedVehicle: Vehicle | null = null;
  // Vehicles loading state caching to avoid race conditions when navigating with query params
  private vehiclesLoaded = false;
  private vehiclesLoadPromise: Promise<void> | null = null;
  isLoadingVehicles = true;

  // Category selection (from backend API)
  categories: Category[] = [];
  selectedCategory: Category | null = null;
  isLoadingCategories = true;
  categoriesError: string | null = null;

  // Subcategory selection (from backend API)
  subcategories: Subcategory[] = [];
  selectedSubcategory: Subcategory | null = null;
  isLoadingSubcategories = false;
  subcategoriesError: string | null = null;
  showingSubcategories = false;

  // Service selection (from backend API)
  services: Service[] = [];
  selectedService: Service | null = null;
  isLoadingServices = false;
  servicesError: string | null = null;
  showingServices = false;

  // Service selection (kept for backward compatibility, will be replaced with subcategories later)
  serviceTypes: ServiceType[] = [];
  selectedServiceType: ServiceType | null = null;
  serviceNotes = '';

  // Photo upload
  selectedPhotos: { file: File; preview: string }[] = [];
  isDragging = false;
  maxPhotos = 5;
  maxFileSize = 5 * 1024 * 1024; // 5MB

  // Date & Time selection
  selectedMonth: number | null = null; // 0-11 (January = 0)
  selectedYear: number | null = null;
  selectedDate: Date | null = null;
  selectedTimeSlot: string | null = null;
  availableDates: Date[] = [];
  availableMonths: { month: number; year: number; name: string; displayName: string }[] = [];
  daysInMonth: Date[] = [];
  availableTimeSlots: string[] = [
    '00:00',
    '00:30',
    '01:00',
    '01:30',
    '02:00',
    '02:30',
    '03:00',
    '03:30',
    '04:00',
    '04:30',
    '05:00',
    '05:30',
    '06:00',
    '06:30',
    '07:00',
    '07:30',
    '08:00',
    '08:30',
    '09:00',
    '09:30',
    '10:00',
    '10:30',
    '11:00',
    '11:30',
    '12:00',
    '12:30',
    '13:00',
    '13:30',
    '14:00',
    '14:30',
    '15:00',
    '15:30',
    '16:00',
    '16:30',
    '17:00',
    '17:30',
    '18:00',
    '18:30',
    '19:00',
    '19:30',
    '20:00',
    '20:30',
    '21:00',
    '21:30',
    '22:00',
    '22:30',
    '23:00',
    '23:30',
  ];
  unavailableSlots: string[] = []; // Mock unavailable slots

  // Timezone configuration
  readonly CAIRO_TIMEZONE = 'Africa/Cairo';

  // API base URL for images
  private readonly API_BASE_URL = 'https://localhost:44316';

  // Month names
  readonly MONTH_NAMES = [
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

  // Workshop selection (loaded from API when entering step 3)
  workshops: Workshop[] = [];
  selectedWorkshop: Workshop | null = null; // Single workshop selection
  isLoadingWorkshops = false;
  workshopsError: string | null = null;

  // Pagination for workshops
  workshopCurrentPage = 1;
  workshopPageSize = 6;
  workshopTotalRecords = 0;
  workshopTotalPages = 0;
  workshopHasPreviousPage = false;
  workshopHasNextPage = false;

  // Payment method selection
  showPaymentPopup = false;
  selectedPaymentMethod: string | null = null;

  // Vehicle origin for workshop search (default 'General' if undetected)
  selectedVehicleOrigin: string = 'General';

  // Success state
  bookingConfirmed = false;
  confirmationNumber = '';
  isSubmittingBooking: boolean = false;
  bookingError: string = '';

  // Preselected values from query params (from workshop-details page)
  preselectedWorkshopId: number | null = null;
  preselectedWorkshopServiceId: number | null = null;
  preselectedServiceId: number | null = null;
  preselectedServiceName: string | null = null;
  preselectedWorkshopName: string | null = null;
  preselectedMinPrice: number | null = null;
  preselectedMaxPrice: number | null = null;
  preselectedServiceOrigin: string | null = null; // The vehicle origin required by the preselected service

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private carsService: CarsService,
    private categoryService: CategoryService,
    private workshopProfileService: WorkshopProfileService,
    private bookingService: BookingService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initializeAvailableDates();
    // Start loading vehicles
    this.loadUserVehicles();
    this.loadCategories();

    // Handle query params for pre-selected workshop/service from workshop-details page
    this.handleQueryParams();
  }

  /**
   * Handle query parameters for pre-selected workshop/service from workshop-details
   */
  private handleQueryParams(): void {
    this.route.queryParams.subscribe(async (params) => {
      // Handle pre-selected vehicle
      if (params['vehicleId']) {
        const vehicleId = Number(params['vehicleId']);
        try {
          await this.loadUserVehicles();
        } catch (e) {
          // ignore
        }
        const vehicle = this.userVehicles.find((v) => v.id === vehicleId);
        if (vehicle) {
          this.selectedVehicle = vehicle;
        }
      }

      // Handle pre-selected workshop and service from workshop-details page
      if (params['workshopId']) {
        this.preselectedWorkshopId = Number(params['workshopId']);
      }
      if (params['workshopServiceId']) {
        this.preselectedWorkshopServiceId = Number(params['workshopServiceId']);
      }
      if (params['serviceId']) {
        this.preselectedServiceId = Number(params['serviceId']);
      }
      if (params['serviceName']) {
        this.preselectedServiceName = params['serviceName'];
      }
      if (params['workshopName']) {
        this.preselectedWorkshopName = params['workshopName'];
      }
      if (params['minPrice']) {
        this.preselectedMinPrice = Number(params['minPrice']);
      }
      if (params['maxPrice']) {
        this.preselectedMaxPrice = Number(params['maxPrice']);
      }
      if (params['origin']) {
        this.selectedVehicleOrigin = params['origin'];
        this.preselectedServiceOrigin = params['origin']; // Store the service's required origin for filtering vehicles
        console.log('=== PRESELECTED SERVICE ORIGIN FROM QUERY PARAMS ===');
        console.log('Origin:', params['origin']);
      }

      // Debug: log all preselection values
      console.log('=== ALL PRESELECTION VALUES ===');
      console.log('Workshop ID:', this.preselectedWorkshopId);
      console.log('Workshop Name:', this.preselectedWorkshopName);
      console.log('Service ID:', this.preselectedServiceId);
      console.log('Service Name:', this.preselectedServiceName);
      console.log('Service Origin:', this.preselectedServiceOrigin);
    });
  }

  /**
   * Clear preselected workshop and service (user wants to choose manually)
   */
  clearPreselection(): void {
    this.preselectedWorkshopId = null;
    this.preselectedWorkshopServiceId = null;
    this.preselectedServiceId = null;
    this.preselectedServiceName = null;
    this.preselectedWorkshopName = null;
    this.preselectedMinPrice = null;
    this.preselectedMaxPrice = null;
    this.preselectedServiceOrigin = null;
    // Clear URL params without navigation
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      replaceUrl: true,
    });
  }

  /**
   * Get filtered vehicles based on preselected service origin.
   * If a service is preselected and has a specific origin requirement,
   * only show vehicles that match that origin.
   */
  getFilteredVehicles(): Vehicle[] {
    // If no preselected service or no origin requirement, show all vehicles
    if (!this.hasPreselectedService() || !this.preselectedServiceOrigin) {
      return this.userVehicles;
    }

    const requiredOrigin = this.preselectedServiceOrigin.toLowerCase().trim();
    console.log('=== VEHICLE ORIGIN FILTER DEBUG ===');
    console.log('Required service origin:', requiredOrigin);
    console.log('All vehicles:', this.userVehicles);

    // Filter vehicles by origin - check all possible origin fields
    const filtered = this.userVehicles.filter((vehicle) => {
      // Check all possible origin field names (API might use different casing)
      const vehicleOrigin = (
        vehicle.origin ||
        vehicle.carOrigin ||
        vehicle.CarOrigin ||
        vehicle.country ||
        (vehicle as any).Origin ||
        (vehicle as any).CarOrigin ||
        ''
      )
        .toLowerCase()
        .trim();

      console.log(`Vehicle ${vehicle.make} ${vehicle.model}: origin="${vehicleOrigin}"`);

      // Match if origins are equal or one contains the other
      const matches =
        vehicleOrigin === requiredOrigin ||
        vehicleOrigin.includes(requiredOrigin) ||
        requiredOrigin.includes(vehicleOrigin);
      console.log(`  Matches required "${requiredOrigin}": ${matches}`);
      return matches;
    });

    console.log('Filtered vehicles:', filtered);
    return filtered;
  }

  // Initialize available dates (next 30 days, excluding weekends)
  initializeAvailableDates(): void {
    const today = this.getCurrentCairoDate();
    this.availableDates = [];
    this.availableMonths = [];

    // Generate next 2 months
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    for (let i = 0; i < 2; i++) {
      const month = (currentMonth + i) % 12;
      const year = currentYear + Math.floor((currentMonth + i) / 12);

      this.availableMonths.push({
        month,
        year,
        name: this.MONTH_NAMES[month],
        displayName: `${this.MONTH_NAMES[month]} ${year}`,
      });
    }

    // Generate next 30 days for backward compatibility
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      this.availableDates.push(date);
    }
  }

  // Load user vehicles. Returns a promise that resolves when vehicles are loaded.
  loadUserVehicles(): Promise<void> {
    if (this.vehiclesLoaded) return Promise.resolve();
    if (this.vehiclesLoadPromise) return this.vehiclesLoadPromise;

    this.vehiclesLoadPromise = new Promise<void>((resolve) => {
      this.isLoadingVehicles = true;
      this.carsService.getProfileWithCars().subscribe({
        next: (response: any) => {
          this.userVehicles = response.data?.cars || [];
          console.log('=== LOADED VEHICLES FROM API ===');
          console.log('Full response:', response);
          console.log('Vehicles:', this.userVehicles);
          if (this.userVehicles.length > 0) {
            console.log('First vehicle keys:', Object.keys(this.userVehicles[0]));
            console.log('First vehicle full data:', JSON.stringify(this.userVehicles[0], null, 2));
          }
          this.vehiclesLoaded = true;
          this.isLoadingVehicles = false;
          try {
            this.cdr.detectChanges();
          } catch (e) {
            /* ignore */
          }
          resolve();
        },
        error: (error: any) => {
          console.error('Error loading vehicles:', error);
          // Resolve anyway to avoid blocking callers; the UI can handle empty list
          this.vehiclesLoaded = true;
          this.isLoadingVehicles = false;
          try {
            this.cdr.detectChanges();
          } catch (e) {
            /* ignore */
          }
          resolve();
        },
      });
    });

    return this.vehiclesLoadPromise;
  }

  // Load categories from backend API
  loadCategories(): void {
    this.isLoadingCategories = true;
    this.categoriesError = null;

    // Trigger change detection to show loading state immediately
    try {
      this.cdr.detectChanges();
    } catch (e) {
      /* ignore */
    }

    // Load categories directly from API (no caching)
    this.categoryService.getCategories().subscribe({
      next: (categories: Category[]) => {
        this.categories = categories;
        this.isLoadingCategories = false;
        try {
          this.cdr.detectChanges();
        } catch (e) {
          /* ignore */
        }
      },
      error: (error: any) => {
        console.error('Error loading categories:', error);
        this.categoriesError = 'Failed to load service categories. Please try again.';
        this.isLoadingCategories = false;
        try {
          this.cdr.detectChanges();
        } catch (e) {
          /* ignore */
        }
      },
    });
  }

  // Select category
  selectCategory(category: Category): void {
    this.selectedCategory = category;
    this.selectedSubcategory = null;
    console.log('Selected category:', category);
    // Switch to subcategories view and load subcategories
    this.showingSubcategories = true;
    // Ensure view updates immediately to show loading state
    try {
      this.cdr.detectChanges();
    } catch (e) {
      /* ignore */
    }
    this.loadSubcategories(category.id);
  }

  // Return a background URL for a category: prefer backend iconUrl, fallback to local images
  getCategoryBgUrl(category: Category | null): string | null {
    if (!category) return null;
    if (category.iconUrl) return category.iconUrl;
    // Local fallback mapping (add more entries here as images are uploaded)
    const localMap: { [key: string]: string } = {
      'Periodic Maintenance': '/Assets/images/Periodic-Maintenance-Cat.jpg',
      'Seasonal Check-ups': '/Assets/images/Seasonal-Chekc-Ups.jpg',
      'Mechanical Repairs': '/Assets/images/Mechanical-Repairs.jpg',
      Electrical: '/Assets/images/Electrical.jpg',
      'AC & Cooling': '/Assets/images/Ac-Cooling.jpg',
      'Body & Paint': '/Assets/images/Body-Paint.jpg',
      Tires: '/Assets/images/Tires.jpg',
    };
    return localMap[category.name] || null;
  }

  // Return a background URL for a subcategory: prefer backend imageUrl, fallback to local images
  getSubcategoryBgUrl(subcategory: Subcategory | null): string {
    if (!subcategory) return '/Assets/images/Fluids.jpg';
    if (subcategory.imageUrl) return subcategory.imageUrl;
    // Local fallback mapping based on subcategory name
    const localMap: { [key: string]: string } = {
      'Fluids': '/Assets/images/Fluids.jpg',
      'Oil & Filters': '/Assets/images/OilFilters.jpg',
      'Oil Filters': '/Assets/images/OilFilters.jpg',
      'Scheduled Services': '/Assets/images/ScheduledService.jpg',
      'Scheduled Service': '/Assets/images/ScheduledService.jpg',
      'Summer': '/Assets/images/Summer.jpg',
      'Travel': '/Assets/images/Travel.jpg',
      'Winter': '/Assets/images/winter.jpg',
      'Sensors & Electronics': '/Assets/images/Sensors.jpg',
      'Electrical & Lighting System': '/Assets/images/LighteningSystem.jpg',
      'Engine & Transmission': '/Assets/images/EngineTransmission.jpg',
      'Fuel System': '/Assets/images/FuelSystem.jpg',
      'Inspection': '/Assets/images/Inspection.jpg',
      'Suspension System & Dampening': '/Assets/images/SuspensionSystem.jpg',
      'Parking Brake': '/Assets/images/ParkingBrake.jpg',
      'AC Service': '/Assets/images/ACService.jpg',
      'Cooling System': '/Assets/images/CoolingSystem.jpg',
      'Body Repair': '/Assets/images/BodyRepair.jpg',
      'Painting': '/Assets/images/Painting.jpg',
      'Glass': '/Assets/images/Glass.jpg',
      'Detailing & Care': '/Assets/images/DetailingCar.jpg',
      'Tire Services': '/Assets/images/TimeService.jpg',
      'Wheels & Alignment': '/Assets/images/WheelsAndAlignments.jpg',
      'Tire Inspection': '/Assets/images/TimeInspection.jpg',
    };
    return localMap[subcategory.name] || '/Assets/images/Fluids.jpg';
  }

  // Load subcategories for a category
  loadSubcategories(categoryId: number): void {
    this.isLoadingSubcategories = true;
    this.subcategoriesError = null;
    this.subcategories = [];

    this.categoryService.getSubcategoriesByCategory(categoryId).subscribe({
      next: (subcategories: Subcategory[]) => {
        this.subcategories = subcategories;
        this.isLoadingSubcategories = false;
        console.log('Subcategories loaded successfully:', subcategories);

        // Scroll to subcategories section after loading
        setTimeout(() => {
          const element = document.querySelector('.subcategories-section');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
        // Force change detection to ensure template updates immediately
        try {
          this.cdr.detectChanges();
        } catch (e) {
          /* ignore */
        }
      },
      error: (error: any) => {
        console.error('Error loading subcategories:', error);
        this.subcategoriesError = 'Failed to load service options. Please try again.';
        this.isLoadingSubcategories = false;
        try {
          this.cdr.detectChanges();
        } catch (e) {
          /* ignore */
        }
      },
    });
  }

  // Select subcategory - now loads services for this subcategory
  selectSubcategory(subcategory: Subcategory): void {
    this.selectedSubcategory = subcategory;
    this.selectedService = null;
    console.log('Selected subcategory:', subcategory);
    // Switch to services view and load services
    this.showingServices = true;
    // Ensure view updates immediately to show loading state
    try {
      this.cdr.detectChanges();
    } catch (e) {
      /* ignore */
    }
    this.loadServices(subcategory.id);
  }

  // Load services for a subcategory
  loadServices(subcategoryId: number): void {
    this.isLoadingServices = true;
    this.servicesError = null;
    this.services = [];

    this.categoryService.getServicesBySubcategory(subcategoryId).subscribe({
      next: (services: Service[]) => {
        this.services = services;
        this.isLoadingServices = false;
        console.log('Services loaded successfully:', services);

        // Scroll to services section after loading
        setTimeout(() => {
          const element = document.querySelector('.services-section');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
        // Force change detection to ensure template updates immediately
        try {
          this.cdr.detectChanges();
        } catch (e) {
          /* ignore */
        }
      },
      error: (error: any) => {
        console.error('Error loading services:', error);
        this.servicesError = 'Failed to load services. Please try again.';
        this.isLoadingServices = false;
        try {
          this.cdr.detectChanges();
        } catch (e) {
          /* ignore */
        }
      },
    });
  }

  // Select service (only one can be selected)
  selectService(service: Service): void {
    this.selectedService = service;
    console.log('Selected service:', service);
  }

  // Back to subcategories view
  backToSubcategories(): void {
    this.showingServices = false;
    this.selectedService = null;
    this.services = [];
    // Scroll to subcategories section
    setTimeout(() => {
      const el = document.querySelector('.subcategories-section');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }

  // Back to categories view
  backToCategories(): void {
    this.showingSubcategories = false;
    this.showingServices = false;
    this.selectedSubcategory = null;
    this.selectedService = null;
    this.subcategories = [];
    this.services = [];
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Step navigation
  nextStep(): void {
    // If preselected service flow: skip step 3 (workshop selection)
    // since workshop is already selected from workshop-details
    if (this.hasPreselectedService()) {
      if (this.currentStep === 1 && this.isStep1Valid()) {
        // Go directly to step 2 (Date & Time)
        this.currentStep = 2;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (this.currentStep === 2 && this.isStep2Valid()) {
        // Skip step 3, auto-select the preselected workshop, show payment popup
        this.autoSelectPreselectedWorkshop();
        this.showPaymentPopup = true;
        return;
      }
    }

    // Normal flow: Show payment popup after workshop selection (step 3)
    if (this.currentStep === 3 && this.isStep3Valid()) {
      this.showPaymentPopup = true;
      return;
    }

    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Load workshops when entering step 3
      if (this.currentStep === 3) {
        this.loadWorkshops();
      }
    }
  }

  /**
   * Auto-select the preselected workshop for the booking
   */
  private autoSelectPreselectedWorkshop(): void {
    if (this.preselectedWorkshopId && this.preselectedWorkshopName) {
      this.selectedWorkshop = {
        id: this.preselectedWorkshopId,
        name: this.preselectedWorkshopName,
        rating: 0,
        reviewCount: 0,
        address: '',
        workshopProfileId: this.preselectedWorkshopId,
        workshopServiceID: this.preselectedWorkshopServiceId || 0,
        serviceId: this.preselectedServiceId || 0,
        price: this.preselectedMinPrice || 0,
        minPrice: this.preselectedMinPrice || undefined,
        maxPrice: this.preselectedMaxPrice || undefined,
      };
    }
  }

  previousStep(): void {
    if (this.currentStep > 1) {
      // In preselected flow: 1=Vehicle, 2=Date/Time, 3=Review
      // Simply go back one step, no special handling needed
      this.currentStep--;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  goToStep(step: number): void {
    // In preselected flow, step 3 is Workshop which should be skipped
    // and the max step is 3 (Review)
    if (this.hasPreselectedService()) {
      // Prevent going to step 3 (which would be Workshop in normal flow)
      // In preselected flow: 1=Vehicle, 2=Date/Time, 3=Review
      if (step > 3) return;
      if (step <= this.currentStep) {
        this.currentStep = step;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else {
      if (step <= this.currentStep) {
        this.currentStep = step;
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Load workshops when navigating to step 3
        if (step === 3) {
          this.loadWorkshops();
        }
      }
    }
  }

  // Photo Upload Methods
  triggerFileInput(): void {
    this.fileInput?.nativeElement.click();
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.handleFiles(Array.from(input.files));
    }
    // Reset input so same file can be selected again
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    if (event.dataTransfer?.files) {
      this.handleFiles(Array.from(event.dataTransfer.files));
    }
  }

  private handleFiles(files: File[]): void {
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));

    for (const file of imageFiles) {
      // Check max photos limit
      if (this.selectedPhotos.length >= this.maxPhotos) {
        alert(`Maximum ${this.maxPhotos} photos allowed`);
        break;
      }

      // Check file size
      if (file.size > this.maxFileSize) {
        alert(`File "${file.name}" is too large. Maximum size is 5MB.`);
        continue;
      }

      // Create preview and add to array
      const reader = new FileReader();
      reader.onload = (e) => {
        this.selectedPhotos.push({
          file: file,
          preview: e.target?.result as string,
        });
        // Trigger change detection since FileReader runs outside Angular zone
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(file);
    }
  }

  removePhoto(index: number): void {
    this.selectedPhotos.splice(index, 1);
  }

  /**
   * Check if user came from workshop-details with a preselected service
   */
  hasPreselectedService(): boolean {
    return !!(
      this.preselectedWorkshopId &&
      this.preselectedWorkshopServiceId &&
      this.preselectedServiceName
    );
  }

  // Step validation
  isStep1Valid(): boolean {
    // If preselected service from workshop-details, only need vehicle selection
    if (this.hasPreselectedService()) {
      return this.selectedVehicle !== null;
    }
    // Otherwise, require selected vehicle and selected service
    return this.selectedVehicle !== null && this.selectedService !== null;
  }

  isStep2Valid(): boolean {
    return this.selectedDate !== null && this.selectedTimeSlot !== null;
  }

  isStep3Valid(): boolean {
    return this.selectedWorkshop !== null;
  }

  // Vehicle selection
  selectVehicle(vehicle: Vehicle): void {
    this.selectedVehicle = vehicle;
    // Detect vehicle origin
    this.detectVehicleOrigin(vehicle);
  }

  /**
   * Detect vehicle origin from the vehicle object or fallback to cars-data.json lookup.
   */
  private detectVehicleOrigin(vehicle: Vehicle): void {
    // Try to detect origin from vehicle fields first
    const directOrigin = vehicle.origin || vehicle.country || vehicle.CarOrigin;
    if (directOrigin && directOrigin.trim() !== '') {
      this.selectedVehicleOrigin = directOrigin.trim();
      console.log('Vehicle origin detected from vehicle fields:', this.selectedVehicleOrigin);
      return;
    }

    // Fallback: lookup make in cars-data.json
    this.carsService.getAllMakesAndModels().subscribe({
      next: (makesData: MakeModels[]) => {
        const makeLower = vehicle.make?.toLowerCase() || '';
        const match = makesData.find((m) => m.make.toLowerCase() === makeLower);
        if (match && match.CarOrigin) {
          this.selectedVehicleOrigin = match.CarOrigin;
          console.log('Vehicle origin detected from cars-data.json:', this.selectedVehicleOrigin);
        } else {
          // Default to 'General' if no match found
          this.selectedVehicleOrigin = 'General';
          console.log('Vehicle origin not found, defaulting to General');
        }
      },
      error: (err) => {
        console.warn('Could not load cars-data.json for origin lookup, defaulting to General', err);
        this.selectedVehicleOrigin = 'General';
      },
    });
  }

  // Service type selection
  selectServiceType(serviceType: ServiceType): void {
    this.selectedServiceType = serviceType;
  }

  // Date & Time selection
  selectMonth(month: number, year: number): void {
    this.selectedMonth = month;
    this.selectedYear = year;
    this.selectedDate = null;
    this.selectedTimeSlot = null;
    this.generateDaysInMonth(month, year);
    console.log('Selected month:', this.MONTH_NAMES[month], year);
  }

  generateDaysInMonth(month: number, year: number): void {
    this.daysInMonth = [];
    const daysCount = new Date(year, month + 1, 0).getDate();
    const today = this.getCurrentCairoDate();
    today.setHours(0, 0, 0, 0);

    for (let day = 1; day <= daysCount; day++) {
      const date = new Date(year, month, day);
      // Only include dates from today onwards
      if (date >= today) {
        this.daysInMonth.push(date);
      }
    }
  }

  selectDate(date: Date): void {
    this.selectedDate = date;
    this.selectedTimeSlot = null; // Reset time slot when date changes
    console.log('Selected date:', this.formatDateForBackend(date));
  }

  selectTimeSlot(slot: string): void {
    this.selectedTimeSlot = slot;
    if (this.selectedDate && this.selectedTimeSlot) {
      const combinedDateTime = this.getCombinedDateTime();
      if (combinedDateTime !== null) {
        console.log('Combined DateTime (ISO):', combinedDateTime);
        console.log(
          'Combined DateTime (Cairo):',
          new Date(combinedDateTime).toLocaleString('en-US', { timeZone: this.CAIRO_TIMEZONE })
        );
      }
    }
  }

  isDateSelected(date: Date): boolean {
    if (!this.selectedDate) return false;
    return date.toDateString() === this.selectedDate.toDateString();
  }

  isTimeSlotAvailable(slot: string): boolean {
    return !this.unavailableSlots.includes(slot);
  }

  formatDate(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    };
    return date.toLocaleDateString('en-US', options);
  }

  formatDateLong(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    };
    return date.toLocaleDateString('en-US', options);
  }

  /**
   * Combine selected date and time slot into a single DateTime
   * Returns format: "2025-11-28 10:00:00.0000000" for backend
   */
  getCombinedDateTime(): string | null {
    if (!this.selectedDate || !this.selectedTimeSlot) {
      return null;
    }

    // Parse time slot (HH:mm format)
    const [hours, minutes] = this.selectedTimeSlot.split(':').map(Number);

    // Format date components
    const year = this.selectedDate.getFullYear();
    const month = (this.selectedDate.getMonth() + 1).toString().padStart(2, '0');
    const day = this.selectedDate.getDate().toString().padStart(2, '0');
    const hoursStr = hours.toString().padStart(2, '0');
    const minutesStr = minutes.toString().padStart(2, '0');

    // Return format: "2025-11-28 10:00:00.0000000" for backend
    return `${year}-${month}-${day} ${hoursStr}:${minutesStr}:00.0000000`;
  }

  /**
   * Format date for backend (YYYY-MM-DD)
   */
  formatDateForBackend(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Get current date in Cairo timezone
   */
  getCurrentCairoDate(): Date {
    const now = new Date();
    const cairoTimeString = now.toLocaleString('en-US', { timeZone: this.CAIRO_TIMEZONE });
    return new Date(cairoTimeString);
  }

  /**
   * Check if time slot is available (not in past for today)
   */
  isTimeSlotAvailableWithPast(slot: string): boolean {
    if (!this.isTimeSlotAvailable(slot)) {
      return false;
    }

    if (!this.selectedDate) {
      return true;
    }

    const now = this.getCurrentCairoDate();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const selectedDay = new Date(
      this.selectedDate.getFullYear(),
      this.selectedDate.getMonth(),
      this.selectedDate.getDate()
    );

    // If selected date is not today, all slots are available
    if (selectedDay.getTime() !== today.getTime()) {
      return true;
    }

    // For today, check if slot time has passed
    const [hours, minutes] = slot.split(':').map(Number);
    const slotTime = hours * 60 + minutes; // Convert to minutes
    const currentTime = now.getHours() * 60 + now.getMinutes();

    return slotTime > currentTime;
  }

  /**
   * Check if a month is selected
   */
  isMonthSelected(month: number, year: number): boolean {
    return this.selectedMonth === month && this.selectedYear === year;
  }

  /**
   * Get day name (short format)
   */
  getDayName(date: Date): string {
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    return days[date.getDay()];
  }

  /**
   * Format date for display (day number)
   */
  getDayNumber(date: Date): number {
    return date.getDate();
  }

  /**
   * Check if date is selected
   */
  isDateSelectedInMonth(date: Date): boolean {
    if (!this.selectedDate) return false;
    return date.toDateString() === this.selectedDate.toDateString();
  }

  // Workshop selection - single selection with toggle
  toggleWorkshop(workshop: Workshop): void {
    // Prevent selection of closed workshops
    if (workshop.isClosed) {
      console.log('Cannot select closed workshop:', workshop.name);
      return;
    }

    if (this.selectedWorkshop && this.selectedWorkshop.id === workshop.id) {
      // Deselect if clicking the same workshop
      this.selectedWorkshop = null;
    } else {
      // Select the clicked workshop
      this.selectedWorkshop = workshop;
    }
  }

  // Check if a workshop is selected
  isWorkshopSelected(workshop: Workshop): boolean {
    return this.selectedWorkshop !== null && this.selectedWorkshop.id === workshop.id;
  }

  /**
   * Load workshops from the backend API based on selected service, vehicle origin, and appointment date.
   * Called when entering step 3 (workshop selection).
   */
  loadWorkshops(): void {
    if (!this.selectedService) {
      console.warn('Cannot load workshops: no service selected');
      this.workshopsError = 'Please select a service first';
      this.isLoadingWorkshops = false;
      return;
    }

    if (!this.selectedDate || !this.selectedTimeSlot) {
      console.warn('Cannot load workshops: date or time not selected');
      this.workshopsError = 'Please select a date and time first';
      this.isLoadingWorkshops = false;
      return;
    }

    this.isLoadingWorkshops = true;
    this.workshopsError = null;
    this.workshops = [];

    const serviceId = this.selectedService.id;
    const origin = this.selectedVehicleOrigin || 'General';

    // Format appointment date for the API: "YYYY-MM-DD HH:mm:ss.0000000"
    const appointmentDate = this.formatAppointmentDateForApi();

    console.log(
      'Loading workshops for serviceId:',
      serviceId,
      'origin:',
      origin,
      'appointmentDate:',
      appointmentDate
    );

    this.workshopProfileService
      .searchWorkshopsByServiceAndOrigin(serviceId, origin, appointmentDate, {
        pageNumber: this.workshopCurrentPage,
        pageSize: this.workshopPageSize,
      })
      .subscribe({
        next: (response: any) => {
          console.log('Workshops search response:', response);

          // Handle the new response structure: { success, message, data: { items, pageNumber, ... } }
          if (response?.success && response?.data?.items && Array.isArray(response.data.items)) {
            this.workshops = response.data.items.map((w: any, index: number) =>
              this.mapApiWorkshopToInterface(w, index)
            );

            // Update pagination info
            this.workshopCurrentPage = response.data.pageNumber || 1;
            this.workshopPageSize = response.data.pageSize || 10;
            this.workshopTotalRecords = response.data.totalRecords || 0;
            this.workshopTotalPages = response.data.totalPages || 0;
            this.workshopHasPreviousPage = response.data.hasPreviousPage || false;
            this.workshopHasNextPage = response.data.hasNextPage || false;
          } else if (response?.data && Array.isArray(response.data)) {
            // Fallback: data is directly an array
            this.workshops = response.data.map((w: any, index: number) =>
              this.mapApiWorkshopToInterface(w, index)
            );
            this.workshopTotalRecords = this.workshops.length;
            this.workshopTotalPages = 1;
          } else if (Array.isArray(response)) {
            // Fallback: response is directly an array
            this.workshops = response.map((w: any, index: number) =>
              this.mapApiWorkshopToInterface(w, index)
            );
            this.workshopTotalRecords = this.workshops.length;
            this.workshopTotalPages = 1;
          } else {
            this.workshops = [];
            this.workshopTotalRecords = 0;
            this.workshopTotalPages = 0;
          }

          this.isLoadingWorkshops = false;
          console.log('Mapped workshops:', this.workshops);
          console.log('Pagination info:', {
            currentPage: this.workshopCurrentPage,
            totalPages: this.workshopTotalPages,
            totalRecords: this.workshopTotalRecords,
            hasPreviousPage: this.workshopHasPreviousPage,
            hasNextPage: this.workshopHasNextPage,
          });

          if (this.workshops.length === 0) {
            this.workshopsError =
              'No workshops found for the selected service and vehicle origin. Try a different service or check back later.';
          }

          try {
            this.cdr.detectChanges();
          } catch (e) {
            /* ignore */
          }
        },
        error: (error: any) => {
          console.error('Error loading workshops:', error);

          // Provide more specific error messages
          if (error?.message?.includes('timed out')) {
            this.workshopsError =
              'The server is taking too long to respond. Please check your connection and try again.';
          } else if (error?.status === 0) {
            this.workshopsError =
              'Cannot connect to the server. Please check if the backend is running.';
          } else if (error?.status === 404) {
            this.workshopsError = 'No workshops found for the selected criteria.';
          } else {
            this.workshopsError = 'Failed to load workshops. Please try again.';
          }

          this.isLoadingWorkshops = false;
          try {
            this.cdr.detectChanges();
          } catch (e) {
            /* ignore */
          }
        },
      });
  }

  /**
   * Format the selected date and time slot for the API request.
   * Returns format: "YYYY-MM-DD HH:mm:ss.0000000"
   */
  private formatAppointmentDateForApi(): string {
    if (!this.selectedDate || !this.selectedTimeSlot) {
      return '';
    }

    const year = this.selectedDate.getFullYear();
    const month = (this.selectedDate.getMonth() + 1).toString().padStart(2, '0');
    const day = this.selectedDate.getDate().toString().padStart(2, '0');
    const [hours, minutes] = this.selectedTimeSlot.split(':');

    return `${year}-${month}-${day} ${hours}:${minutes}:00.0000000`;
  }

  /**
   * Map API workshop response to the Workshop interface used by the UI.
   * Handles the new response structure from Search-Workshops-By-Service-And-Origin endpoint.
   */
  private mapApiWorkshopToInterface(apiWorkshop: any, index: number): Workshop {
    // Use workshopId from the new response structure, fallback to workshopProfileId or index
    const workshopId =
      apiWorkshop.workshopId || apiWorkshop.workshopProfileId || apiWorkshop.id || index;

    // Build address from available location fields
    const addressParts = [apiWorkshop.city, apiWorkshop.governorate, apiWorkshop.country].filter(
      Boolean
    );
    const fullAddress = addressParts.join(', ') || apiWorkshop.address || '';

    return {
      id: workshopId,
      name: apiWorkshop.workshopName || apiWorkshop.name || 'Unknown Workshop',
      rating: apiWorkshop.rating || apiWorkshop.averageRating || 0,
      reviewCount: apiWorkshop.totalReviews || apiWorkshop.reviewCount || 0,
      address: fullAddress,
      phone: apiWorkshop.phoneNumber || apiWorkshop.phone || '',
      services: apiWorkshop.serviceName ? [apiWorkshop.serviceName] : [],
      // Store additional API fields from new response structure
      workshopProfileId: apiWorkshop.workshopId || apiWorkshop.workshopProfileId,
      workshopName: apiWorkshop.workshopName,
      workshopDescription: apiWorkshop.workshopDescription || apiWorkshop.description || '',
      workshopType: apiWorkshop.workshopType,
      serviceId: apiWorkshop.serviceId,
      workshopServiceID: apiWorkshop.workshopServiceID, // This is the ID needed for booking
      serviceName: apiWorkshop.serviceName,
      serviceDescription: apiWorkshop.serviceDescription || '',
      price: apiWorkshop.price,
      minPrice: apiWorkshop.minPrice,
      maxPrice: apiWorkshop.maxPrice,
      logoUrl:
        apiWorkshop.logoImageUrl ||
        apiWorkshop.LogoImageUrl ||
        apiWorkshop.logoUrl ||
        apiWorkshop.logo,
      city: apiWorkshop.city,
      country: apiWorkshop.country,
      governorate: apiWorkshop.governorate,
      averageRating: apiWorkshop.rating || apiWorkshop.averageRating,
      totalReviews: apiWorkshop.totalReviews,
      latitude: apiWorkshop.latitude,
      longitude: apiWorkshop.longitude,
      email: apiWorkshop.email,
      origin: apiWorkshop.origin,
      duration: apiWorkshop.duration,
      numbersOfTechnicians: apiWorkshop.numbersOfTechnicians,
      isClosed: apiWorkshop.isClosed,
    };
  }

  /**
   * Navigate to previous page of workshops
   */
  previousWorkshopPage(): void {
    if (this.workshopHasPreviousPage && this.workshopCurrentPage > 1) {
      this.workshopCurrentPage--;
      this.loadWorkshops();
      // Scroll to top of workshop list
      setTimeout(() => {
        const element = document.querySelector('.workshop-list');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }

  /**
   * Navigate to next page of workshops
   */
  nextWorkshopPage(): void {
    if (this.workshopHasNextPage && this.workshopCurrentPage < this.workshopTotalPages) {
      this.workshopCurrentPage++;
      this.loadWorkshops();
      // Scroll to top of workshop list
      setTimeout(() => {
        const element = document.querySelector('.workshop-list');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }

  /**
   * Navigate to specific page of workshops
   */
  goToWorkshopPage(page: number): void {
    if (page >= 1 && page <= this.workshopTotalPages && page !== this.workshopCurrentPage) {
      this.workshopCurrentPage = page;
      this.loadWorkshops();
      // Scroll to top of workshop list
      setTimeout(() => {
        const element = document.querySelector('.workshop-list');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }

  /**
   * Get array of page numbers for pagination display
   */
  getWorkshopPageNumbers(): number[] {
    const pages: number[] = [];
    const maxPagesToShow = 5;

    if (this.workshopTotalPages <= maxPagesToShow) {
      // Show all pages if total is less than max
      for (let i = 1; i <= this.workshopTotalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show current page and 2 pages before and after
      const startPage = Math.max(1, this.workshopCurrentPage - 2);
      const endPage = Math.min(this.workshopTotalPages, this.workshopCurrentPage + 2);

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }

    return pages;
  }

  /**
   * Get visible page numbers for new pagination style
   */
  getWorkshopVisiblePages(): number[] {
    const pages: number[] = [];
    const start = Math.max(2, this.workshopCurrentPage - 1);
    const end = Math.min(this.workshopTotalPages - 1, this.workshopCurrentPage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  /**
   * Get start record number for display
   */
  getWorkshopStartRecord(): number {
    return (this.workshopCurrentPage - 1) * this.workshopPageSize + 1;
  }

  /**
   * Get end record number for display
   */
  getWorkshopEndRecord(): number {
    return Math.min(this.workshopCurrentPage * this.workshopPageSize, this.workshopTotalRecords);
  }

  /**
   * Handle page size change
   */
  onWorkshopPageSizeChange(): void {
    this.workshopCurrentPage = 1;
    this.loadWorkshops();
  }

  /**
   * Get full logo URL with API host
   */
  getWorkshopLogoUrl(workshop: Workshop): string | null {
    if (!workshop.logoUrl) return null;

    // If logoUrl already contains http/https, return as-is
    if (workshop.logoUrl.startsWith('http://') || workshop.logoUrl.startsWith('https://')) {
      return workshop.logoUrl;
    }

    // Handle relative paths from API
    const logoPath = workshop.logoUrl.startsWith('/') ? workshop.logoUrl : `/${workshop.logoUrl}`;

    // Common upload paths from backend
    if (logoPath.includes('/uploads/') || logoPath.includes('/images/')) {
      return `${this.API_BASE_URL}${logoPath}`;
    }

    // Default to uploads directory
    return `${this.API_BASE_URL}/uploads/${workshop.logoUrl}`;
  }

  /**
   * Open workshop location in Google Maps
   */
  openInGoogleMaps(workshop: Workshop, event: Event): void {
    event.stopPropagation(); // Prevent card selection

    if (workshop.latitude && workshop.longitude) {
      const url = `https://www.google.com/maps?q=${workshop.latitude},${workshop.longitude}`;
      window.open(url, '_blank');
    } else if (workshop.city || workshop.address) {
      const query = encodeURIComponent(workshop.city || workshop.address);
      const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
      window.open(url, '_blank');
    }
  }

  // Price calculation (temporary placeholder until services are implemented)
  calculateTotalPrice(): number {
    // TODO: Update when service prices are available from subcategories/services
    return 0;
  }

  getSubtotal(): number {
    // TODO: Update when service prices are available from subcategories/services
    return 0;
  }

  getTax(): number {
    return this.getSubtotal() * 0.14;
  }

  // Booking submission
  confirmBooking(): void {
    // Prevent duplicate submissions
    if (this.isSubmittingBooking) return;
    // Validate required fields
    if (!this.selectedVehicle) {
      this.bookingError = 'Please select a vehicle';
      return;
    }
    if (!this.selectedWorkshop) {
      this.bookingError = 'Please select a workshop';
      return;
    }
    // For preselected flow, we have workshopServiceId from query params
    // For normal flow, we need selectedService
    if (
      !this.hasPreselectedService() &&
      !this.selectedService &&
      !this.selectedWorkshop.serviceId
    ) {
      this.bookingError = 'Please select a service';
      return;
    }
    if (!this.selectedPaymentMethod) {
      this.bookingError = 'Please select a payment method';
      return;
    }

    // Get combined DateTime in ISO format
    const bookingDateTime = this.getCombinedDateTime();

    if (!bookingDateTime) {
      this.bookingError = 'Please select date and time';
      return;
    }

    // Clear any previous errors
    this.bookingError = '';
    this.isSubmittingBooking = true;

    // Get the workshop service ID (workshopServiceID from API response is required for booking)
    const workshopServiceId =
      this.selectedWorkshop.workshopServiceID || this.selectedWorkshop.serviceId || 0;
    const workshopProfileId = this.selectedWorkshop.workshopProfileId || this.selectedWorkshop.id;

    console.log('Workshop Service ID:', workshopServiceId);
    console.log('Workshop Profile ID:', workshopProfileId);

    // Map payment method to backend enum: Cash, CreditCard
    const paymentMethodMap: { [key: string]: string } = {
      cash: 'Cash',
      credit_card: 'CreditCard',
      'credit-card': 'CreditCard',
      creditcard: 'CreditCard',
      card: 'CreditCard',
      credit: 'CreditCard',
    };
    const apiPaymentMethod = paymentMethodMap[this.selectedPaymentMethod.toLowerCase()];

    if (!apiPaymentMethod) {
      this.bookingError = 'Invalid payment method selected';
      this.isSubmittingBooking = false;
      return;
    }

    // Prepare booking data using FormData for file upload
    const formData = new FormData();
    formData.append('AppointmentDate', bookingDateTime);
    formData.append('IssueDescription', this.serviceNotes || '');
    formData.append('PaymentMethod', apiPaymentMethod);
    formData.append('CarId', String(this.selectedVehicle.id));
    formData.append('WorkShopProfileId', String(workshopProfileId));
    formData.append('WorkshopServiceId', String(workshopServiceId));

    // Add photos to FormData
    for (const photo of this.selectedPhotos) {
      formData.append('Photos', photo.file, photo.file.name);
    }

    console.log('=== BOOKING DATA FOR BACKEND ===');
    console.log('Booking DateTime (ISO):', bookingDateTime);
    console.log(
      'Booking DateTime (Cairo):',
      new Date(bookingDateTime).toLocaleString('en-US', {
        timeZone: this.CAIRO_TIMEZONE,
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    );
    console.log('Photos count:', this.selectedPhotos.length);

    // Send to backend API with FormData
    this.bookingService.createBookingWithPhotos(formData).subscribe({
      next: (response) => {
        console.log('=== BOOKING API RESPONSE ===');
        console.log('Full response:', response);
        console.log('Success:', response.success);
        console.log('Message:', response.message);
        console.log('Data:', response.data);

        this.isSubmittingBooking = false;

        if (response.success) {
          // Use booking ID from response as confirmation number
          this.confirmationNumber = 'BK' + String(response.data.id).padStart(6, '0');

          // Track booking creation time locally for cancel button eligibility
          try {
            const stored = localStorage.getItem('recentBookingCreationTimes');
            const data = stored ? JSON.parse(stored) : {};
            data[response.data.id] = new Date().toISOString();
            localStorage.setItem('recentBookingCreationTimes', JSON.stringify(data));
            console.log('✅ Stored local creation time for booking:', response.data.id);
          } catch (error) {
            console.error('Error storing booking creation time:', error);
          }

          this.currentStep = 5;
          this.bookingConfirmed = true;
          window.scrollTo({ top: 0, behavior: 'smooth' });
          try {
            this.cdr.detectChanges();
          } catch (e) {
            /* ignore */
          }
        } else {
          this.bookingError = response.message || 'Failed to create booking';
        }
      },
      error: (error) => {
        console.error('=== BOOKING API ERROR ===');
        console.error('Full error object:', error);
        console.error('Error status:', error.status);
        console.error('Error statusText:', error.statusText);
        console.error('Error message:', error.message);
        console.error('Error body:', error.error);
        if (error.error?.errors) {
          console.error('Validation errors:', error.error.errors);
        }

        this.isSubmittingBooking = false;

        // Build detailed error message
        let errorMessage = 'Failed to create booking. ';
        if (error.status === 0) {
          errorMessage = 'Cannot connect to server. Please ensure the backend is running.';
        } else if (error.error?.message) {
          errorMessage = error.error.message;
        } else if (error.error?.title) {
          errorMessage = error.error.title;
          if (error.error?.errors) {
            const validationErrors = Object.entries(error.error.errors)
              .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(', ')}`)
              .join('; ');
            errorMessage += ' - ' + validationErrors;
          }
        } else if (error.message) {
          errorMessage = error.message;
        }

        this.bookingError = errorMessage;
      },
    });
  }

  startNewBooking(): void {
    // Reset all state
    this.currentStep = 1;
    this.selectedVehicle = null;
    this.selectedCategory = null;
    this.selectedSubcategory = null;
    this.selectedService = null;
    this.showingSubcategories = false;
    this.showingServices = false;
    this.subcategories = [];
    this.services = [];
    this.serviceNotes = '';
    this.selectedDate = null;
    this.selectedTimeSlot = null;
    this.selectedWorkshop = null;
    this.workshops = [];
    this.workshopsError = null;
    this.selectedVehicleOrigin = 'General';
    this.selectedPaymentMethod = null;
    this.showPaymentPopup = false;
    this.bookingConfirmed = false;
    this.confirmationNumber = '';

    // Clear photos
    this.selectedPhotos = [];
    this.isDragging = false;

    // Clear preselected values
    this.preselectedWorkshopId = null;
    this.preselectedWorkshopServiceId = null;
    this.preselectedServiceId = null;
    this.preselectedServiceName = null;
    this.preselectedWorkshopName = null;
    this.preselectedMinPrice = null;
    this.preselectedMaxPrice = null;

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  goToMyVehicles(): void {
    this.router.navigate(['/my-vehicles']);
  }

  // Get car logo URL from carlogos.org
  getCarLogoUrl(vehicle: Vehicle): string {
    const make = vehicle.make.toLowerCase().replace(/\s+/g, '-');
    return `https://www.carlogos.org/car-logos/${make}-logo.png`;
  }

  // Handle logo loading error
  handleLogoError(event: any): void {
    event.target.style.display = 'none';
  }

  // Payment method popup handlers
  onPaymentMethodSelected(method: string): void {
    this.selectedPaymentMethod = method;
    this.showPaymentPopup = false;
    console.log('Payment method selected:', method);

    // Proceed to next step (review)
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  closePaymentPopup(): void {
    this.showPaymentPopup = false;
  }
}
