import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AddVehicleFormComponent } from '../add-vehicle-form/add-vehicle-form.component';
import { Router } from '@angular/router';
import { CarsService } from '../../services/cars.service';
import { CarExpenseService, CreateCarExpenseRequest, ExpenseType } from '../../services/car-expense.service';
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
  dashboardIndicators?: Array<{ label: string; icon: string }>;
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
  imports: [CommonModule, FormsModule, AddVehicleFormComponent],
  templateUrl: './my-vehicles.component.html',
  styleUrls: ['./my-vehicles.component.css']
})
export class MyVehiclesComponent implements OnInit {
  vehicles: Vehicle[] = [];
  isAddVehicleModalOpen = false;
  selectedVehicleId: number | null = null;
  carOwnerProfile: any = null;
  profileName: string = 'Car Owner';
  profilePicture: string = '/Assets/default-profile.png';
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

  constructor(private router: Router, private carsService: CarsService, private cdr: ChangeDetectorRef, private carExpenseService: CarExpenseService) {}

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
    this.loadVehiclesFromBackend();
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
            this.profilePicture = '/Assets/default-profile.png';
          }
          const rawCars = response.data.cars;
          if (Array.isArray(rawCars)) {
            // Normalize data to ensure numeric IDs and numbers for mileage/year
            this.vehicles = rawCars.map((c: any) => {
              const carId = Number(c.id);
              // Load dashboard indicators from localStorage
              const savedIndicators = localStorage.getItem(`car_${carId}_dashboard`);
              let dashboardIndicators: Array<{ label: string; icon: string }> = [];
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
          // Force change detection in case data arrives after initial render
          this.cdr.detectChanges();
          // After vehicles are loaded, fetch all expenses for each car
          this.loadAllExpensesForOwner();
          this.welcomeMessage = `Hello ${this.profileName}, ready to hit the road? Here are your vehicles:`;
        } else {
          console.error('Failed to load profile:', response?.message);
          this.vehicles = [];
          this.expenses = [];
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
    } else {
      this.selectedVehicleId = vehicle.id;
    }
  }

  navigateToCarDetails(vehicle: Vehicle, event: Event): void {
    // Prevent card click handler from triggering
    event.stopPropagation();
    this.router.navigate(['/car-details', vehicle.id]);
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
    this.isDeleting = true;
    this.carsService.deleteCar(this.carToDelete.id).subscribe({
      next: (res) => {
        console.log('Deleted car', this.carToDelete?.id, res);
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
}
