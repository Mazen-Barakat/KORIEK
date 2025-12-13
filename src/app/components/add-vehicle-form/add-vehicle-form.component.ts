import { Component, OnInit, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { CommonModule, NgIf, NgFor } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { CarsService, MakeModels } from '../../services/cars.service';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-add-vehicle-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgIf, NgFor],
  templateUrl: './add-vehicle-form.component.html',
  styleUrls: ['./add-vehicle-form.component.css']
})
export class AddVehicleFormComponent implements OnInit {
  addVehicleForm!: FormGroup;
  makes: MakeModels[] = [];
  modelsForSelectedMake: string[] = [];
  years: number[] = [];
  transmissionTypes: string[] = ['Manual', 'Automatic', 'Semi Automatic'];
  fuelTypes: string[] = ['Gasoline', 'CNG'];
  engineCapacities: string[] = [];
  // UI state for custom combobox
  filteredEngineCapacities: string[] = [];
  showEngineList = false;
  highlightedIndex = -1;
  // Generic combobox state for other fields
  filteredMakes: string[] = [];
  showMakeList = false;
  highlightedMakeIndex = -1;

  filteredModels: string[] = [];
  showModelList = false;
  highlightedModelIndex = -1;

  filteredYears: string[] = [];
  showYearList = false;
  highlightedYearIndex = -1;

  filteredTransmissions: string[] = [];
  showTransmissionList = false;
  highlightedTransmissionIndex = -1;

  filteredFuels: string[] = [];
  showFuelList = false;
  highlightedFuelIndex = -1;
  
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<any>();

  // Message display properties
  resultMessage = '';
  isSuccess = false;
  showMessage = false;

  constructor(
    private fb: FormBuilder, 
    private carsService: CarsService,
    private cdr: ChangeDetectorRef,
    private http: HttpClient
  ) {
    // Generate years from 1986 to current year + 1
    const currentYear = new Date().getFullYear();
    for (let year = currentYear + 1; year >= 1986; year--) {
      this.years.push(year);
    }
  }

  ngOnInit(): void {
    this.addVehicleForm = this.fb.group({
      make: ['', Validators.required],
      model: ['', Validators.required],
      year: ['', Validators.required],
      // License plate must be 2-3 letters followed by 3-4 digits (only alphanumeric allowed)
      licensePlate: ['', [Validators.required, Validators.maxLength(7), this.plateFormatValidator.bind(this)], [this.licensePlateAsyncValidator.bind(this)]],
      mileage: ['', [Validators.required, Validators.min(0)]],
      engineCapacity: ['', [Validators.required, this.greaterThanZeroValidator]],
      transmissionType: ['', Validators.required],
      fuelType: ['', Validators.required]
    });

    // Load engine capacities list from public JSON; fall back to a default list if failed
    this.loadEngineCapacities();

    // Load makes and models from CSV
    this.carsService.getAllMakesAndModels().subscribe({
      next: (data) => {
        this.makes = data;
        // initialize filtered makes now that data is available
        this.filteredMakes = this.makes.map(m => m.make);
        console.log('Loaded makes:', this.makes.length, this.makes);
      },
      error: (err) => {
        console.error('Error loading makes and models:', err);
      }
    });

    // Watch for make changes to update model dropdown
    this.addVehicleForm.get('make')!.valueChanges.subscribe((makeName: string) => {
      const entry = this.makes.find(m => m.make === makeName);
      this.modelsForSelectedMake = entry ? entry.models : [];
      console.log('Selected make:', makeName, 'Models:', this.modelsForSelectedMake);
      this.addVehicleForm.get('model')!.setValue('');
      this.filteredModels = [...this.modelsForSelectedMake];
    });

    // initialize filtered list
    this.filteredEngineCapacities = [...this.engineCapacities];

    // Initialize other filtered lists
    this.filteredMakes = this.makes.map(m => m.make);
    this.filteredModels = [...this.modelsForSelectedMake];
    this.filteredYears = this.years.map(y => y.toString());
    this.filteredTransmissions = [...this.transmissionTypes];
    this.filteredFuels = [...this.fuelTypes];
  }

  /**
   * Convert Arabic numerals (٠-٩) to English numerals (0-9)
   */
  private convertArabicNumeralsToEnglish(text: string): string {
    const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    const englishNumerals = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    
    let result = text;
    arabicNumerals.forEach((arabic, index) => {
      result = result.replace(new RegExp(arabic, 'g'), englishNumerals[index]);
    });
    return result;
  }

  /**
   * Synchronous validator that enforces final license plate format:
   *  - 2 or 3 letters (A-Z or Arabic letters)
   *  - followed immediately by 3 or 4 digits (0-9 or Arabic digits)
   * Returns { plateFormat: true } when invalid.
   */
  plateFormatValidator(control: AbstractControl): ValidationErrors | null {
    const value = control && control.value ? String(control.value).trim() : '';
    if (!value) return null; // required validator handles emptiness

    // Convert Arabic numerals to English for validation
    const normalized = this.convertArabicNumeralsToEnglish(value).replace(/\s+/g, '').toUpperCase();
    
    // Allow both English letters (A-Z) and Arabic letters, followed by digits
    const ok = /^[A-Zا-ي]{2,3}\d{3,4}$/.test(normalized);
    return ok ? null : { plateFormat: true };
  }

  /**
   * Keep license plate input alphanumeric (English & Arabic) while typing.
   * Allows Arabic letters, English letters, Arabic numerals, and English numerals.
   */
  onPlateInput(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    if (!input) return;
    const raw = input.value || '';
    
    // Allow English letters, Arabic letters, English digits, and Arabic numerals
    // Remove any other characters (no spaces, no symbols)
    const filtered = raw.replace(/[^a-zA-Zا-ي0-9٠-٩]/g, '').toUpperCase();

    // If value changed, update input value to keep it in sync
    if (filtered !== raw) {
      input.value = filtered;
    }

    // Update form control value without re-emitting to avoid double handling
    const ctrl = this.addVehicleForm.get('licensePlate');
    if (ctrl && ctrl.value !== filtered) {
      ctrl.setValue(filtered);
    }
  }

  private loadEngineCapacities(): void {
    this.http.get<string[]>('/engine-capacities.json').subscribe({
      next: (data) => {
        if (Array.isArray(data) && data.length) {
          this.engineCapacities = data;
          // ensure filtered list reflects loaded data
          this.filteredEngineCapacities = [...this.engineCapacities];
        }
      },
      error: () => {
        // fallback - minimal set
        this.engineCapacities = [
          '800 CC','1000 CC','1200 CC','1300 CC','1400 CC','1500 CC','1600 CC','1800 CC','2000 CC'
        ];
      }
    });
  }

  // Combobox Helpers
  onEngineInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value.toLowerCase();
    if (!val) {
      this.filteredEngineCapacities = [...this.engineCapacities];
    } else {
      this.filteredEngineCapacities = this.engineCapacities.filter(e => e.toLowerCase().includes(val));
    }
    this.showEngineList = true;
    this.highlightedIndex = -1;
  }

  onEngineFocus(): void {
    // show list when focused
    this.filteredEngineCapacities = [...this.engineCapacities];
    this.showEngineList = true;
  }

  onEngineBlur(): void {
    // delay hiding to allow click selection
    setTimeout(() => {
      this.showEngineList = false;
      this.highlightedIndex = -1;
      this.cdr.detectChanges();
    }, 150);
  }

  selectEngineSuggestion(value: string): void {
    this.addVehicleForm.get('engineCapacity')!.setValue(value);
    this.showEngineList = false;
    this.highlightedIndex = -1;
  }

  onEngineKeyDown(ev: KeyboardEvent): void {
    if (!this.showEngineList) return;
    const max = this.filteredEngineCapacities.length - 1;
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      this.highlightedIndex = Math.min(max, this.highlightedIndex + 1);
      this.cdr.detectChanges();
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      this.highlightedIndex = Math.max(0, this.highlightedIndex - 1);
      this.cdr.detectChanges();
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      if (this.highlightedIndex >= 0 && this.highlightedIndex <= max) {
        this.selectEngineSuggestion(this.filteredEngineCapacities[this.highlightedIndex]);
      }
    } else if (ev.key === 'Escape') {
      this.showEngineList = false;
    }
  }

  // Generic combobox helpers
  private getSourceArray(field: string): string[] {
    switch (field) {
      case 'make': return this.makes.map(m => m.make);
      case 'model': return this.modelsForSelectedMake || [];
      case 'year': return this.years.map(y => y.toString());
      case 'transmissionType': return this.transmissionTypes;
      case 'fuelType': return this.fuelTypes;
      default: return [];
    }
  }

  onComboInput(field: string, event: Event): void {
    const val = (event.target as HTMLInputElement).value.toLowerCase();
    const src = this.getSourceArray(field);
    const filtered = !val ? [...src] : src.filter(e => e.toLowerCase().includes(val));
    switch (field) {
      case 'make': this.filteredMakes = filtered; this.showMakeList = true; this.highlightedMakeIndex = -1; break;
      case 'model': this.filteredModels = filtered; this.showModelList = true; this.highlightedModelIndex = -1; break;
      case 'year': this.filteredYears = filtered; this.showYearList = true; this.highlightedYearIndex = -1; break;
      case 'transmissionType': this.filteredTransmissions = filtered; this.showTransmissionList = true; this.highlightedTransmissionIndex = -1; break;
      case 'fuelType': this.filteredFuels = filtered; this.showFuelList = true; this.highlightedFuelIndex = -1; break;
    }
  }

  onComboFocus(field: string): void {
    const src = this.getSourceArray(field);
    switch (field) {
      case 'make': this.filteredMakes = [...src]; this.showMakeList = true; break;
      case 'model': this.filteredModels = [...src]; this.showModelList = true; break;
      case 'year': this.filteredYears = [...src]; this.showYearList = true; break;
      case 'transmissionType': this.filteredTransmissions = [...src]; this.showTransmissionList = true; break;
      case 'fuelType': this.filteredFuels = [...src]; this.showFuelList = true; break;
    }
  }

  onComboBlur(field: string): void {
    setTimeout(() => {
      switch (field) {
        case 'make': this.showMakeList = false; this.highlightedMakeIndex = -1; break;
        case 'model': this.showModelList = false; this.highlightedModelIndex = -1; break;
        case 'year': this.showYearList = false; this.highlightedYearIndex = -1; break;
        case 'transmissionType': this.showTransmissionList = false; this.highlightedTransmissionIndex = -1; break;
        case 'fuelType': this.showFuelList = false; this.highlightedFuelIndex = -1; break;
      }
      this.cdr.detectChanges();
    }, 150);
  }

  selectComboSuggestion(field: string, value: string): void {
    // For year, store as number; else store string
    if (field === 'year') {
      const num = parseInt(value as any, 10);
      this.addVehicleForm.get(field)!.setValue(isNaN(num) ? value : num);
    } else {
      this.addVehicleForm.get(field)!.setValue(value);
    }

    switch (field) {
      case 'make': this.showMakeList = false; this.highlightedMakeIndex = -1; break;
      case 'model': this.showModelList = false; this.highlightedModelIndex = -1; break;
      case 'year': this.showYearList = false; this.highlightedYearIndex = -1; break;
      case 'transmissionType': this.showTransmissionList = false; this.highlightedTransmissionIndex = -1; break;
      case 'fuelType': this.showFuelList = false; this.highlightedFuelIndex = -1; break;
    }
  }

  onComboKeyDown(ev: KeyboardEvent, field: string): void {
    let filtered: string[] = [];
    let highlighted = -1;
    let max = -1;
    switch (field) {
      case 'make': filtered = this.filteredMakes; highlighted = this.highlightedMakeIndex; break;
      case 'model': filtered = this.filteredModels; highlighted = this.highlightedModelIndex; break;
      case 'year': filtered = this.filteredYears; highlighted = this.highlightedYearIndex; break;
      case 'transmissionType': filtered = this.filteredTransmissions; highlighted = this.highlightedTransmissionIndex; break;
      case 'fuelType': filtered = this.filteredFuels; highlighted = this.highlightedFuelIndex; break;
    }
    max = filtered.length - 1;
    if (!filtered.length) return;

    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      highlighted = Math.min(max, highlighted + 1);
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      highlighted = Math.max(0, highlighted - 1);
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      if (highlighted >= 0 && highlighted <= max) {
        this.selectComboSuggestion(field, filtered[highlighted]);
      }
    } else if (ev.key === 'Escape') {
      switch (field) {
        case 'make': this.showMakeList = false; break;
        case 'model': this.showModelList = false; break;
        case 'year': this.showYearList = false; break;
        case 'transmissionType': this.showTransmissionList = false; break;
        case 'fuelType': this.showFuelList = false; break;
      }
    }

    // write back highlighted index
    switch (field) {
      case 'make': this.highlightedMakeIndex = highlighted; break;
      case 'model': this.highlightedModelIndex = highlighted; break;
      case 'year': this.highlightedYearIndex = highlighted; break;
      case 'transmissionType': this.highlightedTransmissionIndex = highlighted; break;
      case 'fuelType': this.highlightedFuelIndex = highlighted; break;
    }
    this.cdr.detectChanges();
  }

  /**
   * Handle mileage input to accept and convert Arabic numerals
   */
  onMileageInput(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    if (!input) return;
    const raw = input.value || '';
    
    // Convert Arabic numerals to English and keep only digits
    const converted = this.convertArabicNumeralsToEnglish(raw);
    const filtered = converted.replace(/[^0-9]/g, '');

    // Update input and form control if value changed
    if (filtered !== raw) {
      input.value = filtered;
    }

    const ctrl = this.addVehicleForm.get('mileage');
    if (ctrl && ctrl.value !== filtered) {
      ctrl.setValue(filtered || null);
    }
  }

  // Custom validator to ensure engineCapacity > 0
  greaterThanZeroValidator(control: AbstractControl): ValidationErrors | null {
    if (control == null || control.value == null || control.value === '') return { required: true };
    const val = parseFloat(control.value);
    if (isNaN(val) || val <= 0) {
      return { engineInvalid: true };
    }
    return null;
  }

  // Async validator to check license plate uniqueness via backend
  licensePlateAsyncValidator(control: AbstractControl) {
    const value = control.value;
    if (!value) {
      return of(null);
    }
    return this.carsService.checkLicensePlate(value).pipe(
      map((isInUse: boolean) => (isInUse ? { licenseNotUnique: true } : null)),
      catchError(() => of(null))
    );
  }

  isSubmitting = false;

  /**
   * Detects the CarOrigin based on the selected make by looking up
   * the make in the loaded makes array and returning its CarOrigin.
   * Returns an empty string if not found.
   */
  private detectCarOrigin(make: string): string {
    const entry = this.makes.find(m => m.make === make);
    return entry?.CarOrigin || '';
  }

  onClose(): void {
    this.close.emit();
  }

  dismissMessage(): void {
    this.showMessage = false;
    this.resultMessage = '';
  }

  onSubmit(): void {
    if (this.isSubmitting) return;

    // If form is invalid, mark all controls as touched so validation
    // messages appear instantly beneath each field, then return.
    if (!this.addVehicleForm.valid) {
      this.addVehicleForm.markAllAsTouched();
      this.cdr.detectChanges();
      return;
    }

    if (this.addVehicleForm.valid) {
      this.isSubmitting = true;
      
      // Detect CarOrigin automatically based on selected make
      const carOrigin = this.detectCarOrigin(this.addVehicleForm.value.make);
      
      // Convert Arabic numerals to English in license plate and mileage
      const licensePlateConverted = this.convertArabicNumeralsToEnglish(this.addVehicleForm.value.licensePlate || '');
      const mileageConverted = this.convertArabicNumeralsToEnglish(String(this.addVehicleForm.value.mileage || '0'));
      
      const requestBody = {
        make: this.addVehicleForm.value.make,
        model: this.addVehicleForm.value.model,
        year: this.addVehicleForm.value.year,
        engineCapacity: parseFloat(this.addVehicleForm.value.engineCapacity),
        currentMileage: Number(mileageConverted),
        licensePlate: licensePlateConverted,
        transmissionType: this.addVehicleForm.value.transmissionType,
        fuelType: this.addVehicleForm.value.fuelType,
        origin: carOrigin
      };

      // Read engine capacity from the single control (can be a suggested value or custom text)
      const engineControlVal = this.addVehicleForm.value.engineCapacity;
      requestBody.engineCapacity = parseFloat(engineControlVal as any);

      this.carsService.addVehicle(requestBody).subscribe({
        next: (response) => {
          console.log('Vehicle added successfully:', response);
          
          // Check if the response indicates success or failure
          if (response.success === false) {
            // Backend returned a structured error response
            this.isSuccess = false;
            this.resultMessage = response.message || 'Failed to add vehicle. Please try again.';
            this.showMessage = true;
            this.isSubmitting = false;
            
            // Force change detection to show message INSTANTLY
            this.cdr.detectChanges();
          } else {
            // Success case
            this.isSuccess = true;
            // Override backend message "Created" with user-friendly message
            this.resultMessage = 'Car added successfully!';
            this.showMessage = true;
            this.isSubmitting = false;
            
            // Force change detection to show success message INSTANTLY
            this.cdr.detectChanges();

            // Keep the modal open; reset the form and notify parent, but
            // do not close the modal automatically. The user must click the
            // X button to close the form.
            this.addVehicleForm.reset();
            this.saved.emit(response);
          }
        },
        error: (err) => {
          console.error('Error adding vehicle:', err);
          console.log('Full error object:', JSON.stringify(err, null, 2));
          console.log('Error status:', err.status);
          console.log('Error error:', err.error);
          console.log('Error message:', err.message);

          // Some backends return 400 even on logical success. Detect that here.
          let payload: any = err?.error;
          if (typeof payload === 'string') {
            try { payload = JSON.parse(payload); } catch { /* ignore */ }
          }

          if (payload && payload.success === true) {
            // Treat as success even though HTTP status is 4xx
            this.isSuccess = true;
            // Override backend message "Created" with user-friendly message
            this.resultMessage = 'Car added successfully!';
            this.showMessage = true;
            this.isSubmitting = false;
            this.cdr.detectChanges();

            // Keep the modal open; reset form and notify parent but do not close.
            this.addVehicleForm.reset();
            this.saved.emit(payload);
            return;
          }

          // Otherwise, show error message
          this.isSuccess = false;
          this.resultMessage = (payload && payload.message) || err.message || 'Failed to add vehicle. Please try again.';
          this.showMessage = true;
          this.isSubmitting = false;
          this.cdr.detectChanges();
        }
      });
    }
  }
}