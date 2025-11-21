import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { Router, ActivatedRoute } from '@angular/router';
import { forkJoin, Observable, of } from 'rxjs';
import { finalize, map, switchMap, tap } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { WorkshopProfileService } from '../../services/workshop-profile.service';
import { 
  WorkshopProfileData, 
  WorkingHours, 
  WorkshopLocation, 
  WORKSHOP_TYPES, 
  DAYS_OF_WEEK,
  GOVERNORATES 
} from '../../models/workshop-profile.model';

@Component({
  selector: 'app-workshop-profile-edit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './workshop-profile-edit.component.html',
  styleUrls: ['./workshop-profile-edit.component.css']
})
export class WorkshopProfileEditComponent implements OnInit, AfterViewInit, OnDestroy {
  // Leaflet map properties
  private map: L.Map | null = null;
  private marker: L.Marker | null = null;
  profileData: WorkshopProfileData = {
    workshopName: '',
    workshopType: '',
    phoneNumber: '',
    technicianCount: 0,
    description: '',
    workingHours: this.initializeWorkingHours(),
    location: {
      governorate: 'Cairo',
      city: '',
      latitude: 30.0444,
      longitude: 31.2357,
      address: ''
    },
    galleryImages: [],
    isVerified: false,
    rating: 0
  };

  workshopTypes = WORKSHOP_TYPES;
  governorates = GOVERNORATES;
  daysOfWeek = DAYS_OF_WEEK;
  
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  workshopId: string = '';
  selectedGalleryFiles: File[] = [];
  galleryPreviewUrls: string[] = [];
  selectedLicenseFile: File | null = null;
  licensePreviewUrl: string = '';
  selectedLogoFile: File | null = null;
  logoPreviewUrl: string = '';

  constructor(
    private authService: AuthService,
    private workshopProfileService: WorkshopProfileService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Prefer workshop id from route query param (when navigating from profile view)
    const routeId = this.route.snapshot.queryParamMap.get('id') || this.route.snapshot.paramMap.get('id');
    const user = this.authService.getUser();
    this.workshopId = routeId || user?.id || user?.workshopId || '';

    if (this.workshopId) {
      this.loadWorkshopProfile();
    } else {
      this.errorMessage = 'Unable to identify workshop. Please log in again.';
    }
  }

  ngAfterViewInit(): void {
    // Initialize map after a short delay to ensure DOM is ready
    setTimeout(() => {
      this.initializeMap();
    }, 100);
  }

  ngOnDestroy(): void {
    // Clean up map instance to prevent memory leaks
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  private initializeWorkingHours(): WorkingHours[] {
    return DAYS_OF_WEEK.map(day => ({
      day,
      openTime: '09:00',
      closeTime: '06:00',
      isClosed: day === 'Friday'
    }));
  }

  loadWorkshopProfile(): void {
    this.isLoading = true;
    // Use the WorkShopProfile controller to get the current user's workshop profile
    this.workshopProfileService.getMyWorkshopProfile().subscribe({
      next: (response) => {
        console.log('Workshop Profile API Response:', response);
        const data = response?.data ?? response;
        
        if (data && data.id) {
          // Map backend fields to frontend model
          this.profileData = {
            id: String(data.id),
            workshopName: data.name || '',
            workshopType: data.workShopType || '',
            phoneNumber: data.phoneNumber || '',
            technicianCount: data.numbersOfTechnicians || 0,
            description: data.description || '',
            workingHours: this.profileData.workingHours || this.initializeWorkingHours(),
            location: {
              governorate: data.governorate || 'Cairo',
              city: data.city || '',
              latitude: data.latitude || 30.0444,
              longitude: data.longitude || 31.2357,
              address: data.address || ''
            },
            galleryImages: this.profileData.galleryImages || [],
            businessLicense: data.licenceImageUrl || '',
            isVerified: data.verificationStatus === 'Verified',
            rating: data.rating || 0,
            logoUrl: data.logoImageUrl || ''
          };
          
          // Load existing logo if available
          if (this.profileData.logoUrl) {
            this.logoPreviewUrl = this.profileData.logoUrl;
          }
          
          // Reinitialize map with loaded coordinates
          if (this.map) {
            const lat = this.profileData.location.latitude;
            const lng = this.profileData.location.longitude;
            this.map.setView([lat, lng], 13);
            this.updateMarker(lat, lng);
          }
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading workshop profile:', error);
        // If profile doesn't exist, use defaults (new profile)
        this.isLoading = false;
      }
    });
  }

  goToProfile(): void {
    if (this.workshopId) {
      this.router.navigate([`/workshop-profile/${this.workshopId}`]);
    } else {
      // Fallback: navigate to workshops list if ID missing
      this.router.navigate(['/workshops']);
    }
  }

  onSubmit(): void {
    if (!this.validateForm()) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    // Build multipart/form-data body expected by the backend
    const formData = new FormData();

    // Map fields from our model to API expected names
    if (this.profileData.id) formData.append('Id', this.profileData.id);
    formData.append('Name', this.profileData.workshopName || '');
    formData.append('Description', this.profileData.description || '');
    formData.append('PhoneNumber', this.profileData.phoneNumber || '');
    formData.append('NumbersOfTechnicians', String(this.profileData.technicianCount || 0));
    // Country is not present in the model; default to 'Egypt' unless provided elsewhere
    formData.append('Country', 'Egypt');
    formData.append('Governorate', this.profileData.location?.governorate || '');
    formData.append('City', this.profileData.location?.city || '');
    formData.append('Latitude', String(this.profileData.location?.latitude ?? 0));
    formData.append('Longitude', String(this.profileData.location?.longitude ?? 0));
    formData.append('WorkShopType', this.profileData.workshopType || '');

    // Include existing URLs if available
    if (this.profileData.businessLicense) formData.append('LicenceImageUrl', this.profileData.businessLicense);
    if (this.profileData.logoUrl) formData.append('LogoImageUrl', this.profileData.logoUrl);

    // Attach files if selected
    if (this.selectedLicenseFile) {
      formData.append('LicenceImage', this.selectedLicenseFile, this.selectedLicenseFile.name);
    }
    // If logo file was selected but already uploaded immediately, backend may already have URL; include file only if selectedLogoFile is present
    if (this.selectedLogoFile) {
      formData.append('LogoImage', this.selectedLogoFile, this.selectedLogoFile.name);
    }

    // ApplicationUserId: try to use current user id from AuthService
    const user = this.authService.getUser();
    if (user && user.id) {
      formData.append('ApplicationUserId', user.id);
    }

    // Call the new endpoint (multipart form)
    this.workshopProfileService.updateMyWorkshopProfile(formData)
      .pipe(
        finalize(() => this.isLoading = false)
      )
      .subscribe({
        next: (response) => {
          this.successMessage = 'Workshop profile updated successfully!';
          // Reset file selections after successful save
          this.selectedLogoFile = null;
          this.selectedGalleryFiles = [];
          this.galleryPreviewUrls = [];
          this.selectedLicenseFile = null;

          setTimeout(() => {
            // After successful update, reload profile to reflect any server-side changes
            this.loadWorkshopProfile();
            this.router.navigate([`/workshop-profile/${this.workshopId}`]);
          }, 1200);
        },
        error: (error) => {
          console.error('Error updating workshop profile:', error);
          this.errorMessage = error.error?.message || 'Failed to update profile. Please try again.';
        }
      });
  }

  validateForm(): boolean {
    if (!this.profileData.workshopName.trim()) {
      this.errorMessage = 'Workshop name is required';
      return false;
    }
    if (!this.profileData.workshopType) {
      this.errorMessage = 'Workshop type is required';
      return false;
    }
    if (!this.profileData.phoneNumber.trim()) {
      this.errorMessage = 'Phone number is required';
      return false;
    }
    if (!this.profileData.location.city.trim()) {
      this.errorMessage = 'City is required';
      return false;
    }
    return true;
  }

  toggleDayClosed(index: number): void {
    this.profileData.workingHours[index].isClosed = !this.profileData.workingHours[index].isClosed;
  }

  setAllDaysClosed(): void {
    this.profileData.workingHours.forEach(day => day.isClosed = true);
  }

  setAllDaysOpen(): void {
    this.profileData.workingHours.forEach(day => day.isClosed = false);
  }

  onGalleryFilesSelected(event: any): void {
    const files: File[] = Array.from(event.target.files);
    this.selectedGalleryFiles.push(...files);

    // Create preview URLs
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.galleryPreviewUrls.push(e.target.result);
      };
      reader.readAsDataURL(file);
    });
  }

  removeGalleryPreview(index: number): void {
    this.selectedGalleryFiles.splice(index, 1);
    this.galleryPreviewUrls.splice(index, 1);
  }

  removeExistingGalleryImage(imageUrl: string): void {
    if (confirm('Are you sure you want to remove this image?')) {
      this.workshopProfileService.deleteGalleryImage(this.workshopId, imageUrl).subscribe({
        next: () => {
          const index = this.profileData.galleryImages.indexOf(imageUrl);
          if (index > -1) {
            this.profileData.galleryImages.splice(index, 1);
          }
        },
        error: (error) => {
          console.error('Error removing image:', error);
          this.errorMessage = 'Failed to remove image';
        }
      });
    }
  }

  private buildUploadTasks(): Observable<any>[] {
    const tasks: Observable<any>[] = [];

    const logoTask = this.createLogoUploadTask();
    if (logoTask) {
      tasks.push(logoTask);
    }

    const galleryTask = this.createGalleryUploadTask();
    if (galleryTask) {
      tasks.push(galleryTask);
    }

    const licenseTask = this.createLicenseUploadTask();
    if (licenseTask) {
      tasks.push(licenseTask);
    }

    return tasks;
  }

  onLogoFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      this.selectedLogoFile = file;
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.logoPreviewUrl = e.target.result;
      };
      reader.readAsDataURL(file);
      this.errorMessage = '';
      
      // Upload logo immediately for instant persistence
      this.uploadLogoImmediately(file);
    } else {
      this.errorMessage = 'Please select a valid image file';
    }
  }

  private uploadLogoImmediately(file: File): void {
    this.workshopProfileService.uploadWorkshopLogo(this.workshopId, file).subscribe({
      next: (response) => {
        const logoUrl = response?.data?.logoUrl ?? response?.logoUrl;
        if (logoUrl) {
          this.profileData.logoUrl = logoUrl;
          this.logoPreviewUrl = logoUrl;
          console.log('Logo uploaded successfully:', logoUrl);
        }
        this.selectedLogoFile = null;
      },
      error: (error) => {
        console.error('Error uploading logo:', error);
        this.errorMessage = 'Failed to upload logo. Please try again.';
      }
    });
  }

  onLicenseFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedLicenseFile = file;
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.licensePreviewUrl = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  private createLogoUploadTask(): Observable<any> | null {
    // Logo is uploaded immediately on selection, so skip here
    return null;
  }

  private createGalleryUploadTask(): Observable<any> | null {
    if (this.selectedGalleryFiles.length === 0) {
      return null;
    }

    const filesToUpload = [...this.selectedGalleryFiles];

    return this.workshopProfileService.uploadGalleryImages(this.workshopId, filesToUpload).pipe(
      tap((response) => {
        const uploadedUrls = response?.data?.imageUrls ?? response?.imageUrls;
        if (Array.isArray(uploadedUrls) && uploadedUrls.length > 0) {
          this.profileData.galleryImages.push(...uploadedUrls);
        }

        this.selectedGalleryFiles = [];
        this.galleryPreviewUrls = [];
      })
    );
  }

  private createLicenseUploadTask(): Observable<any> | null {
    if (!this.selectedLicenseFile) {
      return null;
    }

    const licenseToUpload = this.selectedLicenseFile;

    return this.workshopProfileService.uploadBusinessLicense(this.workshopId, licenseToUpload).pipe(
      tap(() => {
        this.selectedLicenseFile = null;
      })
    );
  }

  uploadBusinessLicense(): void {
    if (!this.selectedLicenseFile) return;

    this.workshopProfileService.uploadBusinessLicense(this.workshopId, this.selectedLicenseFile).subscribe({
      next: (response) => {
        console.log('Business license uploaded successfully');
        if (response.data && response.data.licenseUrl) {
          this.profileData.businessLicense = response.data.licenseUrl;
        }
      },
      error: (error) => {
        console.error('Error uploading business license:', error);
      }
    });
  }

  private initializeMap(): void {
    const mapElement = document.getElementById('map');
    if (!mapElement) {
      console.error('Map container element not found');
      return;
    }

    // Get initial coordinates from profile or use Cairo as default
    const lat = this.profileData.location.latitude || 30.0444;
    const lng = this.profileData.location.longitude || 31.2357;

    // Initialize Leaflet map
    this.map = L.map('map').setView([lat, lng], 13);

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    // Add marker at current location
    this.updateMarker(lat, lng);

    // Add click event listener to map
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      this.onMapClick(lat, lng);
    });
  }

  private updateMarker(lat: number, lng: number): void {
    if (!this.map) return;

    // Remove existing marker if present
    if (this.marker) {
      this.map.removeLayer(this.marker);
    }

    // Create new marker at clicked location
    this.marker = L.marker([lat, lng], {
      icon: L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      })
    }).addTo(this.map);

    // Add popup to marker
    this.marker.bindPopup(
      `<strong>${this.profileData.workshopName || 'Workshop Location'}</strong><br>` +
      `Lat: ${lat.toFixed(4)}<br>Lng: ${lng.toFixed(4)}`
    ).openPopup();
  }

  onMapClick(lat: number, lng: number): void {
    // Update location coordinates in profile data
    this.profileData.location.latitude = lat;
    this.profileData.location.longitude = lng;

    // Update marker position
    this.updateMarker(lat, lng);
  }
}
