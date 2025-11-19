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

  parseLicensePlate(plate: string): { letters: string; numbers: string } {
    if (!plate) return { letters: '', numbers: '' };

    // Extract letters and numbers from the plate
    const letters = plate.replace(/[0-9]/g, '').trim();
    const numbers = plate.replace(/[^0-9]/g, '').trim();

    return { letters, numbers };
  }

  getCarLogo(make: string): string {
    const makeNormalized = make?.toLowerCase().trim() || '';
    const logoMap: { [key: string]: string } = {
      'toyota': 'https://www.carlogos.org/car-logos/toyota-logo.png',
      'honda': 'https://www.carlogos.org/car-logos/honda-logo.png',
      'ford': 'https://www.carlogos.org/car-logos/ford-logo.png',
      'chevrolet': 'https://www.carlogos.org/car-logos/chevrolet-logo.png',
      'bmw': 'https://www.carlogos.org/car-logos/bmw-logo.png',
      'mercedes': 'https://www.carlogos.org/car-logos/mercedes-benz-logo.png',
      'mercedes-benz': 'https://www.carlogos.org/car-logos/mercedes-benz-logo.png',
      'audi': 'https://www.carlogos.org/car-logos/audi-logo.png',
      'volkswagen': 'https://www.carlogos.org/car-logos/volkswagen-logo.png',
      'nissan': 'https://www.carlogos.org/car-logos/nissan-logo.png',
      'hyundai': 'https://www.carlogos.org/car-logos/hyundai-logo.png',
      'kia': 'https://www.carlogos.org/car-logos/kia-logo.png',
      'mazda': 'https://www.carlogos.org/car-logos/mazda-logo.png',
      'subaru': 'https://www.carlogos.org/car-logos/subaru-logo.png',
      'lexus': 'https://www.carlogos.org/car-logos/lexus-logo.png',
      'tesla': 'https://www.carlogos.org/car-logos/tesla-logo.png',
      'porsche': 'https://www.carlogos.org/car-logos/porsche-logo.png',
      'jeep': 'https://www.carlogos.org/car-logos/jeep-logo.png',
      'dodge': 'https://www.carlogos.org/car-logos/dodge-logo.png',
      'ram': 'https://www.carlogos.org/car-logos/ram-logo.png',
      'volvo': 'https://www.carlogos.org/car-logos/volvo-logo.png',
      'land rover': 'https://www.carlogos.org/car-logos/land-rover-logo.png',
      'jaguar': 'https://www.carlogos.org/car-logos/jaguar-logo.png',
      'mitsubishi': 'https://www.carlogos.org/car-logos/mitsubishi-logo.png',
      'peugeot': 'https://www.carlogos.org/car-logos/peugeot-logo.png',
      'renault': 'https://www.carlogos.org/car-logos/renault-logo.png',
      'fiat': 'https://www.carlogos.org/car-logos/fiat-logo.png',
      'alfa romeo': 'https://www.carlogos.org/car-logos/alfa-romeo-logo.png',
      'mini': 'https://www.carlogos.org/car-logos/mini-logo.png',
      'skoda': 'https://www.carlogos.org/car-logos/skoda-logo.png',
      'seat': 'https://www.carlogos.org/car-logos/seat-logo.png'
    };
    return logoMap[makeNormalized] || '';
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
