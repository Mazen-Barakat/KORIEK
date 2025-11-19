import { Component, OnInit } from '@angular/core';
import { CommonModule, NgIf, NgForOf } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { VehicleInfoComponent } from './vehicle-info/vehicle-info.component';

interface Vehicle {
  id: string;
  year: number;
  make: string;
  model: string;
  licensePlate: string;
  currentMileage: number;
  vin: string;
  engineType: string;
  color: string;
  imageUrl: string;
  lastMaintenanceDate: string;
  nextMaintenanceDate: string;
  nextMaintenanceMileage: number;
  conditionIndicators: ConditionIndicator[];
}

interface ConditionIndicator {
  name: string;
  status: 'Good' | 'Attention' | 'Urgent';
  icon: string;
  lastInspectionDate: string;
  nextInspectionDate: string;
  nextMileage: number;
  remaining: number;
}

@Component({
  selector: 'app-car-details',
  standalone: true,
  imports: [CommonModule, NgIf, NgForOf, VehicleInfoComponent],
  templateUrl: './car-details.component.html',
  styleUrls: ['./car-details.component.css']
})
export class CarDetailsComponent implements OnInit {
  vehicle: Vehicle | null = null;
  vehicleId: string | null = null;
  imageLoaded = false;
  imageError = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.vehicleId = this.route.snapshot.paramMap.get('id');
    this.loadVehicleDetails();
  }

  loadVehicleDetails(): void {
    // Mock data - replace with actual service call
    this.vehicle = {
      id: this.vehicleId || '1',
      year: 2020,
      make: 'Toyota',
      model: 'Camry',
      licensePlate: 'ABC 1234',
      currentMileage: 45000,
      vin: 'THGB541A0M100196',
      engineType: '2.5L 4-Cylinder',
      color: 'Pearl White',
      imageUrl: '/Assets/images/Generic-Car2.jpg',
      lastMaintenanceDate: '10/28/2025',
      nextMaintenanceDate: '11/25/2025',
      nextMaintenanceMileage: 50000,
      conditionIndicators: [
        {
          name: 'Oil Change',
          status: 'Good',
          icon: '💧',
          lastInspectionDate: '10/28/2025',
          nextInspectionDate: '11/25/2025',
          nextMileage: 50000,
          remaining: 5000
        },
        {
          name: 'Tire Rotation',
          status: 'Attention',
          icon: '🔴',
          lastInspectionDate: '9/15/2025',
          nextInspectionDate: '11/20/2025',
          nextMileage: 47000,
          remaining: 2000
        },
        {
          name: 'Battery Health',
          status: 'Good',
          icon: '🔋',
          lastInspectionDate: '8/10/2025',
          nextInspectionDate: '2/10/2026',
          nextMileage: 60000,
          remaining: 5000
        },
        {
          name: 'Air Filter',
          status: 'Urgent',
          icon: '🔺',
          lastInspectionDate: '9/15/2025',
          nextInspectionDate: '11/15/2025',
          nextMileage: 45500,
          remaining: 500
        },
        {
          name: 'Brake Pads',
          status: 'Good',
          icon: '🟢',
          lastInspectionDate: '9/15/2025',
          nextInspectionDate: '11/25/2025',
          nextMileage: 60000,
          remaining: 15000
        },
        {
          name: 'Coolant Check',
          status: 'Attention',
          icon: '🔧',
          lastInspectionDate: '7/20/2025',
          nextInspectionDate: '11/25/2025',
          nextMileage: 60000,
          remaining: 15000
        }
      ]
    };
  }

  updateMileage(miles: number): void {
    if (this.vehicle) {
      this.vehicle.currentMileage = miles;
    }
  }

  updateVehicleInfo(info: any): void {
    if (!this.vehicle) return;

    // Update only the header/basic fields coming from the API
    if (info.make !== undefined) this.vehicle.make = info.make;
    if (info.model !== undefined) this.vehicle.model = info.model;
    if (info.year !== undefined) this.vehicle.year = info.year;
    if (info.licensePlate !== undefined) this.vehicle.licensePlate = info.licensePlate;
    if (info.currentMileage !== undefined) this.vehicle.currentMileage = info.currentMileage;
    // If engineCapacity is present and you want to show it elsewhere, map it accordingly
    // Leave maintenance and condition indicators untouched
  }

  goBack(): void {
    this.router.navigate(['/my-vehicles']);
  }

  editCarAndIndicators(): void {
    if (this.vehicle?.id) {
      this.router.navigate(['/edit-car', this.vehicle.id]);
    }
  }

  onImageLoad(): void {
    this.imageLoaded = true;
    this.imageError = false;
  }

  onImageError(): void {
    this.imageLoaded = false;
    this.imageError = true;
    // Optionally provide a data-uri or leave placeholder to show
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Good':
        return 'status-good';
      case 'Attention':
        return 'status-attention';
      case 'Urgent':
        return 'status-urgent';
      default:
        return '';
    }
  }
}
