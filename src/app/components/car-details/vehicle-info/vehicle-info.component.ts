import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CarsService } from '../../../services/cars.service';

interface VehicleInfo {
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  engineCapacity: number;
}

@Component({
  selector: 'app-vehicle-info',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './vehicle-info.component.html',
  styleUrls: ['./vehicle-info.component.css']
})
export class VehicleInfoComponent implements OnInit {
  @Input() vehicleId!: string;
  
  vehicleInfo: VehicleInfo | null = null;
  loading = false;
  errorMessage: string | null = null;

  constructor(private carsService: CarsService) {}

  ngOnInit(): void {
    this.loadVehicleInfo();
  }

  loadVehicleInfo(): void {
    const id = Number(this.vehicleId);
    if (!id) {
      this.errorMessage = 'Invalid vehicle ID';
      return;
    }

    this.loading = true;
    this.errorMessage = null;

    this.carsService.getCarById(id).subscribe({
      next: (response: any) => {
        console.log('Vehicle Info API Response:', response);
        const carData = response?.data ?? response;

        if (!carData) {
          this.errorMessage = 'No vehicle data returned';
          this.loading = false;
          return;
        }

        this.vehicleInfo = {
          make: carData.make ?? '',
          model: carData.model ?? '',
          year: Number(carData.year ?? 0),
          licensePlate: carData.licensePlate ?? '',
          engineCapacity: Number(carData.engineCapacity ?? 0)
        };

        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading vehicle info:', error);
        this.errorMessage = 'Failed to load vehicle information';
        this.loading = false;
      }
    });
  }
}
