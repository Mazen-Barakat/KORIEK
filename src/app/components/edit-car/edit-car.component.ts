import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CarsService } from '../../services/cars.service';

interface Indicator {
  id: string;
  name: string;
  icon: string;
  color: string;
  status: 'Good' | 'Attention' | 'Urgent';
  lastInspectedDate: string;
  nextInspectedDate: string;
  currentMileage: number;
  nextMileage: number;
  selected: boolean;
}

@Component({
  selector: 'app-edit-car',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './edit-car.component.html',
  styleUrls: ['./edit-car.component.css']
})
export class EditCarComponent implements OnInit {
  private carId!: number;
  private fetchedCarCore: {
    id: number;
    make: string;
    model: string;
    year: number;
    licensePlate: string;
  } | null = null;
  isSaving: boolean = false;
  message: string = '';
  messageType: 'success' | 'error' | null = null;
  carColor: string = 'Pearl White';
  engineCapacity: string = '2.0L L4 Cylinder';
  currentMileage: number = 42620;
  licensePlate: string = 'ABL 1234';
  lastMaintenanceDate: string = '10/08/2025';
  nextMaintenanceDate: string = '12/25/2025';
  nextMaintenanceMileage: number = 50000;

  // Dropdown options for the update form
  engineCapacities: string[] = [
    '800',
    '1000',
    '1000 Turbo',
    '1200',
    '1200 Turbo',
    '1300',
    '1300 Turbo',
    '1400',
    '1400 Turbo',
    '1500',
    '1500 Turbo',
    '1600',
    '1600 Turbo',
    '1800',
    '1800 Turbo',
    '2000',
    '2000 Turbo',
    '2200',
    '2200 Turbo',
    '2500',
    '2500 Turbo',
    '3000',
    '3000 Turbo',
    '3500',
    '3500 Turbo',
    '4000',
    '4000 Turbo',
    'Electric'
  ];

  transmissionTypes: string[] = ['Manual', 'Automatic', 'Semi Automatic'];
  fuelTypes: string[] = ['Gasoline', 'CNG'];

  // Model for the update form
  updateModel: {
    engineCapacity?: string;
    currentMileage?: number;
    transmissionType?: string;
    fuelType?: string;
  } = {};

  indicators: Indicator[] = [
    {
      id: 'oil-change',
      name: 'Oil Change',
      icon: '🛢️',
      color: '#10B981',
      status: 'Good',
      lastInspectedDate: '10/08/2025',
      nextInspectedDate: '11/25/2025',
      currentMileage: 0,
      nextMileage: 50000,
      selected: true
    },
    {
      id: 'tire-rotation',
      name: 'Tire Rotation',
      icon: '⚠️',
      color: '#F59E0B',
      status: 'Attention',
      lastInspectedDate: '09/10/2025',
      nextInspectedDate: '11/10/2025',
      currentMileage: 0,
      nextMileage: 45000,
      selected: true
    },
    {
      id: 'battery-health',
      name: 'Battery Health',
      icon: '🔋',
      color: '#10B981',
      status: 'Good',
      lastInspectedDate: '08/10/2025',
      nextInspectedDate: '02/10/2026',
      currentMileage: 0,
      nextMileage: 0,
      selected: true
    },
    {
      id: 'air-filter',
      name: 'Air Filter',
      icon: '⚠️',
      color: '#EF4444',
      status: 'Urgent',
      lastInspectedDate: '06/10/2025',
      nextInspectedDate: '12/10/2025',
      currentMileage: 0,
      nextMileage: 45000,
      selected: true
    }
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private carsService: CarsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Read id from route and fetch car data
    const idParam = this.route.snapshot.paramMap.get('id');
    this.carId = idParam ? Number(idParam) : NaN;

    if (!isNaN(this.carId)) {
      this.fetchCar(this.carId);
    }

    // Keep form model defined to avoid ExpressionChanged errors
    this.updateModel = {
      engineCapacity: undefined,
      currentMileage: undefined,
      transmissionType: undefined,
      fuelType: undefined
    };
  }

  private fetchCar(id: number): void {
    this.carsService.getCarById(id).subscribe({
      next: (resp: any) => {
        const car = resp && resp.data ? resp.data : resp;
        const normalized = this.normalizeCar(car);

        // Persist core fields for update payload
        this.fetchedCarCore = {
          id: Number(car?.id ?? id),
          make: String(car?.make ?? ''),
          model: String(car?.model ?? ''),
          year: Number(car?.year ?? 0),
          licensePlate: String(car?.licensePlate ?? '')
        };

        // If the backend value isn't in the list, include it so it displays
        if (normalized.engineCapacity &&
            !this.engineCapacities.includes(String(normalized.engineCapacity))) {
          this.engineCapacities = [String(normalized.engineCapacity), ...this.engineCapacities];
        }

        // Prefill the form model so values render immediately
        this.updateModel = {
          engineCapacity: normalized.engineCapacity,
          currentMileage: normalized.currentMileage,
          transmissionType: normalized.transmissionType,
          fuelType: normalized.fuelType
        };

        // Force change detection so values appear immediately without user interaction
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Failed to fetch car', err)
    });
  }

  private normalizeCar(car: any) {
    const ecRaw = car?.engineCapacity ?? car?.engineType ?? car?.engine ?? undefined;
    const engineCapacity = ecRaw != null ? String(ecRaw) : undefined;
    const currentMileage = car?.currentMileage ?? car?.mileage ?? car?.odometer ?? undefined;
    const transmissionType = car?.transmissionType ?? car?.transmission ?? undefined;
    const fuelType = car?.fuelType ?? car?.fuel ?? undefined;

    return { engineCapacity, currentMileage, transmissionType, fuelType } as {
      engineCapacity?: string;
      currentMileage?: number;
      transmissionType?: string;
      fuelType?: string;
    };
  }

  saveVehicleInfo(): void {
    // Update local values from form
    if (this.updateModel.engineCapacity) {
      this.engineCapacity = this.updateModel.engineCapacity;
    }
    if (this.updateModel.currentMileage != null) {
      this.currentMileage = Number(this.updateModel.currentMileage);
    }
    // Build full payload and call backend PUT /api/Car per spec
    if (this.fetchedCarCore) {
      this.isSaving = true;
      this.message = '';
      this.messageType = null;
      const engineStr = this.updateModel.engineCapacity ?? '';
      // Extract numeric part; if NaN (e.g., Electric), default to 0
      const engineCapacityNum = Number.parseInt(engineStr.replace(/[^0-9]/g, ''), 10);

      const payload = {
        id: this.fetchedCarCore.id,
        make: this.fetchedCarCore.make,
        model: this.fetchedCarCore.model,
        year: this.fetchedCarCore.year,
        engineCapacity: Number.isNaN(engineCapacityNum) ? 0 : engineCapacityNum,
        currentMileage: Number(this.updateModel.currentMileage ?? 0),
        licensePlate: this.fetchedCarCore.licensePlate,
        transmissionType: String(this.updateModel.transmissionType ?? 'Manual'),
        fuelType: String(this.updateModel.fuelType ?? 'Gasoline')
      };

      this.carsService.updateCarFull(payload).subscribe({
        next: (resp: any) => {
          this.isSaving = false;
          const backendMsg = this.extractMessage(resp);
          const backendSuccess = this.isBackendSuccess(resp);
          this.messageType = backendSuccess ? 'success' : 'error';
          this.message = backendMsg || (backendSuccess ? 'Car updated successfully' : 'Failed to update Car information');
          console.log('Vehicle information updated via PUT /api/Car', resp);

          // Force UI to render the message before any navigation
          this.cdr.detectChanges();

          // Redirect to my-vehicles after 2 seconds only if backend reports success
          if (backendSuccess) {
            setTimeout(() => {
              this.router.navigate(['/my-vehicles']);
            }, 2000);
          }
        },
        error: (err) => {
          this.isSaving = false;
          this.message = this.extractMessage(err.error) || this.extractMessage(err) || 'Failed to update Car information';
          this.messageType = 'error';
          console.error('Failed to update vehicle via PUT /api/Car', err);

          // Ensure error message is rendered
          this.cdr.detectChanges();
        }
      });
    } else {
      console.warn('Car core details not loaded; cannot send full update payload');
    }
  }

  private extractMessage(obj: any): string {
    if (!obj) return '';
    const raw = obj.Message ?? obj.message ?? obj?.error?.Message ?? obj?.error?.message;
    if (raw == null) return '';
    if (typeof raw === 'string') {
      const parts = raw.split(',').map(p => p.trim()).filter(Boolean);
      return parts.length > 1 ? parts.join(' • ') : raw;
    }
    try {
      return String(raw);
    } catch {
      return '';
    }
  }

  private isBackendSuccess(resp: any): boolean {
    if (!resp) return false;
    const candidates = [resp?.Success, resp?.success, resp?.data?.Success, resp?.data?.success, resp?.Data?.Success, resp?.Data?.success];
    for (const v of candidates) {
      if (v === true) return true;
      if (typeof v === 'string') {
        const s = v.trim().toLowerCase();
        if (s === 'true' || s === '1' || s === 'ok' || s === 'success') return true;
      }
      if (typeof v === 'number' && v === 1) return true;
    }
    return false;
  }

  deleteIndicator(indicatorId: string): void {
    this.indicators = this.indicators.filter(i => i.id !== indicatorId);
  }

  addIndicator(): void {
    // Logic to add new indicator
    console.log('Add indicator clicked');
  }

  toggleIndicatorSelection(indicator: Indicator): void {
    indicator.selected = !indicator.selected;
  }

  cancel(): void {
    this.router.navigate(['/my-vehicles']);
  }

  saveChanges(): void {
    // Logic to save changes
    console.log('Saving changes...');
    this.router.navigate(['/my-vehicles']);
  }
}
