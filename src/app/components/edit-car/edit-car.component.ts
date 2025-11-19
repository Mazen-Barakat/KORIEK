import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CarsService, CarIndicatorDto, CreateCarIndicatorRequest } from '../../services/cars.service';

interface Indicator {
  id: string;
  backendId: number | null;
  typeValue: string;
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

type NewIndicatorForm = {
  indicatorType?: string;
  lastInspectedDate?: string;
  nextInspectedDate?: string;
  nextMileage?: number;
};

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

  indicators: Indicator[] = [];
  isAddingIndicator = false;
  isSavingIndicator = false;
  newIndicator: NewIndicatorForm = {};

  private readonly indicatorTypeConfig: Record<string, { label: string; icon: string }> = {
    ACService: { label: 'AC Service', icon: '❄️' },
    CarLicenseAndInsuranceExpiry: { label: 'Car License & Insurance Expiry', icon: '📋' },
    GeneralMaintenance: { label: 'General Maintenance', icon: '🔧' },
    OilChange: { label: 'Oil Change', icon: '🛢️' },
    BatteryHealth: { label: 'Battery Health', icon: '🔋' },
    TireChange: { label: 'Tire Change', icon: '🔄' }
  };

  indicatorTypeOptions: Array<{ value: string; label: string }> = Object.entries(this.indicatorTypeConfig).map(([value, meta]) => ({
    value,
    label: meta.label
  }));

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
      this.loadIndicators(this.carId);
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

  private loadIndicators(carId: number): void {
    this.carsService.getCarIndicators(carId).subscribe({
      next: (items: CarIndicatorDto[]) => {
        this.indicators = items.map(dto => this.mapIndicatorDto(dto));
        this.cdr.detectChanges();
      },
      error: (err) => {
        // If GET endpoint doesn't exist (404), just keep existing indicators
        if (err.status === 404) {
          console.warn('[LOAD INDICATORS] GET endpoint not available (404), keeping current indicators');
        } else {
          console.error('Failed to load indicators', err);
        }
        // Don't clear indicators on error, maintain current state
        this.cdr.detectChanges();
      }
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

  private mapIndicatorDto(dto: CarIndicatorDto): Indicator {
    const indicatorType = String(dto?.indicatorType ?? '').trim();
    const backendId = typeof dto?.id === 'number' ? dto.id : null;
    const id = backendId != null ? String(backendId) : `indicator-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const typeValue = indicatorType;
    const label = this.toIndicatorLabel(typeValue);
    return {
      id,
      backendId,
      typeValue,
      name: label,
      icon: this.getIndicatorEmoji(typeValue),
      color: '#10B981',
      status: this.normalizeIndicatorStatus(dto?.status),
      lastInspectedDate: this.toDateInputValue(dto?.lastCheckedDate),
      nextInspectedDate: this.toDateInputValue(dto?.nextCheckedDate),
      currentMileage: Number(dto?.currentMileage ?? 0),
      nextMileage: Number(dto?.nextMileage ?? 0),
      selected: false
    };
  }

  private normalizeIndicatorStatus(raw: any): Indicator['status'] {
    if (typeof raw === 'string') {
      const lowered = raw.trim().toLowerCase();
      if (lowered === 'attention') return 'Attention';
      if (lowered === 'urgent') return 'Urgent';
      if (lowered === 'good') return 'Good';
    }
    return 'Good';
  }

  private toDateInputValue(value: any): string {
    if (!value) {
      return '';
    }
    const str = String(value);
    if (str.includes('T')) {
      return str.split('T')[0];
    }
    return str;
  }

  deleteIndicator(indicator: Indicator): void {
    if (!indicator) {
      return;
    }

    if (indicator.backendId == null) {
      this.indicators = this.indicators.filter(i => i.id !== indicator.id);
      return;
    }

    const carId = this.carId;
    if (carId == null || Number.isNaN(carId)) {
      console.error('Cannot delete indicator because car id is unavailable');
      return;
    }

    this.carsService.deleteCarIndicator(indicator.backendId).subscribe({
      next: () => {
        this.loadIndicators(carId);
      },
      error: (err) => {
        console.error('Failed to delete indicator', err);
        alert('Failed to delete indicator. Please try again.');
      }
    });
  }

  addIndicator(): void {
    this.isAddingIndicator = true;
    this.newIndicator = {
      indicatorType: '',
      lastInspectedDate: '',
      nextInspectedDate: '',
      nextMileage: undefined
    };
  }

  saveNewIndicator(): void {
    if (!this.newIndicator.indicatorType || !this.newIndicator.lastInspectedDate ||
        !this.newIndicator.nextInspectedDate || this.newIndicator.nextMileage == null) {
      alert('Please fill in all fields');
      return;
    }

    if (this.carId == null || Number.isNaN(this.carId)) {
      alert('Missing car reference. Please reopen the edit page.');
      return;
    }

    const nextMileage = Number(this.newIndicator.nextMileage);
    if (!Number.isFinite(nextMileage) || nextMileage <= 0) {
      alert('Next mileage must be a positive number.');
      return;
    }

    const indicatorType = this.newIndicator.indicatorType as string;
    const lastCheckedDate = this.newIndicator.lastInspectedDate as string;
    const nextCheckedDate = this.newIndicator.nextInspectedDate as string;

    const payload: CreateCarIndicatorRequest = {
      carId: this.carId,
      indicatorType,
      lastCheckedDate: this.toBackendDateValue(lastCheckedDate),
      nextCheckedDate: this.toBackendDateValue(nextCheckedDate),
      nextMileage,
      currentMileage: Number(this.updateModel.currentMileage ?? this.currentMileage ?? 0)
    };

    console.log('[ADD INDICATOR] Car ID:', this.carId);
    console.log('[ADD INDICATOR] Payload:', JSON.stringify(payload, null, 2));

    this.isSavingIndicator = true;
    this.carsService.createCarIndicator(payload).subscribe({
      next: (response) => {
        this.isSavingIndicator = false;
        this.isAddingIndicator = false;
        this.newIndicator = {};
        console.log('[ADD INDICATOR] Success response:', response);
        this.loadIndicators(this.carId);
      },
      error: (err) => {
        this.isSavingIndicator = false;
        console.error('Failed to create indicator', err);
        const message = this.extractMessage(err?.error) || 'Failed to save indicator. Please try again.';
        alert(message);
      }
    });
  }

  cancelAddIndicator(): void {
    this.isAddingIndicator = false;
    this.newIndicator = {};
  }

  private getIndicatorEmoji(indicatorType: string): string {
    if (!indicatorType) {
      return '🔍';
    }
    return this.indicatorTypeConfig[indicatorType]?.icon ?? '🔍';
  }

  private toBackendDateValue(value: string): string {
    if (!value) {
      return value;
    }
    return value.includes('T') ? value : `${value}T00:00:00`;
  }

  private toIndicatorLabel(indicatorType: string): string {
    if (!indicatorType) {
      return 'Indicator';
    }
    return this.indicatorTypeConfig[indicatorType]?.label ?? indicatorType;
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
