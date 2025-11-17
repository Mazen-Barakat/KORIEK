import { Component, OnInit, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { CarsService, MakeModels } from '../../services/cars.service';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-add-vehicle-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
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
  
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<any>();

  // Message display properties
  resultMessage = '';
  isSuccess = false;
  showMessage = false;

  constructor(
    private fb: FormBuilder, 
    private carsService: CarsService,
    private cdr: ChangeDetectorRef
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
      licensePlate: ['', [Validators.required, Validators.maxLength(20)], [this.licensePlateAsyncValidator.bind(this)]],
      mileage: ['', [Validators.required, Validators.min(0)]],
      engineCapacity: ['', [Validators.required, this.greaterThanZeroValidator]],
      transmissionType: ['', Validators.required],
      fuelType: ['', Validators.required]
    });

    // Load makes and models from CSV
    this.carsService.getAllMakesAndModels().subscribe({
      next: (data) => {
        this.makes = data;
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
    });
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
      const requestBody = {
        make: this.addVehicleForm.value.make,
        model: this.addVehicleForm.value.model,
        year: this.addVehicleForm.value.year,
        engineCapacity: parseFloat(this.addVehicleForm.value.engineCapacity),
        currentMileage: Number(this.addVehicleForm.value.mileage),
        licensePlate: this.addVehicleForm.value.licensePlate,
        transmissionType: this.addVehicleForm.value.transmissionType,
        fuelType: this.addVehicleForm.value.fuelType
      };

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

            // Wait 2 seconds to ensure user sees the success message before closing
            setTimeout(() => {
              this.addVehicleForm.reset();
              this.saved.emit(response);
              this.onClose();
            }, 2000);
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

            // Wait 2 seconds to ensure user sees the success message before closing
            setTimeout(() => {
              this.addVehicleForm.reset();
              this.saved.emit(payload);
              this.onClose();
            }, 3000);
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