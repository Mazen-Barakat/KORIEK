import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CarsService } from '../../services/cars.service';

interface Vehicle {
  id: number;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  mileage: number;
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
  distance: number;
  eta: string;
  address: string;
  phone: string;
  availability: string;
  services: string[];
  priceMultiplier: number;
}

interface BookingDraft {
  step: number;
  vehicleId: number | null;
  serviceTypeId: string | null;
  serviceNotes: string;
  selectedDate: string | null;
  selectedTimeSlot: string | null;
  workshopId: number | null;
  timestamp: number;
}

@Component({
  selector: 'app-booking',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './booking.component.html',
  styleUrls: ['./booking.component.css']
})
export class BookingComponent implements OnInit {
  // Multi-step state
  currentStep = 1;
  totalSteps = 5;
  
  // User vehicles
  userVehicles: Vehicle[] = [];
  selectedVehicle: Vehicle | null = null;
  
  // Service selection
  serviceTypes: ServiceType[] = [
    {
      id: 'oil-change',
      name: 'Oil Change',
      icon: '🛢️',
      description: 'Regular oil and filter replacement',
      estimatedDuration: '30-45 min',
      basePrice: 350
    },
    {
      id: 'tire-rotation',
      name: 'Tire Rotation',
      icon: '🔄',
      description: 'Rotate tires for even wear',
      estimatedDuration: '45-60 min',
      basePrice: 280
    },
    {
      id: 'brake-inspection',
      name: 'Brake Inspection',
      icon: '🛑',
      description: 'Full brake system check',
      estimatedDuration: '1-2 hours',
      basePrice: 450
    },
    {
      id: 'general-maintenance',
      name: 'General Maintenance',
      icon: '🔧',
      description: 'Comprehensive vehicle checkup',
      estimatedDuration: '2-3 hours',
      basePrice: 800
    },
    {
      id: 'diagnostic',
      name: 'Diagnostic Scan',
      icon: '🔍',
      description: 'Computer diagnostic test',
      estimatedDuration: '30-60 min',
      basePrice: 400
    },
    {
      id: 'ac-service',
      name: 'A/C Service',
      icon: '❄️',
      description: 'Air conditioning maintenance',
      estimatedDuration: '1-2 hours',
      basePrice: 550
    }
  ];
  selectedServiceType: ServiceType | null = null;
  serviceNotes = '';
  
  // Date & Time selection
  selectedDate: Date | null = null;
  selectedTimeSlot: string | null = null;
  availableDates: Date[] = [];
  availableTimeSlots: string[] = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00'
  ];
  unavailableSlots: string[] = ['09:00', '11:30', '14:00']; // Mock unavailable slots
  
  // Workshop selection
  workshops: Workshop[] = [
    {
      id: 1,
      name: 'Premium Auto Care',
      rating: 4.9,
      reviewCount: 487,
      distance: 2.3,
      eta: '10 min',
      address: '123 Main St, Downtown',
      phone: '+20 12 345 6789',
      availability: 'Available Today',
      services: ['Oil Change', 'Tire Service', 'Brakes', 'Diagnostics'],
      priceMultiplier: 1.15
    },
    {
      id: 2,
      name: 'Quick Fix Workshop',
      rating: 4.7,
      reviewCount: 312,
      distance: 4.1,
      eta: '15 min',
      address: '456 Industrial Rd',
      phone: '+20 12 987 6543',
      availability: 'Available Tomorrow',
      services: ['Oil Change', 'General Maintenance', 'A/C Service'],
      priceMultiplier: 0.95
    },
    {
      id: 3,
      name: 'Elite Motors Service',
      rating: 4.8,
      reviewCount: 598,
      distance: 5.7,
      eta: '20 min',
      address: '789 Highway Ave',
      phone: '+20 12 555 4321',
      availability: 'Available Today',
      services: ['Brake Inspection', 'Diagnostics', 'Tire Service'],
      priceMultiplier: 1.25
    }
  ];
  selectedWorkshop: Workshop | null = null;
  
  // Draft management
  hasSavedDraft = false;
  showDraftBanner = false;
  
  // Success state
  bookingConfirmed = false;
  confirmationNumber = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private carsService: CarsService
  ) {}

  ngOnInit(): void {
    this.initializeAvailableDates();
    this.loadUserVehicles();
    this.checkForSavedDraft();
    
    // Check for pre-selected vehicle from query params
    this.route.queryParams.subscribe(params => {
      if (params['vehicleId']) {
        const vehicleId = Number(params['vehicleId']);
        setTimeout(() => {
          const vehicle = this.userVehicles.find(v => v.id === vehicleId);
          if (vehicle) {
            this.selectedVehicle = vehicle;
          }
        }, 100);
      }
    });
  }

  // Initialize available dates (next 30 days, excluding weekends)
  initializeAvailableDates(): void {
    const today = new Date();
    this.availableDates = [];
    
    for (let i = 1; i <= 45; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      // Skip weekends (Saturday = 6, Sunday = 0)
      if (date.getDay() !== 0 && date.getDay() !== 6) {
        this.availableDates.push(date);
      }
      
      if (this.availableDates.length >= 30) break;
    }
  }

  // Load user vehicles
  loadUserVehicles(): void {
    this.carsService.getProfileWithCars().subscribe({
      next: (response: any) => {
        this.userVehicles = response.data?.cars || [];
      },
      error: (error: any) => {
        console.error('Error loading vehicles:', error);
      }
    });
  }

  // Step navigation
  nextStep(): void {
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
      this.saveDraft();
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
    }
  }

  // Step validation
  isStep1Valid(): boolean {
    return this.selectedVehicle !== null && this.selectedServiceType !== null;
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
  }

  // Service type selection
  selectServiceType(serviceType: ServiceType): void {
    this.selectedServiceType = serviceType;
  }

  // Date & Time selection
  selectDate(date: Date): void {
    this.selectedDate = date;
    this.selectedTimeSlot = null; // Reset time slot when date changes
  }

  selectTimeSlot(slot: string): void {
    this.selectedTimeSlot = slot;
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

  // Workshop selection
  selectWorkshop(workshop: Workshop): void {
    this.selectedWorkshop = workshop;
  }

  // Price calculation
  calculateTotalPrice(): number {
    if (!this.selectedServiceType || !this.selectedWorkshop) return 0;
    
    const basePrice = this.selectedServiceType.basePrice;
    const workshopMultiplier = this.selectedWorkshop.priceMultiplier;
    const subtotal = basePrice * workshopMultiplier;
    const tax = subtotal * 0.14; // 14% tax
    
    return subtotal + tax;
  }

  getSubtotal(): number {
    if (!this.selectedServiceType || !this.selectedWorkshop) return 0;
    return this.selectedServiceType.basePrice * this.selectedWorkshop.priceMultiplier;
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
      serviceTypeId: this.selectedServiceType?.id || null,
      serviceNotes: this.serviceNotes,
      selectedDate: this.selectedDate?.toISOString() || null,
      selectedTimeSlot: this.selectedTimeSlot,
      workshopId: this.selectedWorkshop?.id || null,
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
      
      // Restore service type
      if (draft.serviceTypeId) {
        const serviceType = this.serviceTypes.find(s => s.id === draft.serviceTypeId);
        if (serviceType) this.selectedServiceType = serviceType;
      }
      
      // Restore date
      if (draft.selectedDate) {
        this.selectedDate = new Date(draft.selectedDate);
      }
      
      // Restore time slot
      this.selectedTimeSlot = draft.selectedTimeSlot;
      
      // Restore workshop
      if (draft.workshopId) {
        const workshop = this.workshops.find(w => w.id === draft.workshopId);
        if (workshop) this.selectedWorkshop = workshop;
      }
      
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
    this.confirmationNumber = 'BK' + Math.random().toString(36).substring(2, 10).toUpperCase();
    this.currentStep = 5;
    this.bookingConfirmed = true;
    
    // Clear draft
    localStorage.removeItem('bookingDraft');
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  startNewBooking(): void {
    // Reset all state
    this.currentStep = 1;
    this.selectedVehicle = null;
    this.selectedServiceType = null;
    this.serviceNotes = '';
    this.selectedDate = null;
    this.selectedTimeSlot = null;
    this.selectedWorkshop = null;
    this.bookingConfirmed = false;
    this.confirmationNumber = '';
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  goToMyVehicles(): void {
    this.router.navigate(['/my-vehicles']);
  }
}
