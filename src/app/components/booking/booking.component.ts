import { Component, OnInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
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
  workshopType?: string;        // e.g., 'Independent', 'Franchise'
  serviceId?: number;
  workshopServiceID?: number;   // Workshop service ID from API (used for booking)
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
  origin?: string;              // Vehicle origin this workshop serves
  duration?: number;            // Service duration in minutes
  numbersOfTechnicians?: number;
  isClosed?: boolean;           // Whether workshop is currently closed
}

interface BookingDraft {
  step: number;
  vehicleId: number | null;
  categoryId: number | null;
  serviceNotes: string;
  selectedDate: string | null;
  selectedTimeSlot: string | null;
  workshopIds: number[];  // Changed to array for multi-selection
  paymentMethod: string | null;
  timestamp: number;
}

@Component({
  selector: 'app-booking',
  standalone: true,
  imports: [CommonModule, FormsModule, PaymentMethodPopupComponent],
  templateUrl: './booking.component.html',
  styleUrls: ['./booking.component.css']
})
export class BookingComponent implements OnInit {
  @ViewChild('categoriesGrid') categoriesGrid?: ElementRef;
  
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
  
  // Date & Time selection
  selectedMonth: number | null = null; // 0-11 (January = 0)
  selectedYear: number | null = null;
  selectedDate: Date | null = null;
  selectedTimeSlot: string | null = null;
  availableDates: Date[] = [];
  availableMonths: { month: number; year: number; name: string; displayName: string }[] = [];
  daysInMonth: Date[] = [];
  availableTimeSlots: string[] = [
    '00:00', '00:30', '01:00', '01:30', '02:00', '02:30', '03:00', '03:30',
    '04:00', '04:30', '05:00', '05:30', '06:00', '06:30', '07:00', '07:30',
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
    '20:00', '20:30', '21:00', '21:30', '22:00', '22:30', '23:00', '23:30'
  ];
  unavailableSlots: string[] = []; // Mock unavailable slots
  
  // Timezone configuration
  readonly CAIRO_TIMEZONE = 'Africa/Cairo';
  
  // Month names
  readonly MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  // Workshop selection (loaded from API when entering step 3)
  workshops: Workshop[] = [];
  selectedWorkshop: Workshop | null = null;  // Single workshop selection
  isLoadingWorkshops = false;
  workshopsError: string | null = null;
  
  // Payment method selection
  showPaymentPopup = false;
  selectedPaymentMethod: string | null = null;
  
  // Vehicle origin for workshop search (default 'General' if undetected)
  selectedVehicleOrigin: string = 'General';
  
  // Draft management
  hasSavedDraft = false;
  showDraftBanner = false;
  
  // Success state
  bookingConfirmed = false;
  confirmationNumber = '';
  isSubmittingBooking: boolean = false;
  bookingError: string = '';

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
    // Start loading vehicles (cached promise will prevent duplicate requests)
    this.loadUserVehicles();
    this.loadCategories();
    this.checkForSavedDraft();
    // Attempt to restore persisted subcategory selection (if any)
    this.restoreSubcategoryState();
    // Restore persisted vehicle origin (if any)
    this.restoreVehicleOrigin();
    
    // Check for pre-selected vehicle from query params
    this.route.queryParams.subscribe(async params => {
      if (params['vehicleId']) {
        const vehicleId = Number(params['vehicleId']);
        // Ensure vehicles are loaded before attempting to select one
        try {
          await this.loadUserVehicles();
        } catch (e) {
          // ignore - loadUserVehicles resolves even on error to avoid blocking
        }

        const vehicle = this.userVehicles.find(v => v.id === vehicleId);
        if (vehicle) {
          this.selectedVehicle = vehicle;
        }
      }
    });
  }

  // Initialize available dates (next 30 days, excluding weekends)
  initializeAvailableDates(): void {
    const today = this.getCurrentCairoDate();
    this.availableDates = [];
    this.availableMonths = [];
    
    // Generate next 6 months
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    for (let i = 0; i < 6; i++) {
      const month = (currentMonth + i) % 12;
      const year = currentYear + Math.floor((currentMonth + i) / 12);
      
      this.availableMonths.push({
        month,
        year,
        name: this.MONTH_NAMES[month],
        displayName: `${this.MONTH_NAMES[month]} ${year}`
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
          this.vehiclesLoaded = true;
          this.isLoadingVehicles = false;
          // If the user previously selected a vehicle, try to re-select it
          try {
            const persisted = localStorage.getItem('booking_selected_vehicle_id');
            if (persisted) {
              const persistedId = Number(persisted);
              const found = this.userVehicles.find(v => v.id === persistedId);
              if (found) this.selectedVehicle = found;
            }
          } catch (e) {
            // ignore storage errors
          }
          try { this.cdr.detectChanges(); } catch (e) { /* ignore */ }
          resolve();
        },
        error: (error: any) => {
          console.error('Error loading vehicles:', error);
          // Resolve anyway to avoid blocking callers; the UI can handle empty list
          this.vehiclesLoaded = true;
          this.isLoadingVehicles = false;
          try { this.cdr.detectChanges(); } catch (e) { /* ignore */ }
          resolve();
        }
      });
    });

    return this.vehiclesLoadPromise;
  }

  // Load categories from backend API
  loadCategories(): void {
    this.isLoadingCategories = true;
    this.categoriesError = null;

    const cacheKey = 'categoriesCache';
    const cacheTTL = 1000 * 60 * 60 * 24; // 24 hours

    // Try to load from cache first to ensure categories persist across reloads
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.categories && parsed.timestamp) {
          const age = Date.now() - parsed.timestamp;
          if (age < cacheTTL) {
            this.categories = parsed.categories as Category[];
            this.isLoadingCategories = false;
            // Scroll to categories section after loading cached data
            setTimeout(() => {
              if (this.categoriesGrid) {
                this.categoriesGrid.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }, 100);
          } else {
            // Cache expired
            localStorage.removeItem(cacheKey);
          }
        }
      }
    } catch (e) {
      // If cache is corrupt, remove it and continue
      localStorage.removeItem(cacheKey);
    }

    // Always attempt to refresh from API and update cache; if network fails, keep cached data if present
    this.categoryService.getCategories().subscribe({
      next: (categories: Category[]) => {
        this.categories = categories;
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ categories, timestamp: Date.now() }));
        } catch (e) {
          // Storage might be full or blocked; ignore and proceed
          console.warn('Could not persist categories to localStorage', e);
        }

        this.isLoadingCategories = false;

        // Scroll to categories section after fresh load
        setTimeout(() => {
          if (this.categoriesGrid) {
            this.categoriesGrid.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      },
      error: (error: any) => {
        console.error('Error loading categories:', error);
        if (!this.categories || this.categories.length === 0) {
          // Only show error when no cached categories available
          this.categoriesError = 'Failed to load service categories. Please try again.';
        }
        this.isLoadingCategories = false;
      }
    });
  }

  // Select category
  selectCategory(category: Category): void {
    this.selectedCategory = category;
    this.selectedSubcategory = null;
    console.log('Selected category:', category);
    // Switch to subcategories view and load subcategories
    this.showingSubcategories = true;
    // persist provisional selection (will be updated when subcategories load)
    this.persistSubcategoryState();
    // Ensure view updates immediately to show loading state
    try { this.cdr.detectChanges(); } catch (e) { /* ignore */ }
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
        'Electrical': '/Assets/images/Electrical.jpg',
        'AC & Cooling': '/Assets/images/Ac-Cooling.jpg',
        'Body & Paint': '/Assets/images/Body-Paint.jpg',
        'Tires': '/Assets/images/Tires.jpg'
    };
    return localMap[category.name] || null;
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

        // Persist the loaded subcategories and selection so they survive reload
        this.persistSubcategoryState();

        // Scroll to subcategories section after loading
        setTimeout(() => {
          const element = document.querySelector('.subcategories-section');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
        // Force change detection to ensure template updates immediately
        try { this.cdr.detectChanges(); } catch (e) { /* ignore */ }
      },
      error: (error: any) => {
        console.error('Error loading subcategories:', error);
        this.subcategoriesError = 'Failed to load service options. Please try again.';
        this.isLoadingSubcategories = false;
        try { this.cdr.detectChanges(); } catch (e) { /* ignore */ }
      }
    });
  }

  // Select subcategory - now loads services for this subcategory
  selectSubcategory(subcategory: Subcategory): void {
    this.selectedSubcategory = subcategory;
    this.selectedService = null;
    console.log('Selected subcategory:', subcategory);
    // Switch to services view and load services
    this.showingServices = true;
    // Persist state
    this.persistServiceState();
    // Ensure view updates immediately to show loading state
    try { this.cdr.detectChanges(); } catch (e) { /* ignore */ }
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

        // Persist the loaded services and selection so they survive reload
        this.persistServiceState();

        // Scroll to services section after loading
        setTimeout(() => {
          const element = document.querySelector('.services-section');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
        // Force change detection to ensure template updates immediately
        try { this.cdr.detectChanges(); } catch (e) { /* ignore */ }
      },
      error: (error: any) => {
        console.error('Error loading services:', error);
        this.servicesError = 'Failed to load services. Please try again.';
        this.isLoadingServices = false;
        try { this.cdr.detectChanges(); } catch (e) { /* ignore */ }
      }
    });
  }

  // Select service (only one can be selected)
  selectService(service: Service): void {
    this.selectedService = service;
    console.log('Selected service:', service);
    // Persist the selection
    this.persistServiceState();
  }

  // Back to subcategories view
  backToSubcategories(): void {
    this.showingServices = false;
    this.selectedService = null;
    this.services = [];
    // Clear persisted service state when user navigates back
    this.clearServiceState();
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
    // Clear persisted subcategory and service state when user navigates back
    this.clearSubcategoryState();
    this.clearServiceState();
  }

  /**
   * Persistence helpers for selected category / subcategories so the UI
   * remains in the same state after a full page reload.
   */
  private getSubcategoryStorageKey(): string {
    return 'booking_subcategory_state_v1';
  }

  private persistSubcategoryState(): void {
    try {
      const payload = {
        showingSubcategories: this.showingSubcategories,
        selectedCategory: this.selectedCategory,
        subcategories: this.subcategories,
        selectedSubcategory: this.selectedSubcategory,
        timestamp: Date.now()
      };
      localStorage.setItem(this.getSubcategoryStorageKey(), JSON.stringify(payload));
    } catch (e) {
      console.warn('Could not persist subcategory state', e);
    }
  }

  private clearSubcategoryState(): void {
    try {
      localStorage.removeItem(this.getSubcategoryStorageKey());
    } catch (e) {
      console.warn('Could not clear persisted subcategory state', e);
    }
  }

  private restoreSubcategoryState(): void {
    try {
      const raw = localStorage.getItem(this.getSubcategoryStorageKey());
      if (!raw) return;
      const parsed = JSON.parse(raw);
      // Basic validation
      if (!parsed || typeof parsed !== 'object') return;

      // If a saved state indicates subcategories were showing, restore them.
      if (parsed.showingSubcategories) {
        this.showingSubcategories = true;
        this.selectedCategory = parsed.selectedCategory || null;
        this.subcategories = parsed.subcategories || [];
        this.selectedSubcategory = parsed.selectedSubcategory || null;
        this.isLoadingSubcategories = false;

        // If we have a selectedCategory but no subcategories array (or empty), attempt to reload
        if (this.selectedCategory && (!this.subcategories || this.subcategories.length === 0)) {
          // Try to reload subcategories from API to ensure fresh data
          this.loadSubcategories(this.selectedCategory.id);
        }
        // Scroll to subcategories section after next tick
        setTimeout(() => {
          const el = document.querySelector('.subcategories-section');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 150);

        // Also try to restore service state if it exists
        this.restoreServiceState();
      }
    } catch (e) {
      console.warn('Could not restore persisted subcategory state', e);
    }
  }

  /**
   * Persistence helpers for selected subcategory / services so the UI
   * remains in the same state after a full page reload.
   */
  private getServiceStorageKey(): string {
    return 'booking_service_state_v1';
  }

  private persistServiceState(): void {
    try {
      const payload = {
        showingServices: this.showingServices,
        selectedSubcategory: this.selectedSubcategory,
        services: this.services,
        selectedService: this.selectedService,
        timestamp: Date.now()
      };
      localStorage.setItem(this.getServiceStorageKey(), JSON.stringify(payload));
    } catch (e) {
      console.warn('Could not persist service state', e);
    }
  }

  private clearServiceState(): void {
    try {
      localStorage.removeItem(this.getServiceStorageKey());
    } catch (e) {
      console.warn('Could not clear persisted service state', e);
    }
  }

  private restoreServiceState(): void {
    try {
      const raw = localStorage.getItem(this.getServiceStorageKey());
      if (!raw) return;
      const parsed = JSON.parse(raw);
      // Basic validation
      if (!parsed || typeof parsed !== 'object') return;

      // If a saved state indicates services were showing, restore them.
      if (parsed.showingServices) {
        this.showingServices = true;
        this.selectedSubcategory = parsed.selectedSubcategory || this.selectedSubcategory;
        this.services = parsed.services || [];
        this.selectedService = parsed.selectedService || null;
        this.isLoadingServices = false;

        // If we have a selectedSubcategory but no services array (or empty), attempt to reload
        if (this.selectedSubcategory && (!this.services || this.services.length === 0)) {
          // Try to reload services from API to ensure fresh data
          this.loadServices(this.selectedSubcategory.id);
        }
        // Scroll to services section after next tick
        setTimeout(() => {
          const el = document.querySelector('.services-section');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 150);
      }
    } catch (e) {
      console.warn('Could not restore persisted service state', e);
    }
  }

  // Step navigation
  nextStep(): void {
    // Show payment popup after workshop selection (step 3)
    if (this.currentStep === 3 && this.isStep3Valid()) {
      this.showPaymentPopup = true;
      return;
    }
    
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
      this.saveDraft();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      // Load workshops when entering step 3
      if (this.currentStep === 3) {
        this.loadWorkshops();
      }
    }
  }

  previousStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  goToStep(step: number): void {
    if (step <= this.currentStep) {
      this.currentStep = step;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      // Load workshops when navigating to step 3
      if (step === 3) {
        this.loadWorkshops();
      }
    }
  }

  // Step validation
  isStep1Valid(): boolean {
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
    // Persist selected vehicle id so selection survives reloads/navigation
    try {
      localStorage.setItem('booking_selected_vehicle_id', String(vehicle.id));
    } catch (e) {
      // ignore storage errors
    }
    // Detect and persist vehicle origin
    this.detectAndPersistVehicleOrigin(vehicle);
    // Update saved draft as well
    try { this.saveDraft(); } catch (e) { /* ignore */ }
  }

  /**
   * Detect vehicle origin from the vehicle object or fallback to cars-data.json lookup.
   * Sets selectedVehicleOrigin and persists to localStorage.
   */
  private detectAndPersistVehicleOrigin(vehicle: Vehicle): void {
    // Try to detect origin from vehicle fields first
    const directOrigin = vehicle.origin || vehicle.country || vehicle.CarOrigin;
    if (directOrigin && directOrigin.trim() !== '') {
      this.selectedVehicleOrigin = directOrigin.trim();
      this.persistVehicleOrigin(this.selectedVehicleOrigin);
      console.log('Vehicle origin detected from vehicle fields:', this.selectedVehicleOrigin);
      return;
    }

    // Fallback: lookup make in cars-data.json
    this.carsService.getAllMakesAndModels().subscribe({
      next: (makesData: MakeModels[]) => {
        const makeLower = vehicle.make?.toLowerCase() || '';
        const match = makesData.find(m => m.make.toLowerCase() === makeLower);
        if (match && match.CarOrigin) {
          this.selectedVehicleOrigin = match.CarOrigin;
          console.log('Vehicle origin detected from cars-data.json:', this.selectedVehicleOrigin);
        } else {
          // Default to 'General' if no match found
          this.selectedVehicleOrigin = 'General';
          console.log('Vehicle origin not found, defaulting to General');
        }
        this.persistVehicleOrigin(this.selectedVehicleOrigin);
      },
      error: (err) => {
        console.warn('Could not load cars-data.json for origin lookup, defaulting to General', err);
        this.selectedVehicleOrigin = 'General';
        this.persistVehicleOrigin(this.selectedVehicleOrigin);
      }
    });
  }

  /**
   * Persist vehicle origin to localStorage
   */
  private persistVehicleOrigin(origin: string): void {
    try {
      localStorage.setItem('booking_selected_vehicle_origin', origin);
    } catch (e) {
      console.warn('Could not persist vehicle origin', e);
    }
  }

  /**
   * Restore vehicle origin from localStorage
   */
  private restoreVehicleOrigin(): void {
    try {
      const stored = localStorage.getItem('booking_selected_vehicle_origin');
      if (stored && stored.trim() !== '') {
        this.selectedVehicleOrigin = stored.trim();
        console.log('Restored vehicle origin from localStorage:', this.selectedVehicleOrigin);
      }
    } catch (e) {
      console.warn('Could not restore vehicle origin', e);
    }
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
        console.log('Combined DateTime (Cairo):', new Date(combinedDateTime).toLocaleString('en-US', { timeZone: this.CAIRO_TIMEZONE }));
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
      day: 'numeric' 
    };
    return date.toLocaleDateString('en-US', options);
  }

  formatDateLong(date: Date): string {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
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
      return;
    }

    if (!this.selectedDate || !this.selectedTimeSlot) {
      console.warn('Cannot load workshops: date or time not selected');
      this.workshopsError = 'Please select a date and time first';
      return;
    }

    this.isLoadingWorkshops = true;
    this.workshopsError = null;
    this.workshops = [];

    const serviceId = this.selectedService.id;
    const origin = this.selectedVehicleOrigin || 'General';
    
    // Format appointment date for the API: "YYYY-MM-DD HH:mm:ss.0000000"
    const appointmentDate = this.formatAppointmentDateForApi();

    console.log('Loading workshops for serviceId:', serviceId, 'origin:', origin, 'appointmentDate:', appointmentDate);

    this.workshopProfileService.searchWorkshopsByServiceAndOrigin(serviceId, origin, appointmentDate, {
      pageNumber: 1,
      pageSize: 10
    }).subscribe({
      next: (response: any) => {
        console.log('Workshops search response:', response);
        
        // Handle the new response structure: { success, message, data: { items, pageNumber, ... } }
        if (response?.success && response?.data?.items && Array.isArray(response.data.items)) {
          this.workshops = response.data.items.map((w: any, index: number) => this.mapApiWorkshopToInterface(w, index));
        } else if (response?.data && Array.isArray(response.data)) {
          // Fallback: data is directly an array
          this.workshops = response.data.map((w: any, index: number) => this.mapApiWorkshopToInterface(w, index));
        } else if (Array.isArray(response)) {
          // Fallback: response is directly an array
          this.workshops = response.map((w: any, index: number) => this.mapApiWorkshopToInterface(w, index));
        } else {
          this.workshops = [];
        }

        this.isLoadingWorkshops = false;
        console.log('Mapped workshops:', this.workshops);

        if (this.workshops.length === 0) {
          this.workshopsError = 'No workshops found for the selected service and vehicle origin. Try a different service or check back later.';
        }

        try { this.cdr.detectChanges(); } catch (e) { /* ignore */ }
      },
      error: (error: any) => {
        console.error('Error loading workshops:', error);
        this.workshopsError = 'Failed to load workshops. Please try again.';
        this.isLoadingWorkshops = false;
        try { this.cdr.detectChanges(); } catch (e) { /* ignore */ }
      }
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
    const workshopId = apiWorkshop.workshopId || apiWorkshop.workshopProfileId || apiWorkshop.id || index;
    
    // Build address from available location fields
    const addressParts = [
      apiWorkshop.city,
      apiWorkshop.governorate,
      apiWorkshop.country
    ].filter(Boolean);
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
      workshopServiceID: apiWorkshop.workshopServiceID,  // This is the ID needed for booking
      serviceName: apiWorkshop.serviceName,
      serviceDescription: apiWorkshop.serviceDescription || '',
      price: apiWorkshop.price,
      minPrice: apiWorkshop.minPrice,
      maxPrice: apiWorkshop.maxPrice,
      logoUrl: apiWorkshop.logoImageUrl || apiWorkshop.LogoImageUrl || apiWorkshop.logoUrl || apiWorkshop.logo,
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
      isClosed: apiWorkshop.isClosed
    };
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

  // Draft management
  saveDraft(): void {
    if (this.currentStep === 5) return; // Don't save after confirmation
    
    const draft: BookingDraft = {
      step: this.currentStep,
      vehicleId: this.selectedVehicle?.id || null,
      categoryId: this.selectedCategory?.id || null,
      serviceNotes: this.serviceNotes,
      selectedDate: this.selectedDate?.toISOString() || null,
      selectedTimeSlot: this.selectedTimeSlot,
      workshopIds: this.selectedWorkshop ? [this.selectedWorkshop.id] : [],
      paymentMethod: this.selectedPaymentMethod,
      timestamp: Date.now()
    };
    
    localStorage.setItem('bookingDraft', JSON.stringify(draft));
  }

  checkForSavedDraft(): void {
    const savedDraft = localStorage.getItem('bookingDraft');
    
    if (savedDraft) {
      const draft: BookingDraft = JSON.parse(savedDraft);
      
      // Check if draft is less than 24 hours old
      const hoursSinceSave = (Date.now() - draft.timestamp) / (1000 * 60 * 60);
      
      if (hoursSinceSave < 24) {
        this.hasSavedDraft = true;
        this.showDraftBanner = true;
      } else {
        localStorage.removeItem('bookingDraft');
      }
    }
  }

  resumeDraft(): void {
    const savedDraft = localStorage.getItem('bookingDraft');
    
    if (savedDraft) {
      const draft: BookingDraft = JSON.parse(savedDraft);
      
      // Restore state
      this.currentStep = draft.step;
      this.serviceNotes = draft.serviceNotes;
      
      // Restore vehicle
      if (draft.vehicleId) {
        const vehicle = this.userVehicles.find(v => v.id === draft.vehicleId);
        if (vehicle) this.selectedVehicle = vehicle;
      }
      
      // Restore category
      if (draft.categoryId) {
        const category = this.categories.find(c => c.id === draft.categoryId);
        if (category) this.selectedCategory = category;
      }
      
      // Restore date
      if (draft.selectedDate) {
        this.selectedDate = new Date(draft.selectedDate);
      }
      
      // Restore time slot
      this.selectedTimeSlot = draft.selectedTimeSlot;
      
      // Restore workshop
      if (draft.workshopIds && draft.workshopIds.length > 0) {
        this.selectedWorkshop = this.workshops.find(w => draft.workshopIds.includes(w.id)) || null;
      }
      
      // Restore payment method
      this.selectedPaymentMethod = draft.paymentMethod || null;
      
      this.showDraftBanner = false;
    }
  }

  dismissDraft(): void {
    localStorage.removeItem('bookingDraft');
    this.hasSavedDraft = false;
    this.showDraftBanner = false;
  }

  // Booking submission
  confirmBooking(): void {
    // Validate required fields
    if (!this.selectedVehicle) {
      this.bookingError = 'Please select a vehicle';
      return;
    }
    if (!this.selectedWorkshop) {
      this.bookingError = 'Please select a workshop';
      return;
    }
    if (!this.selectedService && !this.selectedWorkshop.serviceId) {
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
    const workshopServiceId = this.selectedWorkshop.workshopServiceID || this.selectedWorkshop.serviceId || 0;
    const workshopProfileId = this.selectedWorkshop.workshopProfileId || this.selectedWorkshop.id;
    
    console.log('Workshop Service ID:', workshopServiceId);
    console.log('Workshop Profile ID:', workshopProfileId);

    // Map payment method to backend enum: Cash, CreditCard
    const paymentMethodMap: { [key: string]: string } = {
      'cash': 'Cash',
      'credit_card': 'CreditCard',
      'credit-card': 'CreditCard',
      'creditcard': 'CreditCard',
      'card': 'CreditCard',
      'credit': 'CreditCard'
    };
    const apiPaymentMethod = paymentMethodMap[this.selectedPaymentMethod.toLowerCase()];
    
    if (!apiPaymentMethod) {
      this.bookingError = 'Invalid payment method selected';
      this.isSubmittingBooking = false;
      return;
    }

    // Prepare booking data for backend API
    const bookingData = {
      AppointmentDate: bookingDateTime,
      IssueDescription: this.serviceNotes || '',
      PaymentMethod: apiPaymentMethod,
      CarId: this.selectedVehicle.id,
      WorkShopProfileId: workshopProfileId,
      WorkshopServiceId: workshopServiceId,
      Photos: [] as string[]
    };

    console.log('=== BOOKING DATA FOR BACKEND ===');
    console.log('Booking DateTime (ISO):', bookingDateTime);
    console.log('Booking DateTime (Cairo):', new Date(bookingDateTime).toLocaleString('en-US', { 
      timeZone: this.CAIRO_TIMEZONE,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }));
    console.log('Full booking data:', bookingData);

    // Send to backend API
    this.bookingService.createBooking(bookingData).subscribe({
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
          this.currentStep = 5;
          this.bookingConfirmed = true;
          localStorage.removeItem('bookingDraft');
          window.scrollTo({ top: 0, behavior: 'smooth' });
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
      }
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
    
    // Clear persisted states
    this.clearSubcategoryState();
    this.clearServiceState();
    this.clearVehicleOrigin();
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * Clear persisted vehicle origin from localStorage
   */
  private clearVehicleOrigin(): void {
    try {
      localStorage.removeItem('booking_selected_vehicle_origin');
      localStorage.removeItem('booking_selected_vehicle_id');
    } catch (e) {
      console.warn('Could not clear persisted vehicle data', e);
    }
  }

  goToMyVehicles(): void {
    this.router.navigate(['/my-vehicles']);
  }
  
  // Payment method popup handlers
  onPaymentMethodSelected(method: string): void {
    this.selectedPaymentMethod = method;
    this.showPaymentPopup = false;
    console.log('Payment method selected:', method);
    
    // Proceed to next step (review)
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
      this.saveDraft();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
  
  closePaymentPopup(): void {
    this.showPaymentPopup = false;
  }
}
