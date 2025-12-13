import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  CarsService,
  CarIndicatorDto,
  CreateCarIndicatorRequest,
  MakeModels,
} from '../../services/cars.service';
import { environment } from '../../../environments/environment';
import {
  CustomDropdownComponent,
  DropdownOption,
} from '../custom-dropdown/custom-dropdown.component';

interface Indicator {
  id: string;
  backendId: number | null;
  typeValue: string;
  name: string;
  icon: string;
  color: string;
  status: 'Good' | 'Normal' | 'Attention' | 'Warning' | 'Urgent' | 'Critical' | 'Unknown' | string;
  lastInspectedDate: string;
  nextInspectedDate: string;
  currentMileage: number;
  nextMileage: number;
  selected: boolean;
  isSet: boolean;
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
  imports: [CommonModule, FormsModule, CustomDropdownComponent],
  templateUrl: './edit-car.component.html',
  styleUrls: ['./edit-car.component.css'],
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

  // Toast notification state
  showToast: boolean = false;
  toastMessage: string = '';
  toastType: 'success' | 'error' = 'success';
  private toastTimeoutId: ReturnType<typeof setTimeout> | null = null;
  carColor: string = 'Pearl White';
  engineCapacity: string = '2.0L L4 Cylinder';
  currentMileage: number = 42620;
  licensePlate: string = 'ABL 1234';
  lastMaintenanceDate: string = '10/08/2025';
  nextMaintenanceDate: string = '12/25/2025';
  nextMaintenanceMileage: number = 50000;

  // Array to store makes with origins for CarOrigin detection
  makes: MakeModels[] = [];

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
    'Electric',
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
  deletingIndicatorId: number | null = null;
  // In-app delete confirmation modal state
  showDeleteModal: boolean = false;
  pendingDeleteIndicator: Indicator | null = null;

  // Form validation state
  formErrors: {
    indicatorType?: string;
    lastInspectedDate?: string;
    nextInspectedDate?: string;
    nextMileage?: string;
  } = {};

  // Modal message state
  modalMessage: string = '';
  modalMessageType: 'success' | 'error' | null = null;

  // Dashboard selection state
  dashboardIndicators: Array<{ value: string; label: string; icon: string; selected: boolean }> =
    [];
  dashboardSelectionCount = 0;
  // Persisted selection (what's saved) and initial snapshot for cancel
  savedDashboardSelection: string[] = [];
  initialDashboardSelection: string[] = [];
  isEditingDashboard = false;
  tempDashboardSelection: string[] = [];

  private readonly indicatorTypeConfig: Record<string, { label: string; icon: string }> = {
    ACService: { label: 'AC Service', icon: '❄️' },
    CarLicenseAndEnsuranceExpiry: { label: 'License & Insurance Expiry', icon: '📋' },
    GeneralMaintenance: { label: 'General Maintenance', icon: '🛠️' },
    OilChange: { label: 'Oil Change', icon: '🛢️' },
    BatteryHealth: { label: 'Battery Health', icon: '🔋' },
    TireChange: { label: 'Tire Change', icon: '🔄' },
  };

  indicatorTypeOptions: Array<{ value: string; label: string }> = Object.entries(
    this.indicatorTypeConfig
  ).map(([value, meta]) => ({
    value,
    label: meta.label,
  }));

  // Dropdown option arrays for custom dropdown component
  engineCapacityOptions: DropdownOption[] = this.engineCapacities.map((c) => ({
    value: c,
    label: `${c} CC`,
  }));
  transmissionOptions: DropdownOption[] = this.transmissionTypes.map((t) => ({
    value: t,
    label: t,
  }));
  fuelOptions: DropdownOption[] = this.fuelTypes.map((f) => ({ value: f, label: f }));
  indicatorOptions: DropdownOption[] = Object.entries(this.indicatorTypeConfig).map(
    ([value, meta]) => ({
      value,
      label: meta.label,
    })
  );

  private normalizeIndicatorTypeInput(value: string | null | undefined): string {
    if (!value) {
      return '';
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }

    if (this.indicatorTypeConfig[trimmed]) {
      return trimmed;
    }

    const match = Object.entries(this.indicatorTypeConfig).find(
      ([, meta]) => meta.label.toLowerCase() === trimmed.toLowerCase()
    );
    return match ? match[0] : trimmed;
  }

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

    // Load makes and models from JSON for CarOrigin detection
    this.carsService.getAllMakesAndModels().subscribe({
      next: (data) => {
        this.makes = data;
        console.log('Loaded makes for origin detection:', this.makes.length);
      },
      error: (err) => {
        console.error('Error loading makes and models:', err);
      },
    });

    // Initialize dashboard indicators
    this.dashboardIndicators = Object.entries(this.indicatorTypeConfig).map(([value, meta]) => ({
      value,
      label: meta.label,
      icon: meta.icon,
      selected: false,
    }));

    // Load saved dashboard selection from localStorage
    if (!isNaN(this.carId)) {
      const savedData = localStorage.getItem(`car_${this.carId}_dashboard`);
      if (savedData) {
        try {
          const savedIndicators = JSON.parse(savedData);
          // Extract the values from saved indicators
          const savedLabels = savedIndicators.map((ind: any) => ind.label);
          // Find matching values and mark as selected
          this.dashboardIndicators.forEach((i) => {
            if (savedLabels.includes(i.label)) {
              i.selected = true;
              this.savedDashboardSelection.push(i.value);
            }
          });
        } catch (e) {
          console.error('Failed to parse saved dashboard indicators', e);
        }
      }
    }

    // Capture initial/saved selection so Cancel can revert
    this.initialDashboardSelection = [...this.savedDashboardSelection];
    this.dashboardSelectionCount = this.dashboardIndicators.filter((i) => i.selected).length;

    // Keep form model defined to avoid ExpressionChanged errors
    this.updateModel = {
      engineCapacity: undefined,
      currentMileage: undefined,
      transmissionType: undefined,
      fuelType: undefined,
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
          licensePlate: String(car?.licensePlate ?? ''),
        };

        // If the backend value isn't in the list, include it so it displays
        if (
          normalized.engineCapacity &&
          !this.engineCapacities.includes(String(normalized.engineCapacity))
        ) {
          this.engineCapacities = [String(normalized.engineCapacity), ...this.engineCapacities];
        }

        // Prefill the form model so values render immediately
        this.updateModel = {
          engineCapacity: normalized.engineCapacity,
          currentMileage: normalized.currentMileage,
          transmissionType: normalized.transmissionType,
          fuelType: normalized.fuelType,
        };

        // Force change detection so values appear immediately without user interaction
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Failed to fetch car', err),
    });
  }

  private loadIndicators(carId: number): void {
    this.carsService.getCarIndicators(carId).subscribe({
      next: (items: CarIndicatorDto[]) => {
        this.indicators = items.map((dto) => this.mapIndicatorDto(dto));
        this.cdr.detectChanges();
      },
      error: (err) => {
        // If GET endpoint doesn't exist (404), just keep existing indicators
        if (err.status === 404) {
          console.warn(
            '[LOAD INDICATORS] GET endpoint not available (404), keeping current indicators'
          );
        } else {
          console.error('Failed to load indicators', err);
        }
        // Don't clear indicators on error, maintain current state
        this.cdr.detectChanges();
      },
    });
  }

  /**
   * Detects the CarOrigin based on the make by looking up
   * the make in the loaded makes array and returning its CarOrigin.
   * Returns an empty string if not found.
   */
  private detectCarOrigin(make: string): string {
    const entry = this.makes.find((m) => m.make === make);
    return entry?.CarOrigin || '';
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

      // Detect CarOrigin automatically based on the make
      const carOrigin = this.detectCarOrigin(this.fetchedCarCore.make);

      // Log the detected origin and payload for debugging
      console.log('Detected CarOrigin:', carOrigin, 'for make:', this.fetchedCarCore.make);
      console.log('Makes array loaded:', this.makes.length, 'entries');

      // If origin is empty, validation will fail - warn in console
      if (!carOrigin) {
        console.warn(
          'CarOrigin could not be detected. Makes data may not be loaded yet or make not found in cars-data.json'
        );
      }

      const payload = {
        id: this.fetchedCarCore.id,
        make: this.fetchedCarCore.make,
        model: this.fetchedCarCore.model,
        year: this.fetchedCarCore.year,
        engineCapacity: Number.isNaN(engineCapacityNum) ? 0 : engineCapacityNum,
        currentMileage: Number(this.updateModel.currentMileage ?? 0),
        licensePlate: this.fetchedCarCore.licensePlate,
        transmissionType: String(this.updateModel.transmissionType ?? 'Manual'),
        fuelType: String(this.updateModel.fuelType ?? 'Gasoline'),
        origin: carOrigin,
      };

      console.log('Sending payload to backend:', payload);

      this.carsService.updateCarFull(payload).subscribe({
        next: (resp: any) => {
          this.isSaving = false;
          const backendMsg = this.extractMessage(resp);
          const backendSuccess = this.isBackendSuccess(resp);
          const msg =
            backendMsg ||
            (backendSuccess ? 'Car updated successfully' : 'Failed to update Car information');

          // Show message with auto-hide after 2 seconds
          this.showMessage(msg, backendSuccess ? 'success' : 'error');
          console.log('Vehicle information updated via PUT /api/Car', resp);

          // No automatic redirect - user can use back button to navigate
        },
        error: (err) => {
          this.isSaving = false;

          // Log full error details for debugging
          console.error('Failed to update vehicle via PUT /api/Car', err);
          console.error('Error details:', err.error);

          // Extract validation errors if present
          if (err.error?.errors) {
            console.error('Validation errors:', err.error.errors);
          }

          const errorMsg =
            this.extractMessage(err.error) ||
            this.extractMessage(err) ||
            'Failed to update Car information';

          // Show error message with auto-hide after 2 seconds
          this.showMessage(errorMsg, 'error');
        },
      });
    } else {
      console.warn('Car core details not loaded; cannot send full update payload');
    }
  }

  goBack(): void {
    // Navigate back to car details page
    this.router.navigate(['/car-details', this.carId]);
  }

  private extractMessage(obj: any): string {
    if (!obj) return '';
    const raw = obj.Message ?? obj.message ?? obj?.error?.Message ?? obj?.error?.message;
    if (raw == null) return '';
    if (typeof raw === 'string') {
      const parts = raw
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
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
    const candidates = [
      resp?.Success,
      resp?.success,
      resp?.data?.Success,
      resp?.data?.success,
      resp?.Data?.Success,
      resp?.Data?.success,
    ];
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
    const id =
      backendId != null
        ? String(backendId)
        : `indicator-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const typeValue = indicatorType;
    const label = this.toIndicatorLabel(typeValue);
    // Use carStatus if available, otherwise fall back to status
    const statusValue = dto?.carStatus || dto?.status;
    return {
      id,
      backendId,
      typeValue,
      name: label,
      icon: this.getIndicatorEmoji(typeValue),
      color: '#10B981',
      status: this.normalizeIndicatorStatus(statusValue),
      lastInspectedDate: this.toDateInputValue(dto?.lastCheckedDate),
      nextInspectedDate: this.toDateInputValue(dto?.nextCheckedDate),
      currentMileage: Number(dto?.currentMileage ?? 0),
      nextMileage: Number(dto?.nextMileage ?? 0),
      selected: false,
      isSet: true, // Indicators from backend are already set
    };
  }

  private normalizeIndicatorStatus(raw: any): Indicator['status'] {
    if (typeof raw === 'string' && raw.trim() !== '') {
      const lowered = raw.trim().toLowerCase();
      // Map backend status values to display values
      if (lowered === 'good') return 'Good';
      if (lowered === 'normal') return 'Normal';
      if (lowered === 'attention') return 'Attention';
      if (lowered === 'warning') return 'Warning';
      if (lowered === 'urgent') return 'Urgent';
      if (lowered === 'critical') return 'Critical';
      if (lowered === 'unknown') return 'Unknown';
      // Return the original value capitalized if it doesn't match known values
      return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    }
    return 'Unknown';
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

  showToastMessage(message: string, type: 'success' | 'error'): void {
    if (this.toastTimeoutId) {
      clearTimeout(this.toastTimeoutId);
      this.toastTimeoutId = null;
    }

    this.toastMessage = message;
    this.toastType = type;
    this.showToast = true;
    this.cdr.detectChanges();

    // Auto-hide after 2 seconds
    this.toastTimeoutId = setTimeout(() => {
      this.showToast = false;
      this.toastTimeoutId = null;
      this.cdr.detectChanges();
    }, 2000);
  }

  showMessage(message: string, type: 'success' | 'error'): void {
    this.message = message;
    this.messageType = type;
    this.cdr.detectChanges();
    // Auto-hide after 2 seconds
    setTimeout(() => {
      this.message = '';
      this.messageType = null;
      this.cdr.detectChanges();
    }, 2000);
  }

  deleteIndicator(indicator: Indicator): void {
    if (!indicator) {
      return;
    }

    if (indicator.backendId == null) {
      this.indicators = this.indicators.filter((i) => i.id !== indicator.id);
      this.showToastMessage('Indicator removed successfully', 'success');
      return;
    }
    const carId = this.carId;
    if (carId == null || Number.isNaN(carId)) {
      console.error('Cannot delete indicator because car id is unavailable');
      return;
    }

    const idToDelete = indicator.backendId;
    this.deletingIndicatorId = idToDelete;

    console.log('[DELETE INDICATOR] Deleting indicator with ID:', idToDelete);
    console.log('[DELETE INDICATOR] URL:', `${environment.apiBase}/CarIndicator/${idToDelete}`);

    this.carsService.deleteCarIndicator(idToDelete).subscribe({
      next: (resp: any) => {
        console.log('[DELETE INDICATOR] DELETE response:', resp);
        this.deletingIndicatorId = null;
        const success = this.isBackendSuccess(resp);
        const backendMsg = this.extractMessage(resp) || 'Indicator deleted successfully';
        if (success) {
          // Remove the card immediately
          this.indicators = this.indicators.filter((i) => i.backendId !== idToDelete);
          this.showToastMessage(backendMsg, 'success');
        } else {
          this.showToastMessage(backendMsg, 'error');
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.warn('[DELETE INDICATOR] DELETE failed, status:', err?.status, 'trying fallbacks');
        // If backend rejects DELETE (405), attempt common POST-based delete endpoints
        if (err && err.status === 405) {
          const urlBase = `${this.carsService['apiBase'] ?? environment.apiBase}/CarIndicator`;
          const http = (this.carsService as any).http;

          const attempts: any[] = [
            http.post(`${urlBase}/${idToDelete}`, {}),
            http.post(`${urlBase}/delete/${idToDelete}`, {}),
            http.post(`${urlBase}/Delete/${idToDelete}`, {}),
            http.post(`${urlBase}`, { id: idToDelete }),
          ];

          // Execute fallbacks sequentially until one succeeds
          let tried = 0;
          const tryNext = () => {
            if (tried >= attempts.length) {
              this.deletingIndicatorId = null;
              const msg =
                this.extractMessage(err?.error) || 'Failed to delete indicator. Please try again.';
              this.showToastMessage(msg, 'error');
              return;
            }
            const obs = attempts[tried++];
            obs.subscribe({
              next: (r: any) => {
                console.log('[DELETE INDICATOR] Fallback success response:', r);
                this.deletingIndicatorId = null;
                const success2 = this.isBackendSuccess(r);
                const msg = this.extractMessage(r) || 'Indicator deleted successfully';
                if (success2) {
                  // Remove the card immediately
                  this.indicators = this.indicators.filter((i) => i.backendId !== idToDelete);
                  this.showToastMessage(msg, 'success');
                } else {
                  this.showToastMessage(msg, 'error');
                }
                this.cdr.detectChanges();
              },
              error: (e2: any) => {
                console.warn('[DELETE INDICATOR] Fallback attempt failed', e2);
                tryNext();
              },
            });
          };
          tryNext();
        } else {
          this.deletingIndicatorId = null;
          console.error('Failed to delete indicator', err);
          const msg =
            this.extractMessage(err?.error) || 'Failed to delete indicator. Please try again.';
          this.showToastMessage(msg, 'error');
        }
      },
    });
  }

  openDeleteModal(indicator: Indicator): void {
    this.pendingDeleteIndicator = indicator;
    this.showDeleteModal = true;
  }

  cancelDelete(): void {
    this.pendingDeleteIndicator = null;
    this.showDeleteModal = false;
  }

  confirmDelete(): void {
    if (!this.pendingDeleteIndicator) return;
    const toDelete = this.pendingDeleteIndicator;
    this.showDeleteModal = false;
    this.pendingDeleteIndicator = null;
    // Delegate to existing delete flow
    this.deleteIndicator(toDelete);
  }

  addIndicator(): void {
    this.isAddingIndicator = true;
    this.newIndicator = {
      indicatorType: '',
      lastInspectedDate: '',
      nextInspectedDate: '',
      nextMileage: undefined,
    };
  }

  private validateIndicatorForm(): boolean {
    this.formErrors = {};

    // Validate indicator type
    const normalizedIndicatorType = this.normalizeIndicatorTypeInput(
      this.newIndicator.indicatorType ?? ''
    );
    if (!normalizedIndicatorType) {
      this.formErrors.indicatorType = 'Please select an indicator type';
    } else {
      this.newIndicator.indicatorType = normalizedIndicatorType;
    }

    // Validate last inspected date
    if (!this.newIndicator.lastInspectedDate || this.newIndicator.lastInspectedDate.trim() === '') {
      this.formErrors.lastInspectedDate = 'Last inspected date is required';
    }

    // Validate next inspected date
    if (!this.newIndicator.nextInspectedDate || this.newIndicator.nextInspectedDate.trim() === '') {
      this.formErrors.nextInspectedDate = 'Next inspected date is required';
    } else if (this.newIndicator.lastInspectedDate) {
      // Check that next date is after last date
      const lastDate = new Date(this.newIndicator.lastInspectedDate);
      const nextDate = new Date(this.newIndicator.nextInspectedDate);
      if (nextDate <= lastDate) {
        this.formErrors.nextInspectedDate = 'Next date must be after last inspected date';
      }
    }

    // Validate next mileage
    if (this.newIndicator.nextMileage == null) {
      this.formErrors.nextMileage = 'Next mileage is required';
    } else {
      const nextMileage = Number(this.newIndicator.nextMileage);
      if (!Number.isFinite(nextMileage) || nextMileage <= 0) {
        this.formErrors.nextMileage = 'Next mileage must be a positive number';
      }
    }

    return Object.keys(this.formErrors).length === 0;
  }

  saveNewIndicator(): void {
    // Validate form
    if (!this.validateIndicatorForm()) {
      this.cdr.detectChanges();
      return;
    }

    if (this.carId == null || Number.isNaN(this.carId)) {
      this.modalMessage = 'Missing car reference. Please reopen the edit page.';
      this.modalMessageType = 'error';
      this.cdr.detectChanges();
      return;
    }

    const indicatorType = this.normalizeIndicatorTypeInput(this.newIndicator.indicatorType ?? '');
    if (!indicatorType) {
      this.modalMessage = 'Invalid indicator type selected. Please try again.';
      this.modalMessageType = 'error';
      this.cdr.detectChanges();
      return;
    }
    const lastCheckedDate = this.newIndicator.lastInspectedDate as string;
    const nextCheckedDate = this.newIndicator.nextInspectedDate as string;
    const nextMileage = Number(this.newIndicator.nextMileage);

    const payload: CreateCarIndicatorRequest = {
      carId: this.carId,
      indicatorType,
      lastCheckedDate: this.toBackendDateValue(lastCheckedDate),
      nextCheckedDate: this.toBackendDateValue(nextCheckedDate),
      nextMileage,
      currentMileage: Number(this.updateModel.currentMileage ?? this.currentMileage ?? 0),
    };

    console.log('[ADD INDICATOR] Car ID:', this.carId);
    console.log('[ADD INDICATOR] Payload:', JSON.stringify(payload, null, 2));

    this.isSavingIndicator = true;
    this.modalMessage = '';
    this.modalMessageType = null;

    this.carsService.createCarIndicator(payload).subscribe({
      next: (response) => {
        this.isSavingIndicator = false;
        const success = this.isBackendSuccess(response);

        if (success) {
          this.modalMessage = 'The indicator created successfully';
          this.modalMessageType = 'success';
          console.log('[ADD INDICATOR] Success response:', response);

          // Auto-close after 2 seconds
          setTimeout(() => {
            this.isAddingIndicator = false;
            this.newIndicator = {};
            this.formErrors = {};
            this.modalMessage = '';
            this.modalMessageType = null;
            this.loadIndicators(this.carId);
          }, 2000);
        } else {
          const backendMsg = this.extractMessage(response) || 'Failed to add indicator';
          this.modalMessage = backendMsg;
          this.modalMessageType = 'error';
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isSavingIndicator = false;
        console.error('Failed to create indicator', err);
        const message =
          this.extractMessage(err?.error) || 'Failed to save indicator. Please try again.';
        this.modalMessage = message;
        this.modalMessageType = 'error';
        this.cdr.detectChanges();
      },
    });
  }

  cancelAddIndicator(): void {
    this.isAddingIndicator = false;
    this.newIndicator = {};
    this.formErrors = {};
    this.modalMessage = '';
    this.modalMessageType = null;
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

  toggleDashboardIndicator(indicator: any): void {
    // Only allow toggling in edit mode
    if (!this.isEditingDashboard) {
      return;
    }

    if (indicator.selected) {
      // Unselecting
      indicator.selected = false;
      this.dashboardSelectionCount = Math.max(0, this.dashboardSelectionCount - 1);
    } else {
      // Check if we can select (max 4)
      if (this.dashboardSelectionCount < 4) {
        indicator.selected = true;
        this.dashboardSelectionCount = this.dashboardSelectionCount + 1;
      } else {
        // Show message when trying to select more than 4
        this.showToastMessage('Maximum 4 indicators can be selected', 'error');
      }
    }
    this.cdr.detectChanges();
  }

  saveDashboardSelection(): void {
    // Only allow saving when exactly 4 selected (enforce business rule)
    if (this.dashboardSelectionCount !== 4) {
      this.showToastMessage('Please select exactly 4 indicators before saving.', 'error');
      return;
    }

    this.savedDashboardSelection = this.dashboardIndicators
      .filter((i) => i.selected)
      .map((i) => i.value);
    // update the initial snapshot to the saved selection
    this.initialDashboardSelection = [...this.savedDashboardSelection];

    // Save dashboard indicators to localStorage for this car
    const selectedIndicators = this.dashboardIndicators
      .filter((i) => i.selected)
      .map((i) => ({ label: i.label, icon: i.icon }));

    if (this.carId) {
      localStorage.setItem(`car_${this.carId}_dashboard`, JSON.stringify(selectedIndicators));
      console.log(`Saved dashboard indicators for car ${this.carId}:`, selectedIndicators);
    }

    this.showToastMessage('Dashboard indicators saved successfully', 'success');

    // Navigate back to my-vehicles after a brief delay
    setTimeout(() => {
      this.router.navigate(['/my-vehicles']);
    }, 1500);

    this.cdr.detectChanges();
  }

  cancelDashboardChanges(): void {
    // Revert to saved selection
    this.dashboardIndicators.forEach((i) => {
      i.selected = this.initialDashboardSelection.includes(i.value);
    });
    this.dashboardSelectionCount = this.dashboardIndicators.filter((i) => i.selected).length;
    this.isEditingDashboard = false;
    this.showToastMessage('Changes cancelled', 'success');
    this.cdr.detectChanges();
  }

  startEditingDashboard(): void {
    // Enter edit mode and save temp selection
    this.isEditingDashboard = true;
    this.tempDashboardSelection = this.dashboardIndicators
      .filter((i) => i.selected)
      .map((i) => i.value);
    this.cdr.detectChanges();
  }

  cancel(): void {
    this.router.navigate(['/my-vehicles']);
  }

  saveChanges(): void {
    // Logic to save changes
    console.log('Saving changes...');
    this.router.navigate(['/my-vehicles']);
  }

  getIndicatorIconPath(indicatorName: string): string {
    console.log('Maintenance Indicator Icon Path for:', indicatorName); // Debug log
    const iconMap: { [key: string]: string } = {
      // Match dashboard indicator labels exactly
      'AC Service':
        'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-7 14a5 5 0 1 1 0-10 5 5 0 0 1 0 10z',
      'License & Insurance Expiry':
        'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 13H9v-2h4v2zm0-4H9V9h4v2z',
      'General Maintenance':
        'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z',
      'Oil Change': 'M7 13v6a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-6M8 5l4-3 4 3M12 2v10',
      'Battery Health': 'M6 7h11v10H6V7zm11 5h4m-4-2h4',
      'Tire Change': 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
      // Additional maintenance indicators with same design language
      'Brake Fluid': 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 14v-2m2 0v2m-2-6v-2m2 0v2',
      'Engine Air Filter': 'M3 3h18v18H3V3zm0 6h18M9 9v12',
      Coolant: 'M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z',
      'Tire Rotation':
        'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
      'Spark Plugs':
        'M12 2v6m0 4v10M4.93 4.93l4.24 4.24m5.66 5.66l4.24 4.24M2 12h6m8 0h6M4.93 19.07l4.24-4.24m5.66-5.66l4.24-4.24',
      'Transmission Fluid':
        'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm0-7v4m0 6v8M8.22 8.22l2.83 2.83m5.9 5.9l2.83 2.83m-14.83 0l2.83-2.83m5.9-5.9l2.83-2.83',
      'Cabin Air Filter': 'M2 7h20v10H2V7zm0 5h20',
      'Windshield Wipers': 'M2 12l10-5 10 5m-20 5l10-5 10 5',
      'Brake Pads': 'M5 11h14v10H5V11zm7-6a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    };
    return (
      iconMap[indicatorName] ||
      'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z'
    );
  }

  getDashboardIconPath(indicatorValue: string): string {
    console.log('Dashboard Icon Path for:', indicatorValue); // Debug log
    const iconMap: { [key: string]: string } = {
      // Dashboard indicator keys (PascalCase from indicatorTypeConfig)
      ACService:
        'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-7 14a5 5 0 1 1 0-10 5 5 0 0 1 0 10z',
      CarLicenseAndEnsuranceExpiry:
        'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 13H9v-2h4v2zm0-4H9V9h4v2z',
      GeneralMaintenance:
        'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z',
      OilChange: 'M7 13v6a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-6M8 5l4-3 4 3M12 2v10',
      BatteryHealth: 'M6 7h11v10H6V7zm11 5h4m-4-2h4',
      TireChange: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
    };
    return (
      iconMap[indicatorValue] ||
      'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z'
    );
  }
}
