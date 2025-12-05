import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AddVehicleFormComponent } from '../add-vehicle-form/add-vehicle-form.component';
import { ConfirmationPopupComponent } from '../shared/confirmation-popup/confirmation-popup.component';
import { Router, RouterLink } from '@angular/router';
import { CarsService } from '../../services/cars.service';
import { CarExpenseService, CreateCarExpenseRequest, ExpenseType } from '../../services/car-expense.service';
import { BookingService } from '../../services/booking.service';
import { forkJoin } from 'rxjs';

interface Vehicle {
  id: number;
  year: number;
  make: string;
  model: string;
  licensePlate: string;
  currentMileage: number;
  engineCapacity?: number;
  maintenanceItems?: MaintenanceItem[];
  dashboardIndicators?: Array<{ label: string; icon: string; status?: string }>;
  isDefault?: boolean;
}

interface MaintenanceItem {
  name: string;
  remainingKm: number;
  icon: string;
  color: string;
}

interface Expense {
  id?: number;
  name: string;
  date: string;
  amount: number;
  icon: string;
  carId: number | null;
  receipt?: string;
}

interface Tip {
  id: number;
  title: string;
  excerpt: string;
  category: string;
  icon: string;
  timeAgo: string;
  readTime: number;
  content: string;
}

interface UpcomingBooking {
  id: number;
  carId: number;
  vehicleLabel: string;
  serviceName: string;
  appointmentDate: Date;
  status: string;
  urgency: 'Urgent' | 'Scheduled';
  daysUntil: number;
  workshopId?: number;
  workshopServiceId?: number;
  createdAt?: Date;
}

interface NewExpenseForm {
  expenseType: ExpenseType | '';
  expenseDate: string; // yyyy-MM-dd
  amount: number | null;
  description: string;
  carId: number | null;
  icon: string;
}

@Component({
  selector: 'app-my-vehicles',
  standalone: true,
  imports: [CommonModule, FormsModule, AddVehicleFormComponent, RouterLink, ConfirmationPopupComponent],
  templateUrl: './my-vehicles.component.html',
  styleUrls: ['./my-vehicles.component.css']
})
export class MyVehiclesComponent implements OnInit, OnDestroy {
  vehicles: Vehicle[] = [];
  isAddVehicleModalOpen = false;
  selectedVehicleId: number | null = null;
  carOwnerProfile: any = null;
  profileName: string = 'Car Owner';
  profilePicture: string = 'Assets/images/default-profile.svg';
  // Deletion modal state
  showDeleteConfirm = false;
  carToDelete: Vehicle | null = null;
  isDeleting = false;
  // Track deleting expense ids to disable buttons while request is in-flight
  deletingExpenseIds: Set<number> = new Set<number>();
  // Expense state
  expenses: Expense[] = [];
  selectedCarId: number | null = null; // null means 'Show All'
  loadingExpenses = false;
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
    icon: '⛽'
  };
  expenseTypes: ExpenseType[] = ['Fuel', 'Maintenance', 'Repair', 'Insurance', 'Other'];
  welcomeMessage: string = '';
  aiInputText: string = '';
  tips: Tip[] = [
    {
      id: 1,
      title: 'Winter Tire Safety: When to Switch',
      excerpt: 'Learn the optimal time to switch to winter tires and how they can significantly improve your vehicle\'s safety during cold months.',
      category: 'Seasonal',
      icon: '❄️',
      timeAgo: '2 hours ago',
      readTime: 4,
      content: 'Full article content here...'
    },
    {
      id: 2,
      title: 'Top 5 Fuel-Saving Driving Habits',
      excerpt: 'Discover proven techniques to reduce fuel consumption and save money on every trip.',
      category: 'Fuel',
      icon: '⛽',
      timeAgo: '1 day ago',
      readTime: 3,
      content: 'Full article content here...'
    },
    {
      id: 3,
      title: 'Essential Oil Change Intervals',
      excerpt: 'Understanding when to change your oil can extend engine life and prevent costly repairs.',
      category: 'Maintenance',
      icon: '🔧',
      timeAgo: '3 days ago',
      readTime: 5,
      content: 'Full article content here...'
    }
  ];

  // Upcoming bookings for all vehicles
  upcomingBookings: UpcomingBooking[] = [];
  loadingBookings = false;

  // Pagination and car-specific bookings
  selectedCarForBookings: number | null = null;
  allCarBookings: UpcomingBooking[] = []; // Store all bookings
  carBookings: UpcomingBooking[] = []; // Current page bookings
  currentPage = 1;
  pageSize = 5; // Frontend pagination page size
  totalBookings = 0;
  loadingCarBookings = false;
  cancellingBookingIds: Set<number> = new Set();

  // Confirmation popup state
  showCancelPopup = false;
  bookingToCancel: UpcomingBooking | null = null;

  // Timer for auto-updating cancel button visibility
  private cancelButtonUpdateInterval: any = null;

  // Track locally created bookings with their submission time
  private localBookingCreationTimes: Map<number, Date> = new Map();

  // Getter for popup message
  get cancelPopupMessage(): string {
    if (!this.bookingToCancel) return '';
    return `Are you sure you want to cancel the appointment for "${this.bookingToCancel.serviceName}" scheduled on ${this.formatDate(this.bookingToCancel.appointmentDate)}?`;
  }

  constructor(
    private router: Router,
    private carsService: CarsService,
    private cdr: ChangeDetectorRef,
    private carExpenseService: CarExpenseService,
    private bookingService: BookingService
  ) {}

  // Note: removed Escape key handler to prevent closing the Add Vehicle modal
  // via the Escape key. The modal will now only close when the user clicks
  // the explicit close button (X) in the form.

  get filteredExpenses(): Expense[] {
    if (this.selectedCarId === null) {
      return this.expenses; // Show all expenses
    }
    return this.expenses.filter(exp => exp.carId === this.selectedCarId);
  }

  onCarFilterChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const value = target.value;
    this.selectedCarId = value === '' ? null : Number(value);
  }

  ngOnInit(): void {
    this.loadLocalBookingCreationTimes();
    this.loadVehiclesFromBackend();
  }

  ngOnDestroy(): void {
    this.stopCancelButtonUpdateInterval();
  }

  /**
   * Load locally tracked booking creation times from localStorage
   */
  private loadLocalBookingCreationTimes(): void {
    try {
      const stored = localStorage.getItem('recentBookingCreationTimes');
      if (stored) {
        const data = JSON.parse(stored);
        const now = new Date();
        
        // Only load bookings created within the last 13 hours (12 hours + 1 hour buffer)
        Object.entries(data).forEach(([bookingId, timestamp]) => {
          const creationTime = new Date(timestamp as string);
          const ageHours = (now.getTime() - creationTime.getTime()) / (1000 * 60 * 60);
          
          if (ageHours <= 13) {
            this.localBookingCreationTimes.set(Number(bookingId), creationTime);
            console.log(`✅ Loaded local creation time for booking ${bookingId}:`, creationTime.toISOString());
          }
        });
        
        // Clean up old entries from localStorage
        this.cleanupOldBookingTimes();
      }
    } catch (error) {
      console.error('Error loading local booking creation times:', error);
    }
  }

  /**
   * Remove booking creation times older than 13 hours from localStorage
   */
  private cleanupOldBookingTimes(): void {
    try {
      const stored = localStorage.getItem('recentBookingCreationTimes');
      if (stored) {
        const data = JSON.parse(stored);
        const now = new Date();
        const cleaned: any = {};
        
        Object.entries(data).forEach(([bookingId, timestamp]) => {
          const creationTime = new Date(timestamp as string);
          const ageHours = (now.getTime() - creationTime.getTime()) / (1000 * 60 * 60);
          
          if (ageHours <= 13) {
            cleaned[bookingId] = timestamp;
          }
        });
        
        localStorage.setItem('recentBookingCreationTimes', JSON.stringify(cleaned));
      }
    } catch (error) {
      console.error('Error cleaning up old booking times:', error);
    }
  }

  loadVehiclesFromBackend(): void {
    this.carsService.getProfileWithCars().subscribe({
      next: (response) => {
        if (response && response.success && response.data) {
          this.carOwnerProfile = response.data;
          // Debug: Log the entire response to see available fields
          console.log('Backend response.data:', response.data);
          console.log('Available profile picture fields:', {
            profilePicture: response.data.profilePicture,
            profileImage: response.data.profileImage,
            photoUrl: response.data.photoUrl,
            imageUrl: response.data.imageUrl,
            picture: response.data.picture,
            avatar: response.data.avatar
          });
          // Extract profile information - check multiple possible field names
          this.profileName = response.data.name || response.data.firstName || 'Car Owner';
          const candidate = response.data.profileImageUrl
            || response.data.profilePicture
            || response.data.profileImage
            || response.data.photoUrl
            || response.data.imageUrl
            || response.data.picture
            || response.data.avatar;
          // Backend host used for serving uploaded files
          const backendHost = 'https://localhost:44316';
          if (candidate && typeof candidate === 'string') {
            // If the returned path is relative (starts with '/'), prefix backend host
            if (candidate.startsWith('/')) {
              this.profilePicture = backendHost + candidate;
            } else {
              this.profilePicture = candidate;
            }
          } else {
            this.profilePicture = 'Assets/images/default-profile.svg';
          }
          const rawCars = response.data.cars;
          if (Array.isArray(rawCars)) {
            // Normalize data to ensure numeric IDs and numbers for mileage/year
            this.vehicles = rawCars.map((c: any) => {
              const carId = Number(c.id);
              // Load dashboard indicators from localStorage
              const savedIndicators = localStorage.getItem(`car_${carId}_dashboard`);
              let dashboardIndicators: Array<{ label: string; icon: string; status?: string }> = [];
              if (savedIndicators) {
                try {
                  dashboardIndicators = JSON.parse(savedIndicators);
                } catch (e) {
                  console.error('Failed to parse dashboard indicators', e);
                }
              }
              return {
                id: carId,
                year: Number(c.year),
                make: c.make,
                model: c.model,
                licensePlate: c.licensePlate,
                currentMileage: Number(c.currentMileage),
                engineCapacity: c.engineCapacity ? Number(c.engineCapacity) : undefined,
                maintenanceItems: c.maintenanceItems || [],
                dashboardIndicators
              } as Vehicle;
            });
          } else {
            this.vehicles = [];
          }
          console.log('Loaded cars:', this.vehicles);
          
          // Load default vehicle preference and mark it
          this.loadDefaultVehicle();
          
          // Force change detection in case data arrives after initial render
          this.cdr.detectChanges();
          // Fetch indicator statuses from backend for all vehicles
          this.loadIndicatorStatusesForAllVehicles();
          // After vehicles are loaded, fetch all expenses for each car
          this.loadAllExpensesForOwner();
          // Load upcoming bookings for all vehicles
          this.loadUpcomingBookings();
          this.welcomeMessage = `Hello ${this.profileName}, ready to hit the road? Here are your vehicles:`;
        } else {
          console.error('Failed to load profile:', response?.message);
          this.vehicles = [];
          this.expenses = [];
          this.upcomingBookings = [];
        }
      },
      error: (err) => {
        console.error('Error loading profile with cars:', err);
        this.vehicles = [];
        this.expenses = [];
      }
    });
  }

  private loadAllExpensesForOwner(): void {
    if (!this.vehicles.length) {
      this.expenses = [];
      return;
    }
    this.loadingExpenses = true;
    const requests = this.vehicles.map(v => this.carExpenseService.getByCarId(v.id));
    forkJoin(requests).subscribe({
      next: (resultsArrays: any[]) => {
        const iconMap: Record<string,string> = {
          Fuel: '⛽',
          Maintainance: '🔧',
          Repair: '🛠️',
          Insurance: '📋',
          Other: '📌'
        };
        const merged: Expense[] = [];
        resultsArrays.forEach((arr: any[], idx: number) => {
          const carId = this.vehicles[idx].id;
          arr.forEach((dto: any) => {
            merged.push({
              id: dto.id,
              name: dto.expenseType,
              date: dto.expenseDate,
              amount: dto.amount,
              icon: iconMap[dto.expenseType] ?? '📌',
              carId: carId
            });
          });
        });
        // Sort by date desc
        merged.sort((a,b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
        this.expenses = merged;
        this.loadingExpenses = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Error loading expenses for owner:', err);
        this.loadingExpenses = false;
        this.expenses = [];
        this.cdr.detectChanges();
      }
    });
  }

  openAddVehicleModal(): void {
    this.isAddVehicleModalOpen = true;
  }

  navigateToAddVehicle(): void {
    this.router.navigate(['/add-vehicle']);
  }

  selectVehicle(vehicle: Vehicle): void {
    // toggle selection: clicking the same card will deselect
    if (this.selectedVehicleId === vehicle.id) {
      this.selectedVehicleId = null;
      this.selectedCarForBookings = null;
      this.allCarBookings = [];
      this.carBookings = [];
    } else {
      this.selectedVehicleId = vehicle.id;
      // Reset to page 1 when selecting a different car
      this.currentPage = 1;
      // Also load bookings for this car in the sidebar
      this.selectCarForBookings(vehicle.id);
    }
  }

  navigateToCarDetails(vehicle: Vehicle, event: Event): void {
    // Prevent card click handler from triggering
    event.stopPropagation();
    this.router.navigate(['/car-details', vehicle.id]);
  }

  /**
   * Handle clicks on dashboard indicators inside the vehicle card.
   * If the indicator status is 'unknown', navigate to the car details page
   * and scroll to the Vehicle Health Status section using a fragment.
   */
  onIndicatorClick(vehicle: Vehicle, indicator: { label: string; icon: string; status?: string }, event: Event): void {
    event.stopPropagation();
    try {
      const status = this.getIndicatorStatusByLabel(vehicle, indicator.label);
      // Only redirect when the indicator has a known status (good/warning/critical).
      // Do NOT redirect when status is 'unknown' or not available.
      if (status === 'good' || status === 'warning' || status === 'critical') {
        // Navigate to car-details and include fragment so the details page scrolls to the health section
        this.router.navigate(['/car-details', vehicle.id], { fragment: 'vehicle-health' });
      } else {
        // Unknown status: do not redirect. Optionally we could show a tooltip or message here.
        return;
      }
    } catch (err) {
      console.error('Error handling indicator click', err);
      this.router.navigate(['/car-details', vehicle.id]);
    }
  }
  // Open a confirmation dialog for deletion
  promptDelete(vehicle: Vehicle, event: Event): void {
    event.stopPropagation();
    this.carToDelete = vehicle;
    this.showDeleteConfirm = true;
  }

  // Perform deletion after user confirms
  deleteCarConfirmed(): void {
    if (!this.carToDelete) return;
    
    const deletedVehicleId = this.carToDelete.id;
    const wasDefault = this.carToDelete.isDefault;
    
    this.isDeleting = true;
    this.carsService.deleteCar(this.carToDelete.id).subscribe({
      next: (res) => {
        console.log('Deleted car', this.carToDelete?.id, res);
        
        // If the deleted vehicle was the default, clear the preference
        if (wasDefault) {
          const userId = this.getUserId();
          if (userId) {
            localStorage.removeItem(`defaultVehicle_user_${userId}`);
            console.log('✅ Cleared default vehicle preference after deletion');
          }
        }
        
        this.isDeleting = false;
        this.showDeleteConfirm = false;
        this.carToDelete = null;
        this.loadVehiclesFromBackend();
      },
      error: (err) => {
        console.error('Error deleting car:', err);
        this.isDeleting = false;
        // Keep modal open so user can retry or cancel
      }
    });
  }

  // Cancel deletion
  cancelDelete(): void {
    this.showDeleteConfirm = false;
    this.carToDelete = null;
    this.isDeleting = false;
  }

  closeAddVehicleModal(): void {
    this.isAddVehicleModalOpen = false;
  }

  onVehicleSaved(vehicleData: any): void {
    // Reload vehicles from backend after successful save
    this.loadVehiclesFromBackend();
  }

  getMaintenanceColor(remainingKm: number): string {
    if (remainingKm <= 1000) return 'red';
    if (remainingKm <= 3000) return 'yellow';
    return 'green';
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
      carId: null,
      icon: '⛽'
    };
  }

  closeAddExpenseModal(): void {
    this.isAddExpenseModalOpen = false;
  }

  addExpense(): void {
    this.submittedExpense = true;
    // Validate required fields
    if (!this.newExpenseForm.carId || !this.newExpenseForm.expenseType || !this.newExpenseForm.amount) {
      this.expenseMessageType = 'error';
      this.expenseMessage = 'Please select car, expense type and enter amount.';
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
      carId: Number(this.newExpenseForm.carId)
    };

    this.isSavingExpense = true;
    this.expenseMessage = '';
    this.expenseMessageType = null;

    this.carExpenseService.addExpense(payload).subscribe({
      next: (resp) => {
        this.isSavingExpense = false;
        const success = resp?.success ?? true;
        // Always show a friendly standardized message on success
        this.expenseMessageType = success ? 'success' : 'error';
        this.expenseMessage = success ? 'The expense created successfully' : (resp?.message ?? 'Failed to add expense');
        // Keep modal open until user closes with X as requested
        // Force UI update immediately (zoneless change detection environment)
        if (success) {
          // Refresh expenses for the specific car to stay in sync with backend
          if (this.newExpenseForm.carId) {
            this.carExpenseService.getByCarId(this.newExpenseForm.carId).subscribe({
              next: (arr) => {
                const iconMap: Record<string,string> = {
                  Fuel: '⛽',
                  Maintainance: '🔧',
                  Repair: '🛠️',
                  Insurance: '📋',
                  Other: '📌'
                };
                // Remove old expenses for that car
                this.expenses = this.expenses.filter(e => e.carId !== this.newExpenseForm.carId);
                // Add refreshed list
                const refreshed = arr.map(dto => ({
                  id: dto.id,
                  name: dto.expenseType,
                  date: dto.expenseDate,
                  amount: dto.amount,
                  icon: iconMap[dto.expenseType] ?? '📌',
                  carId: dto.carId
                }));
                this.expenses = [...refreshed, ...this.expenses];
                // Resort
                this.expenses.sort((a,b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
                this.cdr.detectChanges();
              },
              error: () => {
                // Fallback: append locally if refresh fails
                const fallback: Expense = {
                  id: undefined,
                  name: this.newExpenseForm.expenseType,
                  date: this.newExpenseForm.expenseDate,
                  amount: this.newExpenseForm.amount ?? 0,
                  icon: this.newExpenseForm.icon,
                  carId: this.newExpenseForm.carId
                };
                this.expenses.unshift(fallback);
                this.cdr.detectChanges();
              }
            });
          }
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isSavingExpense = false;
        const raw = err?.error ?? err;
        const msg = (raw?.message ?? 'Failed to add expense').toString();
        this.expenseMessageType = 'error';
        this.expenseMessage = msg;
        // Force UI update so the error message appears without user interaction
        this.cdr.detectChanges();
      }
    });
  }

  deleteExpense(id: number | undefined): void {
    if (!id) return;
    const numericId = Number(id);
    // optimistic UI: remove from list immediately but keep backup to rollback on error
    const backup = [...this.expenses];
    this.expenses = this.expenses.filter(e => e.id !== numericId);
    this.deletingExpenseIds.add(numericId);
    this.cdr.detectChanges();

    this.carExpenseService.deleteExpense(numericId).subscribe({
      next: () => {
        this.deletingExpenseIds.delete(numericId);
        // show a small confirmation message
        this.expenseMessageType = 'success';
        this.expenseMessage = 'Expense removed successfully.';
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to delete expense', err);
        this.deletingExpenseIds.delete(numericId);
        // rollback
        this.expenses = backup;
        this.expenseMessageType = 'error';
        this.expenseMessage = 'Failed to remove expense. Please try again.';
        this.cdr.detectChanges();
      }
    });
  }

  updateExpenseType(expenseType: ExpenseType | ''): void {
    const map: Record<string, string> = {
      Fuel: '⛽',
      Maintainance: '🔧',
      Repair: '🛠️',
      Insurance: '📋',
      Other: '📌'
    };
    if (expenseType) {
      this.newExpenseForm.icon = map[expenseType] ?? '📌';
    }
  }

  getVehicleLabel(carId: number | null | undefined): string {
    if (carId === null || carId === undefined) return 'Unknown Car';
    const v = this.vehicles.find(v => v.id === Number(carId));
    if (!v) return `Car #${carId}`;
    return `${v.year} ${v.make} ${v.model} (${v.licensePlate})`;
  }

  navigateToProfile(): void {
    this.router.navigate(['/profile']);
  }

  // Get car image URL from imagin.studio API
  getCarImageUrl(vehicle: Vehicle): string {
    const make = vehicle.make.toLowerCase().replace(/\s+/g, '');
    const model = vehicle.model.toLowerCase().replace(/\s+/g, '');
    return `https://cdn.imagin.studio/getimage?customer=hrjavascript-mastery&make=${make}&modelFamily=${model}&zoomType=fullscreen&zoomLevel=0&angle=01`;
  }

  // Get car logo URL from carlogos.org
  getCarLogoUrl(vehicle: Vehicle): string {
    const make = vehicle.make.toLowerCase().replace(/\s+/g, '-');
    return `https://www.carlogos.org/car-logos/${make}-logo.png`;
  }

  // Handle image loading error
  handleImageError(event: any): void {
    event.target.src = '/Assets/images/Generic-Car2.jpg';
  }

  // Handle logo loading error
  handleLogoError(event: any): void {
    event.target.style.display = 'none';
  }

  // Navigate to booking page
  navigateToBooking(): void {
    this.router.navigate(['/booking']);
  }

  // Book service for specific vehicle
  bookService(vehicle: Vehicle, event: Event): void {
    event.stopPropagation();
    // Navigate to booking with vehicle pre-selected
    this.router.navigate(['/booking'], { queryParams: { vehicleId: vehicle.id } });
  }

  // Get indicator status from maintenance items
  getIndicatorStatus(vehicle: Vehicle, indicatorType: string): 'good' | 'warning' | 'critical' {
    if (!vehicle.maintenanceItems || vehicle.maintenanceItems.length === 0) return 'good';

    const indicatorMap: Record<string, string[]> = {
      'oil': ['Oil Change', 'Engine Oil', 'Oil'],
      'tires': ['Tire Rotation', 'Tires', 'Tire'],
      'battery': ['Battery', 'Battery Check'],
      'brakes': ['Brake Pads', 'Brakes', 'Brake Fluid', 'Brake']
    };

    const matchingItems = vehicle.maintenanceItems.filter(item =>
      indicatorMap[indicatorType]?.some(name => item.name.toLowerCase().includes(name.toLowerCase()))
    );

    if (matchingItems.length === 0) return 'good';

    const minKm = Math.min(...matchingItems.map(item => item.remainingKm));

    if (minKm <= 1000) return 'critical';
    if (minKm <= 3000) return 'warning';
    return 'good';
  }

  // Get indicator label
  getIndicatorLabel(vehicle: Vehicle, indicatorType: string): string {
    const status = this.getIndicatorStatus(vehicle, indicatorType);

    if (status === 'critical') return 'Service Now';
    if (status === 'warning') return 'Service Soon';
    return 'Good';
  }

  // Load indicator statuses from backend for all vehicles
  private loadIndicatorStatusesForAllVehicles(): void {
    if (!this.vehicles.length) return;

    this.vehicles.forEach(vehicle => {
      if (!vehicle.dashboardIndicators || vehicle.dashboardIndicators.length === 0) return;

      this.carsService.getCarIndicators(vehicle.id).subscribe({
        next: (indicators) => {
          console.log(`Loaded indicators for car ${vehicle.id}:`, indicators);
          // Map backend indicators to dashboard indicators
          if (vehicle.dashboardIndicators) {
            vehicle.dashboardIndicators = vehicle.dashboardIndicators.map(dashIndicator => {
              // Find matching backend indicator by type
              const backendIndicator = indicators.find(ind =>
                this.matchIndicatorType(ind.indicatorType, dashIndicator.label)
              );

              if (backendIndicator) {
                console.log(`Matched ${dashIndicator.label} with backend status: ${backendIndicator.carStatus}`);
                return {
                  ...dashIndicator,
                  status: backendIndicator.carStatus
                };
              } else {
                console.log(`No match found for ${dashIndicator.label} - marking as Unknown`);
                return {
                  ...dashIndicator,
                  status: 'Unknown'
                };
              }
            });
          }
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error(`Failed to load indicators for car ${vehicle.id}:`, err);
        }
      });
    });
  }

  // Helper to match indicator types
  private matchIndicatorType(backendType: string, dashboardLabel: string): boolean {
    // Normalize both strings by removing spaces, underscores, hyphens and converting to lowercase
    const normalizedBackend = backendType.toLowerCase().replace(/[\s-_]/g, '');
    const normalizedLabel = dashboardLabel.toLowerCase().replace(/[\s-_&]/g, '');

    // Direct match
    if (normalizedBackend === normalizedLabel) return true;

    // Map dashboard labels to backend indicator types
    const labelToBackendType: Record<string, string[]> = {
      'acservice': ['acservice'],
      'licenseinsuranceexpiry': ['carlicenseandensuranceexpiry', 'carlicenseandensuanceexpiry', 'carlicenseandinsuranceexpiry'],
      'generalmaintenance': ['generalmaintenance', 'maintenance'],
      'oilchange': ['oilchange', 'oil'],
      'batteryhealth': ['batteryhealth', 'battery'],
      'tirechange': ['tirechange', 'tire', 'tires']
    };

    // Check if normalized label maps to any backend type
    const mappedTypes = labelToBackendType[normalizedLabel];
    if (mappedTypes && mappedTypes.some(type => normalizedBackend === type || normalizedBackend.includes(type) || type.includes(normalizedBackend))) {
      return true;
    }

    // Fallback: check if one contains the other
    return normalizedBackend.includes(normalizedLabel) || normalizedLabel.includes(normalizedBackend);
  }

  // Get indicator status by label (for dynamic dashboard indicators)
  getIndicatorStatusByLabel(vehicle: Vehicle, indicatorLabel: string): 'good' | 'warning' | 'critical' | 'unknown' {
    // First check if we have status from backend
    if (vehicle.dashboardIndicators) {
      const indicator = vehicle.dashboardIndicators.find(ind => ind.label === indicatorLabel);
      if (indicator?.status) {
        const status = indicator.status.toLowerCase();
        if (status === 'critical') return 'critical';
        if (status === 'warning') return 'warning';
        if (status === 'normal' || status === 'good') return 'good';
        if (status === 'unknown') return 'unknown';
        return 'good'; // Default to good for any other status
      }
    }

    // Fallback to local calculation if backend status not available
    const labelToType: Record<string, string> = {
      'AC Service': 'ac',
      'License & Insurance Expiry': 'license',
      'General Maintenance': 'maintenance',
      'Oil Change': 'oil',
      'Battery Health': 'battery',
      'Tire Change': 'tires'
    };

    const indicatorType = labelToType[indicatorLabel] || indicatorLabel.toLowerCase();
    return this.getIndicatorStatus(vehicle, indicatorType);
  }

  // Get indicator label by name (for dynamic dashboard indicators)
  getIndicatorLabelByName(vehicle: Vehicle, indicatorLabel: string): string {
    const status = this.getIndicatorStatusByLabel(vehicle, indicatorLabel);

    if (status === 'critical') return 'Critical';
    if (status === 'warning') return 'Warning';
    if (status === 'unknown') return 'Unknown';
    return 'Good';
  }

  // AI Assistant Methods
  handleAIPrompt(action: string): void {
    console.log('AI Assistant action:', action);

    switch(action) {
      case 'maintenance':
        // Navigate to booking page
        this.navigateToBooking();
        break;
      case 'tips':
        // Show AI tips (placeholder for future implementation)
        this.aiInputText = 'Give me maintenance tips for my vehicles';
        break;
      case 'diagnostics':
        // Show diagnostics (placeholder for future implementation)
        this.aiInputText = 'Check diagnostics for all vehicles';
        break;
      case 'history':
        // Show history (placeholder for future implementation)
        this.aiInputText = 'Show me maintenance history';
        break;
    }
  }

  sendAIMessage(): void {
    if (!this.aiInputText.trim()) return;

    console.log('AI message sent:', this.aiInputText);

    // Placeholder for AI integration
    // In production, this would call an AI service endpoint

    // For now, just clear the input
    this.aiInputText = '';
    this.cdr.detectChanges();
  }

  // Tips & News Methods
  openTipDetails(tip: Tip): void {
    console.log('Opening tip:', tip);
    // Future implementation: Navigate to tip details page or open modal
    // this.router.navigate(['/tips', tip.id]);
  }

  getIndicatorIconPath(indicatorLabel: string): string {
    console.log('My Vehicles Icon Path for:', indicatorLabel); // Debug log
    const iconMap: { [key: string]: string } = {
      // Dashboard indicator labels (from indicatorTypeConfig)
      'AC Service': 'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-7 14a5 5 0 1 1 0-10 5 5 0 0 1 0 10z',
      'License & Insurance Expiry': 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 13H9v-2h4v2zm0-4H9V9h4v2z',
      'General Maintenance': 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z',
      'Oil Change': 'M7 13v6a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-6M8 5l4-3 4 3M12 2v10',
      'Battery Health': 'M6 7h11v10H6V7zm11 5h4m-4-2h4',
      'Tire Change': 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
      // Additional maintenance indicator labels (from regular indicators)
      'Brake Fluid': 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 14v-2m2 0v2m-2-6v-2m2 0v2',
      'Engine Air Filter': 'M3 3h18v18H3V3zm0 6h18M9 9v12',
      'Coolant': 'M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z',
      'Tire Rotation': 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
      'Spark Plugs': 'M12 2v6m0 4v10M4.93 4.93l4.24 4.24m5.66 5.66l4.24 4.24M2 12h6m8 0h6M4.93 19.07l4.24-4.24m5.66-5.66l4.24-4.24',
      'Transmission Fluid': 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm0-7v4m0 6v8M8.22 8.22l2.83 2.83m5.9 5.9l2.83 2.83m-14.83 0l2.83-2.83m5.9-5.9l2.83-2.83',
      'Cabin Air Filter': 'M2 7h20v10H2V7zm0 5h20',
      'Windshield Wipers': 'M2 12l10-5 10 5m-20 5l10-5 10 5',
      'Brake Pads': 'M5 11h14v10H5V11zm7-6a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'
    };
    return iconMap[indicatorLabel] || 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z';
  }

  // Load upcoming bookings for all vehicles
  private loadUpcomingBookings(): void {
    if (!this.vehicles.length) {
      this.upcomingBookings = [];
      return;
    }

    this.loadingBookings = true;
    const requests = this.vehicles.map(v => this.bookingService.getBookingsByCar(v.id));

    forkJoin(requests).subscribe({
      next: (responses: any[]) => {
        const allBookings: UpcomingBooking[] = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        responses.forEach((response, idx) => {
          if (response?.success && response.data) {
            const carId = this.vehicles[idx].id;
            const vehicle = this.vehicles[idx];
            const vehicleLabel = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;

            // Filter only Confirmed bookings
            const confirmedBookings = response.data.filter(
              (booking: any) => booking.status === 'Confirmed'
            );

            confirmedBookings.forEach((booking: any) => {
              const appointmentDate = new Date(booking.appointmentDate);
              const timeDiff = appointmentDate.getTime() - today.getTime();
              const daysUntil = Math.ceil(timeDiff / (1000 * 3600 * 24));

              // Classify as Urgent (<= 7 days) or Scheduled (> 7 days)
              const urgency: 'Urgent' | 'Scheduled' = daysUntil <= 7 ? 'Urgent' : 'Scheduled';

              console.log('📅 Loading booking:', {
                id: booking.id,
                workshopServiceId: booking.workshopServiceId,
                createdAtRaw: booking.createdAt,
                createdAtParsed: booking.createdAt ? new Date(booking.createdAt).toISOString() : 'undefined'
              });

              const bookingObj: UpcomingBooking = {
                id: booking.id,
                carId: carId,
                vehicleLabel: vehicleLabel,
                serviceName: booking.issueDescription || 'Service Appointment',
                appointmentDate: appointmentDate,
                status: booking.status,
                urgency: urgency,
                daysUntil: daysUntil,
                workshopId: booking.workShopProfileId,
                workshopServiceId: booking.workshopServiceId,
                createdAt: booking.createdAt ? new Date(booking.createdAt) : undefined
              };

              allBookings.push(bookingObj);

              // Fetch service name if workshopServiceId exists
              if (booking.workshopServiceId) {
                this.fetchServiceName(bookingObj);
              }
            });
          }
        });

        // Sort by appointment date (nearest first)
        allBookings.sort((a, b) => a.appointmentDate.getTime() - b.appointmentDate.getTime());

        this.upcomingBookings = allBookings;
        this.loadingBookings = false;
        this.startCancelButtonUpdateInterval();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Error loading upcoming bookings:', err);
        this.loadingBookings = false;
        this.upcomingBookings = [];
        this.cdr.detectChanges();
      }
    });
  }

  // Select a car and load its bookings with pagination
  selectCarForBookings(carId: number): void {
    this.selectedCarForBookings = carId;
    this.currentPage = 1;
    this.loadCarBookings();
  }

  // Load ALL bookings for selected car (fetch all pages, paginate on frontend)
  loadCarBookings(): void {
    if (this.selectedCarForBookings === null) return;

    this.loadingCarBookings = true;
    this.allCarBookings = [];

    // Fetch all pages recursively (API max page size is 100)
    this.fetchAllBookingsRecursively(1);
  }

  private fetchAllBookingsRecursively(pageNumber: number): void {
    const url = `${this.bookingService.apiUrl}/Booking/ByCar?CarId=${this.selectedCarForBookings}&PageNumber=${pageNumber}&PageSize=100`;

    console.log(`Fetching bookings page ${pageNumber} from URL:`, url);

    this.bookingService.http.get<any>(url).subscribe({
      next: (response) => {
        console.log(`Page ${pageNumber} API response:`, response);

        try {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const vehicle = this.vehicles.find(v => v.id === this.selectedCarForBookings);
          const vehicleLabel = vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : 'Unknown Vehicle';

          // Handle different response structures
          let bookingsData: any[] = [];
          let hasMorePages = false;

          if (response?.success && response.data) {
            // Check if it's a paginated response with items
            if (response.data.items && Array.isArray(response.data.items)) {
              bookingsData = response.data.items;
              // Check if there are more pages
              const totalCount = response.data.totalCount || 0;
              hasMorePages = pageNumber * 100 < totalCount;
            }
            // Check if data is directly an array
            else if (Array.isArray(response.data)) {
              bookingsData = response.data;
              hasMorePages = bookingsData.length === 100; // If we got 100 items, there might be more
            }
            // Check if there's a single booking object
            else if (response.data && typeof response.data === 'object') {
              bookingsData = [response.data];
              hasMorePages = false;
            }
          }
          // Handle response without success wrapper
          else if (response && Array.isArray(response)) {
            bookingsData = response;
            hasMorePages = bookingsData.length === 100;
          }

          console.log(`Bookings data from page ${pageNumber}:`, bookingsData.length, 'items');

          // Process and append bookings from this page
          const processedBookings = bookingsData
            .filter((booking: any) => {
              if (!booking || !booking.id) return false;

              // Filter out past bookings (only show today and future)
              const appointmentDate = new Date(booking.appointmentDate);
              appointmentDate.setHours(0, 0, 0, 0); // Normalize to start of day
              return appointmentDate.getTime() >= today.getTime();
            })
            .map((booking: any) => {
              const appointmentDate = new Date(booking.appointmentDate);
              const timeDiff = appointmentDate.getTime() - today.getTime();
              const daysUntil = Math.ceil(timeDiff / (1000 * 3600 * 24));
              const urgency: 'Urgent' | 'Scheduled' = daysUntil <= 7 ? 'Urgent' : 'Scheduled';

              console.log('📅 Loading booking (detailed view):', {
                id: booking.id,
                workshopServiceId: booking.workshopServiceId,
                createdAtRaw: booking.createdAt,
                createdAtParsed: booking.createdAt ? new Date(booking.createdAt).toISOString() : 'undefined'
              });

              const bookingObj: UpcomingBooking = {
                id: booking.id,
                carId: this.selectedCarForBookings!,
                vehicleLabel: vehicleLabel,
                serviceName: booking.issueDescription || 'Service Appointment',
                appointmentDate: appointmentDate,
                status: booking.status,
                urgency: urgency,
                daysUntil: daysUntil,
                workshopId: booking.workShopProfileId,
                workshopServiceId: booking.workshopServiceId,
                createdAt: booking.createdAt ? new Date(booking.createdAt) : undefined
              };

              // Fetch service name if workshopServiceId exists
              if (booking.workshopServiceId) {
                this.fetchServiceName(bookingObj);
              }

              return bookingObj;
            });

          // Append to all bookings
          this.allCarBookings = [...this.allCarBookings, ...processedBookings];

          // If there are more pages, fetch the next one
          if (hasMorePages && bookingsData.length === 100) {
            console.log('Fetching next page...');
            this.fetchAllBookingsRecursively(pageNumber + 1);
          } else {
            // All pages loaded, finalize
            console.log('All bookings loaded. Total:', this.allCarBookings.length);

            // Sort by appointment date (nearest first)
            this.allCarBookings.sort((a, b) => a.appointmentDate.getTime() - b.appointmentDate.getTime());

            this.totalBookings = this.allCarBookings.length;

            // Update the current page view
            this.updatePageView();

            this.loadingCarBookings = false;
            this.startCancelButtonUpdateInterval();
            this.cdr.detectChanges();
          }
        } catch (error) {
          console.error('Error processing bookings response:', error);
          this.allCarBookings = [];
          this.carBookings = [];
          this.totalBookings = 0;
          this.loadingCarBookings = false;
          this.cdr.detectChanges();
        }
      },
      error: (err: any) => {
        console.error('Error loading car bookings:', err);
        console.error('Error details:', {
          status: err?.status,
          statusText: err?.statusText,
          message: err?.message,
          error: err?.error
        });
        this.loadingCarBookings = false;
        this.allCarBookings = [];
        this.carBookings = [];
        this.totalBookings = 0;
        this.cdr.detectChanges();
      }
    });
  }

  // Update the current page view (frontend pagination)
  private updatePageView(): void {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.carBookings = this.allCarBookings.slice(startIndex, endIndex);
    console.log(`Showing bookings ${startIndex + 1} to ${Math.min(endIndex, this.totalBookings)} of ${this.totalBookings}`);
  }

  // Go back to showing all cars
  backToAllCars(): void {
    this.selectedCarForBookings = null;
    this.allCarBookings = [];
    this.carBookings = [];
    this.currentPage = 1;
    this.totalBookings = 0;
    this.selectedVehicleId = null;
  }

  // Frontend pagination methods (no API call needed)
  nextPage(): void {
    if (this.hasNextPage) {
      this.currentPage++;
      this.updatePageView();
      this.cdr.detectChanges();
    }
  }

  previousPage(): void {
    if (this.hasPreviousPage) {
      this.currentPage--;
      this.updatePageView();
      this.cdr.detectChanges();
    }
  }

  get totalPages(): number {
    return Math.ceil(this.totalBookings / this.pageSize);
  }

  get hasNextPage(): boolean {
    return this.currentPage < this.totalPages;
  }

  get hasPreviousPage(): boolean {
    return this.currentPage > 1;
  }

  // Format date for display
  formatDate(date: Date): string {
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  }

  // Open cancel confirmation popup
  openCancelPopup(booking: UpcomingBooking, event: Event): void {
    event.stopPropagation();
    
    if (this.cancellingBookingIds.has(booking.id)) {
      return; // Already cancelling
    }

    // Validate time constraint before showing popup
    if (!this.canCancelBooking(booking)) {
      alert('Cancellation period has expired. Bookings can only be cancelled within 12 hours of creation.');
      return;
    }

    this.bookingToCancel = booking;
    this.showCancelPopup = true;
  }

  // Handle popup cancellation (user clicks Cancel)
  onCancelPopupClosed(): void {
    this.showCancelPopup = false;
    this.bookingToCancel = null;
  }

  // Handle popup confirmation (user clicks Delete)
  onCancelPopupConfirmed(): void {
    if (!this.bookingToCancel) return;

    const booking = this.bookingToCancel;
    
    // Final validation before API call (security measure)
    if (!this.canCancelBooking(booking)) {
      this.showCancelPopup = false;
      this.bookingToCancel = null;
      alert('Cancellation period has expired. Bookings can only be cancelled within 12 hours of creation.');
      return;
    }

    this.showCancelPopup = false;
    this.bookingToCancel = null;

    this.cancellingBookingIds.add(booking.id);
    this.cdr.detectChanges();

    const apiUrl = 'https://localhost:44316/api';
    this.bookingService.http.put(`${apiUrl}/Booking/Update-Booking-Status`, {
      id: booking.id,
      status: 'Cancelled'
    }).subscribe({
      next: (response: any) => {
        console.log('Booking cancelled successfully:', response);
        this.cancellingBookingIds.delete(booking.id);
        
        // Remove the cancelled booking from the list immediately
        this.carBookings = this.carBookings.filter(b => b.id !== booking.id);
        this.upcomingBookings = this.upcomingBookings.filter(b => b.id !== booking.id);
        this.totalBookings = Math.max(0, this.totalBookings - 1);
        
        // Send notification to the workshop about the cancellation
        this.sendCancellationNotificationToWorkshop(booking);
        
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Error cancelling booking:', err);
        this.cancellingBookingIds.delete(booking.id);
        
        // Check if error is related to time constraint
        const errorMsg = err?.error?.message || err?.message || '';
        if (errorMsg.toLowerCase().includes('time') || errorMsg.toLowerCase().includes('expired') || errorMsg.toLowerCase().includes('cancellation')) {
          alert('Cancellation period has expired. Bookings can only be cancelled within 12 hours of creation.');
        } else {
          alert('Failed to cancel booking. Please try again.');
        }
        
        this.cdr.detectChanges();
      }
    });
  }

  // Send notification to workshop when booking is cancelled
  private sendCancellationNotificationToWorkshop(booking: UpcomingBooking): void {
    if (!booking.workshopId) {
      console.warn('No workshopId found for booking, cannot send notification');
      return;
    }

    const apiUrl = 'https://localhost:44316/api';
    const notificationPayload = {
      workshopProfileId: booking.workshopId,
      bookingId: booking.id,
      title: 'Booking Cancelled',
      message: `The booking for "${booking.serviceName}" scheduled on ${this.formatDate(booking.appointmentDate)} has been cancelled by the car owner.`,
      type: 3, // NotificationType.BookingCancelled
      priority: 'high'
    };

    this.bookingService.http.post(`${apiUrl}/Notification/send`, notificationPayload).subscribe({
      next: () => {
        console.log('Cancellation notification sent to workshop successfully');
      },
      error: (err: any) => {
        console.error('Error sending cancellation notification to workshop:', err);
        // Don't block the user - notification failure shouldn't affect cancellation
      }
    });
  }

  // Get service icon based on service name
  getServiceIcon(serviceName: string): string {
    const lowerName = serviceName.toLowerCase();
    if (lowerName.includes('oil')) return 'M7 13v6a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-6M8 5l4-3 4 3M12 2v10';
    if (lowerName.includes('tire')) return 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10z';
    if (lowerName.includes('battery')) return 'M6 7h11v10H6V7zm11 5h4m-4-2h4';
    if (lowerName.includes('brake')) return 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 14v-2m2 0v2m-2-6v-2m2 0v2';
    if (lowerName.includes('filter')) return 'M3 3h18v18H3V3zm0 6h18M9 9v12';
    // Default maintenance icon
    return 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z';
  }

  /**
   * Check if a booking can be cancelled (within 12 hours of creation)
   * @param booking The booking to check
   * @returns true if booking can be cancelled, false otherwise
   */
  canCancelBooking(booking: UpcomingBooking): boolean {
    // Check if we have a local creation time (for newly created bookings)
    const localCreationTime = this.localBookingCreationTimes.get(booking.id);
    
    if (localCreationTime) {
      const now = new Date();
      const timeDiffMs = now.getTime() - localCreationTime.getTime();
      const timeDiffHours = timeDiffMs / (1000 * 60 * 60);

      console.log('🕐 Cancel eligibility check (LOCAL TIME):', {
        bookingId: booking.id,
        localCreatedAt: localCreationTime.toISOString(),
        now: now.toISOString(),
        timeDiffHours: timeDiffHours.toFixed(2),
        canCancel: timeDiffHours <= 12
      });

      return timeDiffHours <= 12;
    }

    // Fallback to server createdAt if no local time is available
    if (!booking.createdAt) {
      console.log('❌ No createdAt timestamp for booking:', booking.id);
      return false;
    }

    const now = new Date();
    const createdAt = new Date(booking.createdAt);
    const timeDiffMs = now.getTime() - createdAt.getTime();
    const timeDiffHours = timeDiffMs / (1000 * 60 * 60);

    console.log('🕐 Cancel eligibility check (SERVER TIME):', {
      bookingId: booking.id,
      createdAt: createdAt.toISOString(),
      now: now.toISOString(),
      timeDiffHours: timeDiffHours.toFixed(2),
      canCancel: timeDiffHours <= 12
    });

    return timeDiffHours <= 12;
  }

  /**
   * Start interval to update cancel button visibility every 5 minutes
   */
  private startCancelButtonUpdateInterval(): void {
    this.stopCancelButtonUpdateInterval(); // Clear any existing interval
    
    // Update every 5 minutes to reflect time-based changes (12-hour window)
    this.cancelButtonUpdateInterval = setInterval(() => {
      this.cdr.detectChanges();
    }, 5 * 60 * 1000); // 5 minutes in milliseconds
  }

  /**
   * Stop the cancel button update interval
   */
  private stopCancelButtonUpdateInterval(): void {
    if (this.cancelButtonUpdateInterval) {
      clearInterval(this.cancelButtonUpdateInterval);
      this.cancelButtonUpdateInterval = null;
    }
  }

  /**
   * Fetch service name from WorkshopService and Service APIs
   */
  private fetchServiceName(booking: UpcomingBooking): void {
    if (!booking.workshopServiceId) return;

    const apiUrl = 'https://localhost:44316/api';
    
    // First, get the workshopService to extract serviceId
    this.bookingService.http.get<any>(`${apiUrl}/WorkshopService/${booking.workshopServiceId}`).subscribe({
      next: (workshopServiceResponse) => {
        console.log('Workshop Service Response:', workshopServiceResponse);
        
        const serviceId = workshopServiceResponse?.data?.serviceId || workshopServiceResponse?.serviceId;
        
        if (serviceId) {
          // Now fetch the service name using serviceId
          this.bookingService.http.get<any>(`${apiUrl}/Service/${serviceId}`).subscribe({
            next: (serviceResponse) => {
              console.log('Service Response:', serviceResponse);
              
              const serviceName = serviceResponse?.data?.name || serviceResponse?.name;
              
              if (serviceName) {
                // Update the booking's service name
                booking.serviceName = serviceName;
                console.log(`✅ Updated booking ${booking.id} with service name: ${serviceName}`);
                this.cdr.detectChanges();
              }
            },
            error: (err) => {
              console.error(`Error fetching service name for serviceId ${serviceId}:`, err);
            }
          });
        }
      },
      error: (err) => {
        console.error(`Error fetching workshop service ${booking.workshopServiceId}:`, err);
      }
    });
  }

  /**
   * Load default vehicle preference from localStorage
   */
  private loadDefaultVehicle(): void {
    try {
      const userId = this.getUserId();
      if (!userId) return;

      const defaultVehicleId = localStorage.getItem(`defaultVehicle_user_${userId}`);
      
      if (defaultVehicleId) {
        const vehicleId = Number(defaultVehicleId);
        const vehicle = this.vehicles.find(v => v.id === vehicleId);
        
        if (vehicle) {
          vehicle.isDefault = true;
          console.log(`✅ Loaded default vehicle: ${vehicle.make} ${vehicle.model} (ID: ${vehicleId})`);
          
          // Sort vehicles so default appears first
          this.sortVehiclesByDefault();
          
          // Auto-select default vehicle to show its maintenance
          this.selectedVehicleId = vehicle.id;
        } else {
          // Vehicle no longer exists, clear the preference
          localStorage.removeItem(`defaultVehicle_user_${userId}`);
        }
      }
    } catch (error) {
      console.error('Error loading default vehicle:', error);
    }
  }

  /**
   * Sort vehicles array to show default vehicle first
   */
  private sortVehiclesByDefault(): void {
    this.vehicles.sort((a, b) => {
      // Default vehicle comes first
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      // Otherwise maintain original order (by ID)
      return a.id - b.id;
    });
  }

  /**
   * Set a vehicle as the default
   */
  setDefaultVehicle(vehicle: Vehicle, event: Event): void {
    event.stopPropagation(); // Prevent card selection
    
    try {
      const userId = this.getUserId();
      if (!userId) {
        console.error('User ID not found');
        return;
      }

      // Unset all other vehicles as default
      this.vehicles.forEach(v => v.isDefault = false);
      
      // Set this vehicle as default
      vehicle.isDefault = true;
      
      // Save to localStorage
      localStorage.setItem(`defaultVehicle_user_${userId}`, vehicle.id.toString());
      
      console.log(`✅ Set default vehicle: ${vehicle.make} ${vehicle.model} (ID: ${vehicle.id})`);
      
      // Sort vehicles so default appears first
      this.sortVehiclesByDefault();
      
      // Auto-select the default vehicle to show its maintenance
      this.selectedVehicleId = vehicle.id;
      
      // Show feedback (you can replace with a toast notification)
      this.showDefaultVehicleFeedback(vehicle);
      
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error setting default vehicle:', error);
    }
  }

  /**
   * Unset the default vehicle
   */
  unsetDefaultVehicle(vehicle: Vehicle, event: Event): void {
    event.stopPropagation(); // Prevent card selection
    
    try {
      const userId = this.getUserId();
      if (!userId) return;

      vehicle.isDefault = false;
      localStorage.removeItem(`defaultVehicle_user_${userId}`);
      
      console.log(`✅ Unset default vehicle: ${vehicle.make} ${vehicle.model}`);
      
      // Re-sort vehicles by ID since no default now
      this.sortVehiclesByDefault();
      
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error unsetting default vehicle:', error);
    }
  }

  /**
   * Get user ID from localStorage or auth service
   */
  private getUserId(): string | null {
    try {
      // Try to get user ID from localStorage (adjust key based on your auth implementation)
      const userDataStr = localStorage.getItem('userData') || localStorage.getItem('user') || localStorage.getItem('currentUser');
      if (userDataStr) {
        const userData = JSON.parse(userDataStr);
        return userData.id || userData.userId || userData.sub || null;
      }
      
      // Alternative: Get from token
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      if (token) {
        // Decode JWT token (simple decode without validation)
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.sub || payload.userId || payload.id || null;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting user ID:', error);
      return null;
    }
  }

  /**
   * Show feedback when default vehicle is changed
   */
  private showDefaultVehicleFeedback(vehicle: Vehicle): void {
    // Simple alert - you can replace with a toast notification service
    const message = `${vehicle.make} ${vehicle.model} set as default vehicle`;
    console.log(`📌 ${message}`);
    
    // Optional: Show a temporary visual feedback
    // You can implement a toast notification here if you have a toast service
  }
}
