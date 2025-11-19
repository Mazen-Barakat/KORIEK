import { ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CarsService } from '../../../services/cars.service';

interface VehicleInfo {
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  engineCapacity: number;
  currentMileage: number;
}

@Component({
  selector: 'app-vehicle-info',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './vehicle-info.component.html',
  styleUrls: ['./vehicle-info.component.css']
})
export class VehicleInfoComponent implements OnInit {
  private _vehicleId: string | number | null | undefined;
  private lastLoadedId: number | null = null;

  @Input()
  set vehicleId(value: string | number | undefined | null) {
    this._vehicleId = value;
    // Load immediately when a valid id is provided
    if (value !== undefined && value !== null) {
      const idNum = Number(value);
      if (!Number.isNaN(idNum) && idNum > 0 && this.lastLoadedId !== idNum) {
        this.loadVehicleInfo();
      }
    }
  }

  get vehicleId(): string | number | undefined | null {
    return this._vehicleId;
  }

  vehicleInfo: VehicleInfo | null = null;
  loading = false;
  errorMessage: string | null = null;
  @Output() mileageLoaded = new EventEmitter<number>();
  @Output() infoLoaded = new EventEmitter<VehicleInfo>();

  constructor(private carsService: CarsService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    // If vehicleId was already set before ngOnInit, ensure we load it
    if (this._vehicleId) {
      this.loadVehicleInfo();
    }
  }

  loadVehicleInfo(): void {
    const id = Number(this._vehicleId);
    if (!id || Number.isNaN(id) || id <= 0) {
      this.errorMessage = 'Invalid vehicle ID';
      this.loading = false;
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.errorMessage = null;
    this.vehicleInfo = null;
    this.cdr.markForCheck();

    this.carsService.getCarById(id).subscribe({
      next: (response: any) => {
        console.log('Vehicle Info API Response:', response);
        const carData = response?.data ?? response;

        if (!carData) {
          this.errorMessage = 'No vehicle data returned';
          this.loading = false;
          this.vehicleInfo = null;
          this.lastLoadedId = null;
          this.cdr.markForCheck();
          return;
        }

        this.vehicleInfo = {
          make: carData.make ?? '',
          model: carData.model ?? '',
          year: Number(carData.year ?? 0),
          licensePlate: carData.licensePlate ?? '',
          engineCapacity: Number(carData.engineCapacity ?? 0),
          currentMileage: Number(carData.currentMileage ?? 0)
        };
        this.loading = false;
        this.lastLoadedId = id;
        this.cdr.markForCheck();
        this.mileageLoaded.emit(this.vehicleInfo.currentMileage);
        this.infoLoaded.emit(this.vehicleInfo);
      },
      error: (error) => {
        console.error('Error loading vehicle info:', error);
        this.errorMessage = 'Failed to load vehicle information';
        this.loading = false;
        this.vehicleInfo = null;
        this.lastLoadedId = null;
        this.cdr.markForCheck();
        this.mileageLoaded.emit(0);
      }
    });
  }
}
