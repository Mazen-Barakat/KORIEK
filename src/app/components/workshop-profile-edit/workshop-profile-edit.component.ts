import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { Router, ActivatedRoute } from '@angular/router';
import { forkJoin, Observable, of } from 'rxjs';
import { finalize, map, switchMap, tap } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { WorkshopProfileService } from '../../services/workshop-profile.service';
import { ToastComponent } from '../shared/toast/toast.component';
import { CanComponentDeactivate } from '../../guards/unsaved-changes.guard';
import {
  WorkshopProfileData,
  WorkingHours,
  WorkshopLocation,
  WORKSHOP_TYPES,
  DAYS_OF_WEEK,
  GOVERNORATES,
  EGYPTIAN_CITIES_BY_GOVERNORATE,
} from '../../models/workshop-profile.model';

@Component({
  selector: 'app-workshop-profile-edit',
  standalone: true,
  imports: [CommonModule, FormsModule, ToastComponent],
  templateUrl: './workshop-profile-edit.component.html',
  styleUrls: ['./workshop-profile-edit.component.css'],
})
export class WorkshopProfileEditComponent
  implements OnInit, AfterViewInit, OnDestroy, CanComponentDeactivate
{
  // Leaflet map properties
  private map: L.Map | null = null;
  private marker: L.Marker | null = null;

  @ViewChild(ToastComponent) toast!: ToastComponent;

  profileData: WorkshopProfileData = {
    workshopName: '',
    workshopType: '',
    phoneNumber: '',
    NumbersOfTechnicians: 0,
    description: '',
    workingHours: this.initializeWorkingHours(),
    location: {
      governorate: 'Cairo',
      city: '',
      latitude: 30.0444,
      longitude: 31.2357,
      address: '',
    },
    galleryImages: [],
    isVerified: false,
    Rating: 0,
    Country: 'Egypt',
    VerificationStatus: 'Pending',
  };

  workshopTypes = WORKSHOP_TYPES;
  governorates = GOVERNORATES;
  daysOfWeek = DAYS_OF_WEEK;
  filteredCities: string[] = [];

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
  isFormDirty: boolean = false;

  // Backend base URL used to build absolute image URLs when backend returns relative paths
  private readonly backendBaseUrl = 'https://localhost:44316';

  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  constructor(
    private authService: AuthService,
    private workshopProfileService: WorkshopProfileService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Prefer workshop id from route query param (when navigating from profile view)
    const routeId =
      this.route.snapshot.queryParamMap.get('id') || this.route.snapshot.paramMap.get('id');
    const user = this.authService.getUser();
    this.workshopId = routeId || user?.id || user?.workshopId || '';

    if (this.workshopId) {
      this.loadWorkshopProfile();
    } else {
      this.errorMessage = 'Unable to identify workshop. Please log in again.';
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.isFormDirty) {
      $event.returnValue = 'You have unsaved changes. Do you want to leave this page?';
    }
  }

  canDeactivate(): boolean {
    if (this.isFormDirty) {
      return confirm('You have unsaved changes. Do you want to leave this page?');
    }
    return true;
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
    return DAYS_OF_WEEK.map((day) => ({
      day,
      openTime: '09:00',
      closeTime: '06:00',
      isClosed: day === 'Friday',
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
            NumbersOfTechnicians: data.numbersOfTechnicians || 0,
            description: data.description || '',
            workingHours: this.profileData.workingHours || this.initializeWorkingHours(),
            location: {
              governorate: data.governorate || 'Cairo',
              city: data.city || '',
              latitude: data.latitude || 30.0444,
              longitude: data.longitude || 31.2357,
              address: data.address || '',
            },
            galleryImages: this.profileData.galleryImages || [],
            LicenceImageUrl: data.licenceImageUrl || '',
            isVerified: data.verificationStatus === 'Verified',
            Rating: data.rating || 0,
            LogoImageUrl: data.logoImageUrl || '',
            Country: data.country || 'Egypt',
            VerificationStatus: data.verificationStatus || 'Pending',
            CreatedAt: data.createdAt ? new Date(data.createdAt) : undefined,
            UpdatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined,
            ApplicationUserId: data.applicationUserId || '',
          };

          // Load existing logo if available (ensure full absolute URL)
          if (this.profileData.LogoImageUrl) {
            this.profileData.LogoImageUrl = this.getFullBackendUrl(this.profileData.LogoImageUrl);
            this.logoPreviewUrl = this.profileData.LogoImageUrl;
          }

          // Load existing license if available (ensure full absolute URL)
          if (this.profileData.LicenceImageUrl) {
            this.profileData.LicenceImageUrl = this.getFullBackendUrl(
              this.profileData.LicenceImageUrl
            );
            this.licensePreviewUrl = this.profileData.LicenceImageUrl;
          }

          // Load working hours from API
          if (data.id) {
            this.loadWorkingHours(data.id);
          }

          // Populate cities based on governorate
          if (this.profileData.location.governorate) {
            this.onGovernorateChange(this.profileData.location.governorate);
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
        this.isFormDirty = false;
      },
      error: (error) => {
        console.error('Error loading workshop profile:', error);
        // If profile doesn't exist, use defaults (new profile)
        this.isLoading = false;
      },
    });
  }

  loadWorkingHours(workshopId: number): void {
    this.workshopProfileService.getWorkshopWorkingHours(workshopId).subscribe({
      next: (apiHours) => {
        console.log('Working Hours API Response:', apiHours);

        // Convert API format to display format
        const convertedHours = this.workshopProfileService.convertAPIWorkingHours(apiHours);

        // Update working hours ensuring all days are present
        const daysMap = new Map(convertedHours.map((h) => [h.day, h]));

        this.profileData.workingHours = DAYS_OF_WEEK.map((day) => {
          const existing = daysMap.get(day);
          return (
            existing || {
              day,
              openTime: '09:00',
              closeTime: '17:00',
              isClosed: false,
            }
          );
        });

        console.log('Working Hours loaded and converted:', this.profileData.workingHours);
      },
      error: (error) => {
        console.error('Error loading working hours:', error);
        // Keep default working hours if API fails
      },
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
    console.log('Current profileData:', this.profileData);

    if (!this.validateForm()) {
      return;
    }

    // Validate Egyptian phone number format
    const phoneRegex = /^(\+20|0)?1[0125]\d{8}$/;
    if (!phoneRegex.test(this.profileData.phoneNumber)) {
      this.errorMessage =
        'Phone number must be a valid Egyptian number (e.g., 01012345678 or +201012345678)';
      if (this.toast) {
        this.toast.show(this.errorMessage, 'error');
      }
      return;
    }

    // Validate number of technicians
    if (!this.profileData.NumbersOfTechnicians || this.profileData.NumbersOfTechnicians < 1) {
      this.errorMessage = 'Number of technicians must be at least 1';
      if (this.toast) {
        this.toast.show(this.errorMessage, 'error');
      }
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    // Build FormData for PUT request (backend expects [FromForm])
    const fd = new FormData();
    fd.append('Id', String(this.profileData.id ? Number(this.profileData.id) : 0));
    fd.append('Name', (this.profileData.workshopName || '').trim());
    fd.append('Description', (this.profileData.description || '').trim());
    fd.append('PhoneNumber', (this.profileData.phoneNumber || '').trim());
    fd.append('NumbersOfTechnicians', String(Number(this.profileData.NumbersOfTechnicians) || 1));
    fd.append('Country', (this.profileData.Country || 'Egypt').trim());
    fd.append('Governorate', (this.profileData.location?.governorate || '').trim());
    fd.append('City', (this.profileData.location?.city || '').trim());
    fd.append('Latitude', String(Number(this.profileData.location?.latitude) || 0));
    fd.append('Longitude', String(Number(this.profileData.location?.longitude) || 0));
    fd.append('WorkShopType', (this.profileData.workshopType || 'Independent').trim());
    fd.append('ApplicationUserId', (this.profileData.ApplicationUserId || '').trim());

    // If there are existing URL fields and no new file selected, include them as absolute URLs
    if (
      !this.selectedLicenseFile &&
      this.profileData.LicenceImageUrl &&
      this.profileData.LicenceImageUrl.trim()
    ) {
      const full = this.getFullBackendUrl(this.profileData.LicenceImageUrl);
      if (full) fd.append('LicenceImageUrl', full);
    }
    if (
      !this.selectedLogoFile &&
      this.profileData.LogoImageUrl &&
      this.profileData.LogoImageUrl.trim()
    ) {
      const full = this.getFullBackendUrl(this.profileData.LogoImageUrl);
      if (full) fd.append('LogoImageUrl', full);
    }

    // Append selected files using the backend DTO property names so [FromForm] binds them
    // The DTO defines: IFormFile? LicenceImage and IFormFile? LogoImage
    if (this.selectedLogoFile) {
      fd.append('LogoImage', this.selectedLogoFile, this.selectedLogoFile.name);
    }
    if (this.selectedLicenseFile) {
      fd.append('LicenceImage', this.selectedLicenseFile, this.selectedLicenseFile.name);
    }
    // Note: gallery images are uploaded via `uploadGalleryImages` endpoint elsewhere;
    // do not append them here unless the backend DTO expects a collection property.

    // Debug: dump FormData entries to console so we can verify keys/values
    try {
      for (const pair of (fd as any).entries()) {
        console.log('FormData entry:', pair[0], pair[1]);
      }
    } catch (e) {
      console.log('Unable to enumerate FormData entries for debug:', e);
    }

    // Log the operation
    console.log('=== SUBMITTING PROFILE UPDATE (FormData) ===');
    console.log('Original profileData:', this.profileData);
    console.log(
      'API Endpoint: PUT https://localhost:44316/api/WorkShopProfile/Update-WorkShop-Profile'
    );

    // Send PUT request with FormData
    this.workshopProfileService.updateMyWorkshopProfile(fd).subscribe({
      next: (response) => {
        // If there are working hours, update them after successful profile save
        if (
          this.profileData.workingHours &&
          this.profileData.workingHours.length > 0 &&
          this.profileData.id
        ) {
          const apiWorkingHours = this.workshopProfileService.convertToAPIWorkingHours(
            this.profileData.workingHours,
            parseInt(this.profileData.id)
          );

          this.workshopProfileService.updateWorkshopWorkingHours(apiWorkingHours).subscribe({
            next: () => this.completeProfileUpdate(),
            error: (err: any) => {
              console.error('Error updating working hours:', err);
              this.completeProfileUpdate();
              if (this.toast) {
                this.toast.show(
                  'Profile updated, but working hours may not have saved. Please try again.',
                  'warning'
                );
              }
            },
          });
        } else {
          this.completeProfileUpdate();
        }
      },
      error: (err: any) => {
        this.isLoading = false;
        console.error('Error updating workshop profile:', err);
        console.error('Validation errors:', err.error?.errors);
        console.error('Error details:', JSON.stringify(err.error, null, 2));

        const errorMessages: string[] = [];
        if (err.error && err.error.errors) {
          const validationErrors = err.error.errors;
          for (const key in validationErrors) {
            if (Object.prototype.hasOwnProperty.call(validationErrors, key)) {
              const messages = Array.isArray(validationErrors[key])
                ? validationErrors[key]
                : [validationErrors[key]];
              errorMessages.push(`${key}: ${messages.join(', ')}`);
            }
          }
        }

        if (errorMessages.length > 0) {
          this.errorMessage = 'Please correct the following:\n' + errorMessages.join('\n');
        } else if (err.error?.title) {
          this.errorMessage = err.error.title;
        } else if (err.error?.message) {
          this.errorMessage = err.error.message;
        } else if (err.message) {
          this.errorMessage = err.message;
        } else {
          this.errorMessage = 'Failed to update profile. Please try again.';
        }

        if (this.toast) {
          this.toast.show(this.errorMessage, 'error');
        }
      },
    });
  }

  completeProfileUpdate(): void {
    this.isLoading = false;
    this.successMessage = 'Workshop profile updated successfully!';
    this.isFormDirty = false;

    if (this.toast) {
      this.toast.show('Workshop profile updated successfully!', 'success');
    }

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
    if (!this.profileData.location.governorate || !this.profileData.location.governorate.trim()) {
      this.errorMessage = 'Governorate is required';
      return false;
    }
    if (!this.profileData.location.city.trim()) {
      this.errorMessage = 'City is required';
      return false;
    }
    if (!this.profileData.location.latitude || !this.profileData.location.longitude) {
      this.errorMessage = 'Please select your location on the map';
      return false;
    }
    return true;
  }

  toggleDayClosed(index: number): void {
    this.profileData.workingHours[index].isClosed = !this.profileData.workingHours[index].isClosed;
    this.isFormDirty = true;
  }

  setAllDaysClosed(): void {
    this.profileData.workingHours.forEach((day) => (day.isClosed = true));
    this.isFormDirty = true;
  }

  setAllDaysOpen(): void {
    this.profileData.workingHours.forEach((day) => (day.isClosed = false));
    this.isFormDirty = true;
  }

  onGovernorateChange(governorate: string): void {
    this.filteredCities = EGYPTIAN_CITIES_BY_GOVERNORATE[governorate] || [];

    // Validate if current city exists in the filtered list
    if (
      this.profileData.location.city &&
      !this.filteredCities.includes(this.profileData.location.city)
    ) {
      if (this.toast) {
        this.toast.show(
          `City "${this.profileData.location.city}" is not in the list for ${governorate}. Please select a valid city.`,
          'warning'
        );
      }
    }

    this.isFormDirty = true;
  }

  getStarArray(rating: number): boolean[] {
    const stars: boolean[] = [];
    const roundedRating = Math.round(rating);
    for (let i = 0; i < 5; i++) {
      stars.push(i < roundedRating);
    }
    return stars;
  }

  validateImageFile(file: File, allowPdf: boolean = false): { valid: boolean; error?: string } {
    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File size must be less than ${this.MAX_FILE_SIZE / (1024 * 1024)}MB`,
      };
    }

    // Check file type
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    const validTypes = allowPdf ? [...validImageTypes, 'application/pdf'] : validImageTypes;

    if (!validTypes.includes(file.type)) {
      return {
        valid: false,
        error: allowPdf
          ? 'Only JPG, PNG, and PDF files are allowed'
          : 'Only JPG and PNG files are allowed',
      };
    }

    return { valid: true };
  }

  markFormDirty(): void {
    this.isFormDirty = true;
  }

  onGalleryFilesSelected(event: any): void {
    const files: File[] = Array.from(event.target.files);
    this.selectedGalleryFiles.push(...files);

    // Create preview URLs
    files.forEach((file) => {
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
        },
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
    if (!file) return;

    // Validate file
    const validation = this.validateImageFile(file, false);
    if (!validation.valid) {
      this.errorMessage = validation.error || 'Invalid file';
      if (this.toast) {
        this.toast.show(validation.error || 'Invalid file', 'error');
      }
      return;
    }

    this.selectedLogoFile = file;
    // Clear any previous URL value so we send the file instead of a URL
    if (this.profileData.LogoImageUrl) {
      this.profileData.LogoImageUrl = '';
    }
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.logoPreviewUrl = e.target.result;
    };
    reader.readAsDataURL(file);
    this.errorMessage = '';
    this.isFormDirty = true;
  }

  onLicenseFileSelected(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file (images only, no PDF)
    const validation = this.validateImageFile(file, false);
    if (!validation.valid) {
      this.errorMessage = validation.error || 'Invalid file';
      if (this.toast) {
        this.toast.show(validation.error || 'Invalid file', 'error');
      }
      return;
    }

    // Only show preview for image files
    if (file.type.startsWith('image/')) {
      this.selectedLicenseFile = file;
      // Clear any previous URL so we won't send an invalid relative URL
      if (this.profileData.LicenceImageUrl) {
        this.profileData.LicenceImageUrl = '';
      }
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.licensePreviewUrl = e.target.result;
      };
      reader.readAsDataURL(file);
      this.errorMessage = '';
      this.isFormDirty = true;
    }
  }

  /**
   * Ensure a backend absolute URL for preview and validation. If path is already absolute, return as-is.
   */
  private getFullBackendUrl(path: string | undefined | null): string {
    if (!path) return '';
    const trimmed = path.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    // If server returned a relative path like '/uploads/..', prepend backend base
    if (trimmed.startsWith('/')) {
      return `${this.backendBaseUrl}${trimmed}`;
    }
    return `${this.backendBaseUrl}/${trimmed}`;
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

    this.workshopProfileService
      .uploadBusinessLicense(this.workshopId, this.selectedLicenseFile)
      .subscribe({
        next: (response) => {
          console.log('Business license uploaded successfully');
          if (response.data && response.data.licenseUrl) {
            this.profileData.LicenceImageUrl = response.data.licenseUrl;
          }
        },
        error: (error) => {
          console.error('Error uploading business license:', error);
        },
      });
  }

  private initializeMap(): void {
    const mapElement = document.getElementById('map');
    if (!mapElement) {
      console.error('Map container element not found');
      return;
    }

    // Get initial coordinates from profile or use Cairo as default
    let lat = this.profileData.location.latitude || 0;
    let lng = this.profileData.location.longitude || 0;

    // If no coordinates exist, try to get user's location
    if (lat === 0 || lng === 0) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            // Success - use user's location
            lat = position.coords.latitude;
            lng = position.coords.longitude;
            this.profileData.location.latitude = lat;
            this.profileData.location.longitude = lng;

            // Initialize map with user's location
            this.createMap(lat, lng);

            if (this.toast) {
              this.toast.show('Location detected successfully', 'success');
            }
          },
          (error) => {
            // Error or denied - fall back to Cairo
            console.error('Geolocation error:', error);
            lat = 30.0444;
            lng = 31.2357;
            this.profileData.location.latitude = lat;
            this.profileData.location.longitude = lng;

            // Initialize map with Cairo default
            this.createMap(lat, lng);

            if (this.toast) {
              this.toast.show(
                'Location access denied. Please click the map to set your location.',
                'warning'
              );
            }
          }
        );
        return; // Wait for geolocation response
      } else {
        // Geolocation not supported - use Cairo default
        lat = 30.0444;
        lng = 31.2357;
      }
    }

    // Initialize map with existing or default coordinates
    this.createMap(lat, lng);
  }

  private createMap(lat: number, lng: number): void {
    // Initialize Leaflet map
    this.map = L.map('map').setView([lat, lng], 13);

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
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

    // Create new draggable marker at location
    this.marker = L.marker([lat, lng], {
      draggable: true,
      icon: L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      }),
    }).addTo(this.map);

    // Add popup to marker
    this.marker
      .bindPopup(
        `<strong>${this.profileData.workshopName || 'Workshop Location'}</strong><br>` +
          `Lat: ${lat.toFixed(4)}<br>Lng: ${lng.toFixed(4)}`
      )
      .openPopup();

    // Add dragend event listener
    this.marker.on('dragend', (event: L.DragEndEvent) => {
      this.onMarkerDragEnd(event);
    });
  }

  onMarkerDragEnd(event: L.DragEndEvent): void {
    const marker = event.target;
    const position = marker.getLatLng();

    // Update location coordinates
    this.profileData.location.latitude = position.lat;
    this.profileData.location.longitude = position.lng;

    // Update popup content
    marker
      .bindPopup(
        `<strong>${this.profileData.workshopName || 'Workshop Location'}</strong><br>` +
          `Lat: ${position.lat.toFixed(4)}<br>Lng: ${position.lng.toFixed(4)}`
      )
      .openPopup();

    this.isFormDirty = true;
  }

  onMapClick(lat: number, lng: number): void {
    // Update location coordinates in profile data
    this.profileData.location.latitude = lat;
    this.profileData.location.longitude = lng;

    // Update marker position
    this.updateMarker(lat, lng);

    this.isFormDirty = true;
  }
}
