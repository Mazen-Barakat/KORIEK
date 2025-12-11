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
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { forkJoin, Observable, of, Subscription, throwError, TimeoutError } from 'rxjs';
import { finalize, map, switchMap, tap, filter, timeout, catchError } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import {
  GeolocationService,
  GeolocationPosition,
  GeolocationError,
} from '../../services/geolocation.service';
import { ChangeDetectorRef, NgZone } from '@angular/core';
import { take } from 'rxjs/operators';
import { HttpEventType } from '@angular/common/http';
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
  hasUnsavedWorkingHours: boolean = false;
  showDeleteWorkingHourModal: boolean = false;
  deleteWorkingHourIndex: number = -1;
  isDeletingWorkingHour: boolean = false;
  // Image delete modal state
  showDeleteImageModal: boolean = false;
  imagePendingDelete: { id?: number; url: string } | null = null;
  isDeletingImage: boolean = false;
  // Upload progress state for explicit Upload button
  uploadInProgress: boolean = false;
  uploadProgress: number = 0;
  uploadError: string = '';

  // Backend base URL used to build absolute image URLs when backend returns relative paths
  private readonly backendBaseUrl = 'https://korik-demo.runasp.net';

  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly STORAGE_KEY = 'workshop_profile_data';
  private routerEventsSub: Subscription | null = null;

  constructor(
    private authService: AuthService,
    private workshopProfileService: WorkshopProfileService,
    private router: Router,
    private route: ActivatedRoute,
    private geolocationService: GeolocationService,
    private cd: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  // Open modal helper that ensures the primary button receives focus for keyboard users
  openLocationModal(): void {
    this.showLocationModal = true;
    // Give browser a moment to render modal then focus the allow button
    setTimeout(() => {
      try {
        const el = document.getElementById('allow-location-btn') as HTMLElement | null;
        if (el) el.focus();
      } catch (e) {
        // ignore
      }
    }, 120);
  }

  // Location modal state (moved from dashboard)
  showLocationModal: boolean = false;
  locationPermissionDenied: boolean = false;
  locationError: string = '';
  isLoadingLocation: boolean = false;
  workshopLocation: GeolocationPosition | null = null;
  // Developer-only control to show a visible button for triggering the location modal
  showDevButton: boolean = false;
  // When true, prevent automatic navigation after location detection/save
  preventRedirectAfterLocation: boolean = false;

  ngOnInit(): void {
    // Prefer workshop id from route query param (when navigating from profile view)
    const routeId =
      this.route.snapshot.queryParamMap.get('id') || this.route.snapshot.paramMap.get('id');
    const user = this.authService.getUser();
    this.workshopId = routeId || user?.id || user?.workshopId || '';

    // Enable dev button if query param dev=1 or dev_modal=1, or if localStorage flag is set
    const devParam =
      this.route.snapshot.queryParamMap.get('dev') ||
      this.route.snapshot.queryParamMap.get('dev_modal');
    this.showDevButton =
      devParam === '1' || localStorage.getItem('dev_show_location_button') === 'true';

    if (this.workshopId) {
      this.loadWorkshopProfile();

      // Also reload profile when user navigates back to this route (handles route reuse)
      try {
        this.routerEventsSub = this.router.events
          .pipe(
            filter((e) => e instanceof NavigationEnd),
            filter((e: any) => {
              const nav = e as NavigationEnd;
              const url = (nav && (nav.urlAfterRedirects || nav.url)) || '';
              // Only reload when navigating to the workshop-profile-edit route
              return url.indexOf('/workshop-profile-edit') !== -1;
            })
          )
          .subscribe(() => {
            // Refresh profile data so images and previews are applied immediately
            this.loadWorkshopProfile();
          });
      } catch (e) {
        // ignore
      }
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
    // Allow navigation without alert
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
    // Unsubscribe from router events
    try {
      if (this.routerEventsSub) {
        this.routerEventsSub.unsubscribe();
        this.routerEventsSub = null;
      }
    } catch (e) {}
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
    // Ensure loading state is false when component initializes
    this.isLoading = false;

    // Try to load data from localStorage first
    const cachedData = this.loadFromLocalStorage();
    if (cachedData) {
      console.log('Loading profile data from localStorage');
      this.applyProfileData(cachedData);
    }

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
            // Load gallery images (photos) using WorkShopPhoto controller
            try {
              this.loadGalleryImages(Number(data.id));
            } catch (e) {
              console.warn('Failed to load gallery images:', e);
            }
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

          // Save to localStorage for persistence across reloads
          this.saveToLocalStorage();
          // Ensure the view updates after loading and saving profile data
          try {
            this.ngZone.run(() => this.cd.detectChanges());
          } catch (e) {}
        }
        // Don't touch isLoading here - it's only for the save button
        // this.isLoading = false;
        this.isFormDirty = false;
      },
      error: (error) => {
        console.error('Error loading workshop profile:', error);
        // If profile doesn't exist, use defaults (new profile)
        // Don't touch isLoading here
        // this.isLoading = false;
      },
    });
  }

  loadWorkingHours(workshopId: number): void {
    console.log('🔄 Loading working hours for workshop:', workshopId);

    this.workshopProfileService.getWorkshopWorkingHours(workshopId).subscribe({
      next: (apiHours) => {
        console.log('Working Hours API Response:', apiHours);
        console.log('Number of hours returned from API:', apiHours?.length || 0);

        // Check if backend filtered out closed days
        if (apiHours && apiHours.length > 0) {
          console.log(
            'Days returned:',
            apiHours.map((h: any) => `${h.day} (isClosed: ${h.isClosed})`)
          );
        }

        // Use NgZone to ensure Angular picks up the change
        this.ngZone.run(() => {
          // Clear existing working hours first
          this.profileData.workingHours = [];
          console.log('🧹 Cleared old working hours');

          // Convert API format to display format
          const convertedHours = this.workshopProfileService.convertAPIWorkingHours(apiHours || []);

          // Sort by day of week (Monday first)
          convertedHours.sort((a, b) => (a.dayNumber || 0) - (b.dayNumber || 0));

          this.profileData.workingHours = convertedHours;
          console.log('✅ Working Hours loaded and converted:', this.profileData.workingHours);
          console.log('UI should now show', this.profileData.workingHours.length, 'days');

          // Update available days after loading
          this.updateAvailableDays();

          // Mark as saved since loaded from database
          this.hasUnsavedWorkingHours = false;

          // Force change detection
          this.cd.detectChanges();
        });
      },
      error: (error) => {
        console.error('Error loading working hours:', error);
        // Use NgZone for error case too
        this.ngZone.run(() => {
          // Start with empty array for new workshops
          this.profileData.workingHours = [];
          this.cd.detectChanges();
        });
      },
    });
  }

  goToProfile(): void {
    // Use centralized navigation helper so we consistently respect
    // `preventRedirectAfterLocation` across this component.
    if (this.workshopId) {
      this.navigateToProfileIfAllowed(this.workshopId);
    } else {
      // Fallback: navigate to workshops list if ID missing
      if (this.preventRedirectAfterLocation) {
        // reset flag and stay on page
        this.preventRedirectAfterLocation = false;
        return;
      }
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
    // Backup guard: if request hangs for some reason, ensure UI recovers
    const backupTimeout = setTimeout(() => {
      if (this.isLoading) {
        this.isLoading = false;
        if (this.toast) this.toast.show('Request timed out. Please try again.', 'error');
        console.warn('Profile update backup timeout triggered; UI reset.');
      }
    }, 30000);

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
      'API Endpoint: PUT https://korik-demo.runasp.net/api/WorkShopProfile/Update-WorkShop-Profile'
    );

    // Send PUT request with FormData
    this.workshopProfileService
      .updateMyWorkshopProfile(fd)
      .pipe(
        finalize(() => {
          // Run reset inside Angular zone so change detection runs reliably.
          this.ngZone.run(() => {
            try {
              clearTimeout(backupTimeout);
            } catch {}
            this.isLoading = false;
            this.cd.detectChanges();
          });
        })
      )
      .subscribe({
        next: (response) => {
          console.log('Profile update response received:', response);
          // Always call completeProfileUpdate to reset the UI state
          this.completeProfileUpdate();
        },
        error: (err: any) => {
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

          // Ensure UI updates occur inside Angular zone and detect changes after toast
          this.ngZone.run(() => {
            this.isLoading = false;
            if (this.toast) this.toast.show(this.errorMessage, 'error');
            this.cd.detectChanges();
          });
        },
      });
  }

  /**
   * Helper to send current profileData to the Update-WorkShop-Profile endpoint
   * using multipart/form-data. This method bypasses form validation and is
   * intended for programmatic updates (e.g., invoked by a button or test).
   */
  updateProfileToApi(): void {
    try {
      const fd = new FormData();
      fd.append('Id', String(this.profileData.id ? Number(this.profileData.id) : 0));
      fd.append('Name', (this.profileData.workshopName || '').trim());
      fd.append('Description', (this.profileData.description || '').trim());
      fd.append('PhoneNumber', (this.profileData.phoneNumber || '').trim());
      fd.append('NumbersOfTechnicians', String(Number(this.profileData.NumbersOfTechnicians) || 0));
      fd.append('Country', (this.profileData.Country || 'Egypt').trim());
      fd.append('Governorate', (this.profileData.location?.governorate || '').trim());
      fd.append('City', (this.profileData.location?.city || '').trim());
      fd.append('Latitude', String(Number(this.profileData.location?.latitude) || 0));
      fd.append('Longitude', String(Number(this.profileData.location?.longitude) || 0));
      fd.append('WorkShopType', (this.profileData.workshopType || 'Independent').trim());
      fd.append('ApplicationUserId', (this.profileData.ApplicationUserId || '').trim());

      // Include existing URL fields if no new file selected
      if (!this.selectedLicenseFile && this.profileData.LicenceImageUrl) {
        fd.append('LicenceImageUrl', this.getFullBackendUrl(this.profileData.LicenceImageUrl));
      }
      if (!this.selectedLogoFile && this.profileData.LogoImageUrl) {
        fd.append('LogoImageUrl', this.getFullBackendUrl(this.profileData.LogoImageUrl));
      }

      // Append files if selected (backend expects IFormFile properties)
      if (this.selectedLogoFile) {
        fd.append('LogoImage', this.selectedLogoFile, this.selectedLogoFile.name);
      }
      if (this.selectedLicenseFile) {
        fd.append('LicenceImage', this.selectedLicenseFile, this.selectedLicenseFile.name);
      }

      console.log('Sending profile update to API (manual):', fd);
      this.isLoading = true;
      this.workshopProfileService.updateMyWorkshopProfile(fd).subscribe({
        next: (res) => {
          console.log('Profile update response:', res);
          this.isLoading = false;
          this.isFormDirty = false;
          if (this.toast) this.toast.show('Profile updated via API.', 'success');
        },
        error: (err) => {
          console.error('Error updating profile via API:', err);
          this.isLoading = false;
          if (this.toast) this.toast.show('Failed to update profile. See console.', 'error');
        },
      });
    } catch (e) {
      console.error('Failed to prepare profile update:', e);
      if (this.toast) this.toast.show('Failed to prepare request.', 'error');
    }
  }

  completeProfileUpdate(): void {
    this.isLoading = false;
    this.successMessage = 'Workshop profile updated successfully!';
    this.isFormDirty = false;

    if (this.toast) {
      this.toast.show('Workshop profile updated successfully!', 'success', 2000);
    }

    // Ensure UI updates immediately after showing toast
    try {
      this.ngZone.run(() => this.cd.detectChanges());
    } catch (e) {}
    // Save updated data to localStorage
    this.saveToLocalStorage();

    // Reset file selections after successful save
    this.selectedLogoFile = null;
    this.selectedGalleryFiles = [];
    this.galleryPreviewUrls = [];
    this.selectedLicenseFile = null;

    // If location flow requested we should keep user on the edit page
    if (this.preventRedirectAfterLocation) {
      // reset the flag so future saves behave normally
      this.preventRedirectAfterLocation = false;
      return;
    }

    setTimeout(() => {
      try {
        this.ngZone.run(() => {
          this.navigateToProfileIfAllowed(this.workshopId);
          try {
            this.cd.detectChanges();
          } catch (e) {}
        });
      } catch (e) {}
    }, 2000);
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

  isAddingWorkingHour = false;
  isSavingWorkingHours = false;
  newWorkingHour: any = {
    dayNumber: 0,
    dayName: 'Monday',
    openTime: '09:00',
    closeTime: '17:00',
    isClosed: false,
  };
  availableDays: any[] = [];

  daysWithNumbers = [
    { number: 0, name: 'Monday' },
    { number: 1, name: 'Tuesday' },
    { number: 2, name: 'Wednesday' },
    { number: 3, name: 'Thursday' },
    { number: 4, name: 'Friday' },
    { number: 5, name: 'Saturday' },
    { number: 6, name: 'Sunday' },
  ];

  updateAvailableDays(): void {
    const usedDayNumbers = this.profileData.workingHours.map((h: any) => h.dayNumber);
    this.availableDays = this.daysWithNumbers.filter((day) => !usedDayNumbers.includes(day.number));
    if (this.availableDays.length > 0) {
      this.newWorkingHour.dayNumber = this.availableDays[0].number;
      this.newWorkingHour.dayName = this.availableDays[0].name;
    }
  }

  startAddingWorkingHour(): void {
    this.updateAvailableDays();
    if (this.availableDays.length === 0) {
      if (this.toast) {
        this.toast.show('All days already have working hours set.', 'info');
      }
      return;
    }
    this.isAddingWorkingHour = true;
  }

  cancelAddingWorkingHour(): void {
    this.isAddingWorkingHour = false;
    this.newWorkingHour = {
      dayNumber: 0,
      dayName: 'Monday',
      openTime: '09:00',
      closeTime: '17:00',
      isClosed: false,
    };
  }

  onDayChange(): void {
    const selected = this.daysWithNumbers.find((d) => d.number === this.newWorkingHour.dayNumber);
    if (selected) {
      this.newWorkingHour.dayName = selected.name;
    }
  }

  formatTime12Hour(time: string): string {
    if (!time) return '';

    const [hours, minutes] = time.split(':');
    let hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';

    if (hour === 0) {
      hour = 12;
    } else if (hour > 12) {
      hour = hour - 12;
    }

    return `${hour}:${minutes} ${ampm}`;
  }

  addWorkingHour(): void {
    // Validate times only if not closed
    if (!this.newWorkingHour.isClosed) {
      if (!this.newWorkingHour.openTime || !this.newWorkingHour.closeTime) {
        if (this.toast) {
          this.toast.show('Please select both open and close times.', 'error');
        }
        return;
      }
      if (this.newWorkingHour.openTime >= this.newWorkingHour.closeTime) {
        if (this.toast) {
          this.toast.show('Close time must be after open time.', 'error');
        }
        return;
      }
    }

    if (!this.profileData.id) {
      if (this.toast) {
        this.toast.show('Workshop ID not found.', 'error');
      }
      return;
    }

    // Always provide valid times (backend has conflicting validation rules)
    // The isClosed flag tells the system to ignore the times
    const openTime = this.newWorkingHour.openTime || '09:00';
    const closeTime = this.newWorkingHour.closeTime || '17:00';

    // Save immediately to database
    console.log('🔵 Starting add working hour operation');
    this.isSavingWorkingHours = true;

    // Emergency timeout to force reset after 6 seconds
    const emergencyTimeout = setTimeout(() => {
      if (this.isSavingWorkingHours) {
        console.error('⚠️ EMERGENCY: Add timeout reached, forcing reset');
        this.ngZone.run(() => {
          this.isSavingWorkingHours = false;
          this.cd.detectChanges();
          if (this.toast) {
            this.toast.show('Operation timed out', 'error');
          }
        });
      }
    }, 6000);

    const workingHourData = {
      day: this.newWorkingHour.dayName,
      from: openTime,
      to: closeTime,
      isClosed: this.newWorkingHour.isClosed,
      workShopProfileId: parseInt(this.profileData.id!),
    };

    console.log('Saving working hour immediately:', workingHourData);

    this.workshopProfileService
      .createWorkingHours(workingHourData)
      .pipe(
        timeout(5000),
        catchError((error) => {
          console.error('Error saving working hour:', error);
          clearTimeout(emergencyTimeout);
          return throwError(() => error);
        })
      )
      .subscribe({
        next: (response) => {
          console.log('====== ADD WORKING HOUR RESPONSE ======');
          console.log('Full response:', JSON.stringify(response, null, 2));
          console.log('Response.success:', response?.success);
          console.log('=======================================');

          clearTimeout(emergencyTimeout);
          console.log('✅ Resetting isSavingWorkingHours to false');

          // Use NgZone to ensure Angular picks up the change
          this.ngZone.run(() => {
            this.isSavingWorkingHours = false;
            console.log('isSavingWorkingHours is now:', this.isSavingWorkingHours);

            if (response && response.success === true) {
              console.log('✅ Success - closing form and reloading');
              if (this.toast) {
                this.toast.show(
                  response.message || `${this.newWorkingHour.dayName} added successfully!`,
                  'success'
                );
              }

              // Close the form
              this.isAddingWorkingHour = false;

              // Force change detection
              this.cd.detectChanges();

              // Reload working hours to get fresh data with IDs
              this.loadWorkingHours(parseInt(this.profileData.id!));
            } else {
              console.error('❌ Response success is false:', response);
              if (this.toast) {
                this.toast.show(response?.message || 'Failed to add working hour', 'error');
              }
            }
          });
        },
        error: (error) => {
          console.error('❌ Error adding working hour:', error);
          clearTimeout(emergencyTimeout);

          // Use NgZone to ensure Angular picks up the change
          this.ngZone.run(() => {
            this.isSavingWorkingHours = false;
            this.cd.detectChanges();
            if (this.toast) {
              const msg =
                error instanceof TimeoutError ? 'Request timed out' : 'Failed to add working hour';
              this.toast.show(msg, 'error');
            }
          });
        },
      });
  }

  removeWorkingHour(index: number): void {
    this.deleteWorkingHourIndex = index;
    this.showDeleteWorkingHourModal = true;
  }

  cancelDeleteWorkingHour(): void {
    this.showDeleteWorkingHourModal = false;
    this.deleteWorkingHourIndex = -1;
  }

  confirmDeleteWorkingHour(): void {
    const index = this.deleteWorkingHourIndex;
    if (index === -1) return;

    const workingHour = this.profileData.workingHours[index];

    // If it has an id, it's saved in database - delete from backend
    if (workingHour.id) {
      console.log('Starting delete operation for working hour ID:', workingHour.id);
      this.isDeletingWorkingHour = true;

      // Emergency timeout to force reset after 5 seconds
      const emergencyTimeout = setTimeout(() => {
        console.error('EMERGENCY: Delete timeout reached, forcing reset');
        this.ngZone.run(() => {
          this.isDeletingWorkingHour = false;
          this.showDeleteWorkingHourModal = false;
          this.deleteWorkingHourIndex = -1;
          this.cd.detectChanges();
          if (this.toast) {
            this.toast.show('Operation timed out', 'error');
          }
        });
      }, 5000);

      this.workshopProfileService
        .deleteWorkingHour(workingHour.id)
        .pipe(
          timeout(4000), // 4 second timeout for the HTTP request
          catchError((error) => {
            console.error('Delete error caught:', error);
            if (error instanceof TimeoutError) {
              console.error('Request timed out');
            }
            return throwError(() => error);
          })
        )
        .subscribe({
          next: (response) => {
            console.log('====== DELETE WORKING HOUR RESPONSE ======');
            console.log('Full response:', JSON.stringify(response, null, 2));
            console.log('Response type:', typeof response);
            console.log('Response.success:', response?.success);
            console.log('Response.message:', response?.message);
            console.log('Response.data:', response?.data);
            console.log('==========================================');

            // Clear emergency timeout
            clearTimeout(emergencyTimeout);

            // Use NgZone to ensure Angular picks up the change
            this.ngZone.run(() => {
              // Check if response indicates success
              if (response && response.success === true) {
                console.log('✅ Working hour deleted from database:', workingHour.id);
                if (this.toast) {
                  this.toast.show(
                    response.message || 'Working hour removed successfully',
                    'success'
                  );
                }
                // Reset modal state
                this.isDeletingWorkingHour = false;
                this.showDeleteWorkingHourModal = false;
                this.deleteWorkingHourIndex = -1;

                // Force change detection
                this.cd.detectChanges();

                // Reload working hours from database to get fresh data with IDs
                if (this.profileData.id) {
                  console.log('Reloading working hours after delete...');
                  this.loadWorkingHours(parseInt(this.profileData.id));
                }
              } else {
                console.error('❌ Delete response indicates failure:', response);
                this.isDeletingWorkingHour = false;
                this.showDeleteWorkingHourModal = false;
                this.deleteWorkingHourIndex = -1;
                this.cd.detectChanges();
                if (this.toast) {
                  const errorMsg = response?.message || 'Failed to remove working hour';
                  this.toast.show(errorMsg, 'error');
                }
              }
            });
          },
          error: (error) => {
            console.error('❌ Error deleting working hour:', error);
            clearTimeout(emergencyTimeout);

            // Use NgZone to ensure Angular picks up the change
            this.ngZone.run(() => {
              this.isDeletingWorkingHour = false;
              this.showDeleteWorkingHourModal = false;
              this.deleteWorkingHourIndex = -1;
              this.cd.detectChanges();
              if (this.toast) {
                const msg =
                  error instanceof TimeoutError
                    ? 'Request timed out'
                    : 'Failed to remove working hour';
                this.toast.show(msg, 'error');
              }
            });
          },
        });
    } else {
      // Not saved yet, just remove from local array
      console.log('Removing unsaved working hour at index:', index);
      this.profileData.workingHours = this.profileData.workingHours.filter((_, i) => i !== index);
      console.log('Removed unsaved working hour, updated array:', this.profileData.workingHours);
      this.isFormDirty = true;
      this.hasUnsavedWorkingHours = true;
      this.updateAvailableDays();
      this.showDeleteWorkingHourModal = false;
      this.deleteWorkingHourIndex = -1;
      if (this.toast) {
        this.toast.show('Working hour removed', 'info');
      }
    }
  }

  areAllHoursSaved(): boolean {
    // Check if all working hours have an ID (meaning they're saved in database)
    if (this.profileData.workingHours.length === 0) {
      return false;
    }
    return this.profileData.workingHours.every((hour) => hour.id !== undefined && hour.id !== null);
  }

  saveWorkingHours(): void {
    if (!this.profileData.id) {
      if (this.toast) {
        this.toast.show('Workshop ID not found. Please try again.', 'error');
      }
      return;
    }

    if (this.profileData.workingHours.length === 0) {
      if (this.toast) {
        this.toast.show('Please add at least one working hour before saving.', 'warning');
      }
      return;
    }

    console.log('🔵 Starting saveWorkingHours operation');
    this.isSavingWorkingHours = true;

    // Emergency timeout to force reset after 12 seconds
    const saveEmergencyTimeout = setTimeout(() => {
      console.error('⚠️ EMERGENCY: Save timeout reached, forcing reset');
      this.isSavingWorkingHours = false;
      if (this.toast) {
        this.toast.show('Save operation timed out. Please try again.', 'error');
      }
    }, 12000);

    // Map working hours to API format
    const apiWorkingHours = this.profileData.workingHours.map((hour: any) => {
      // Backend validation expects actual times when open, but validation is weird for closed
      // Let's send valid times regardless (backend will ignore them when isClosed is true)
      const from = hour.openTime || '09:00';
      const to = hour.closeTime || '17:00';

      return {
        day: hour.dayName || hour.day,
        from: from,
        to: to,
        isClosed: hour.isClosed,
        workShopProfileId: parseInt(this.profileData.id!),
      };
    });

    console.log('Saving working hours:', apiWorkingHours);

    // First, delete all existing working hours to avoid duplicates
    this.workshopProfileService
      .deleteAllWorkingHours(parseInt(this.profileData.id!))
      .pipe(
        finalize(() => {
          console.log('Delete operation finalized, proceeding with creation');
        })
      )
      .subscribe({
        next: (deleteResponse) => {
          console.log('====== DELETE ALL WORKING HOURS RESPONSE ======');
          console.log('Full response:', JSON.stringify(deleteResponse, null, 2));
          console.log('Response type:', typeof deleteResponse);
          console.log('Response.success:', deleteResponse?.success);
          console.log('Response.message:', deleteResponse?.message);
          console.log('===============================================');
          console.log('Existing working hours deleted, now creating new ones');
          this.createWorkingHoursSequentially(apiWorkingHours, saveEmergencyTimeout);
        },
        error: (error) => {
          console.log(
            'No existing working hours to delete (or delete failed), proceeding with creation:',
            error
          );
          // Even if delete fails (no hours exist), proceed with creation
          this.createWorkingHoursSequentially(apiWorkingHours, saveEmergencyTimeout);
        },
      });
  }

  private createWorkingHoursSequentially(apiWorkingHours: any[], emergencyTimeout: any): void {
    console.log('createWorkingHoursSequentially called with:', apiWorkingHours.length, 'hours');

    // Safety check: if no hours to save, reset immediately
    if (!apiWorkingHours || apiWorkingHours.length === 0) {
      console.warn('No working hours to save');
      clearTimeout(emergencyTimeout);
      this.isSavingWorkingHours = false;
      if (this.toast) {
        this.toast.show('No working hours to save', 'warning');
      }
      return;
    }

    let completedRequests = 0;
    let hasError = false;
    let errorMessages: string[] = [];
    const totalRequests = apiWorkingHours.length;

    const timeoutId = setTimeout(() => {
      if (this.isSavingWorkingHours) {
        console.error('⏱️ Save timeout - forcing reset after 10 seconds');
        clearTimeout(emergencyTimeout);
        this.isSavingWorkingHours = false;
        console.log('✅ isSavingWorkingHours reset to false via timeout');
        if (this.toast) {
          this.toast.show('Save operation timed out. Please refresh and try again.', 'error');
        }
        // Reload working hours to show current state
        this.loadWorkingHours(parseInt(this.profileData.id!));
      }
    }, 10000); // Reduced to 10 seconds for faster recovery

    apiWorkingHours.forEach((hour, index) => {
      console.log(`Sending working hour ${index + 1}/${totalRequests}:`, hour);

      this.workshopProfileService
        .createWorkingHours(hour)
        .pipe(
          // Add timeout to each individual request
          finalize(() => {
            console.log(`Request ${index + 1} finalized (completed or errored)`);
          })
        )
        .subscribe({
          next: (response) => {
            console.log(`====== CREATE WORKING HOUR ${index + 1}/${totalRequests} RESPONSE ======`);
            console.log('Request data:', hour);
            console.log('Full response:', JSON.stringify(response, null, 2));
            console.log('Response type:', typeof response);
            console.log('Response.success:', response?.success);
            console.log('Response.message:', response?.message);
            console.log('Response.data:', response?.data);
            console.log('=========================================================');

            // Check if response indicates success
            if (response && response.success === true) {
              console.log(`✅ Working hour ${index + 1}/${totalRequests} created successfully`);
            } else {
              console.error(
                `❌ Working hour ${index + 1}/${totalRequests} response indicates failure:`,
                response
              );
              hasError = true;
              const errorMsg = response?.message || `Failed to save ${hour.day}`;
              errorMessages.push(errorMsg);
            }

            completedRequests++;
            console.log(`Progress: ${completedRequests}/${totalRequests} completed`);

            if (completedRequests === totalRequests) {
              console.log('All requests completed. hasError:', hasError);
              clearTimeout(timeoutId);
              clearTimeout(emergencyTimeout);
              console.log('✅ Resetting isSavingWorkingHours to false');
              this.isSavingWorkingHours = false;

              if (!hasError) {
                console.log('All saves successful - reloading hours to get IDs');
                if (this.toast) {
                  this.toast.show('All working hours saved successfully!', 'success');
                }
                this.isFormDirty = false;

                // Reload working hours from database to get fresh data with IDs
                console.log('Reloading working hours after save...');
                this.loadWorkingHours(parseInt(this.profileData.id!));
              } else {
                console.log('Some saves failed - reloading hours');
                // Reload working hours to show what was actually saved
                this.loadWorkingHours(parseInt(this.profileData.id!));

                if (this.toast) {
                  const errorMsg =
                    errorMessages.length > 0
                      ? errorMessages.join(', ')
                      : 'Some working hours failed to save';
                  this.toast.show(`Partial save: ${errorMsg}`, 'warning');
                }
              }
            }
          },
          error: (error) => {
            console.error(`❌ Error creating working hour ${index + 1}/${totalRequests}:`, error);
            console.error('Full error response:', JSON.stringify(error, null, 2));
            console.error('Error body:', error.error);

            hasError = true;
            completedRequests++;
            console.log(`Progress (with error): ${completedRequests}/${totalRequests} completed`);

            // Extract detailed error message from backend
            let errorMsg = 'Failed to save working hours';
            if (error.error) {
              if (typeof error.error === 'string') {
                errorMsg = error.error;
              } else if (error.error.message) {
                errorMsg = error.error.message;
              } else if (error.error.title) {
                errorMsg = error.error.title;
              } else if (error.error.errors) {
                // Handle validation errors
                const validationErrors = error.error.errors;
                const validationErrorMsgs: string[] = [];
                for (const key in validationErrors) {
                  if (Object.prototype.hasOwnProperty.call(validationErrors, key)) {
                    const messages = Array.isArray(validationErrors[key])
                      ? validationErrors[key]
                      : [validationErrors[key]];
                    validationErrorMsgs.push(`${key}: ${messages.join(', ')}`);
                  }
                }
                if (validationErrorMsgs.length > 0) {
                  errorMsg = validationErrorMsgs.join('\n');
                }
              }
            }

            errorMessages.push(errorMsg);

            if (completedRequests === totalRequests) {
              console.log('All requests completed (with errors). Resetting state.');
              clearTimeout(timeoutId);
              this.isSavingWorkingHours = false;

              // Reload to show what was actually saved
              this.loadWorkingHours(parseInt(this.profileData.id!));

              if (this.toast) {
                this.toast.show(`Error: ${errorMsg}`, 'error');
              }
            }
          },
        });
    });
  }

  /**
   * Centralized navigation helper that prevents redirecting when
   * `preventRedirectAfterLocation` is set (used by the location flow).
   * If a redirect is prevented, the flag is reset so subsequent saves
   * behave normally.
   */
  private navigateToProfileIfAllowed(id: string | number | undefined | null): void {
    if (!id) return;

    // If sessionStorage indicates the location flow set a flag, respect it too.
    const sessionFlag = sessionStorage.getItem('workshop_location_set');
    const shouldPrevent = this.preventRedirectAfterLocation || sessionFlag === 'true';

    if (shouldPrevent) {
      // consume both flags and stay on the current page
      this.preventRedirectAfterLocation = false;
      try {
        sessionStorage.removeItem('workshop_location_set');
      } catch (e) {
        // ignore session storage errors
      }
      console.log('Navigation suppressed due to preventRedirectAfterLocation/session flag.');
      return;
    }

    // Normal navigation
    try {
      this.router.navigate([`/workshop-profile/${id}`]);
    } catch (e) {
      console.error('Failed to navigate to workshop profile:', e);
    }
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
    // Ensure change detection and UI updates happen immediately
    try {
      this.ngZone.run(() => {
        this.selectedGalleryFiles.push(...files);
      });
    } catch {
      this.selectedGalleryFiles.push(...files);
    }

    // Create preview URLs and push them inside NgZone so Angular updates the view right away
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          this.ngZone.run(() => {
            this.galleryPreviewUrls.push(e.target.result);
            try {
              this.cd.detectChanges();
            } catch {}
          });
        } catch {
          this.galleryPreviewUrls.push(e.target.result);
          try {
            this.cd.detectChanges();
          } catch {}
        }
      };
      reader.readAsDataURL(file);
    });
  }

  removeGalleryPreview(index: number): void {
    this.selectedGalleryFiles.splice(index, 1);
    this.galleryPreviewUrls.splice(index, 1);
    if (this.toast) this.toast.show('Removed image from queue', 'info');
  }

  removeExistingGalleryImage(image: { id?: number; url: string }): void {
    // keep for backward compatibility, but prefer modal-based flow
    this.promptDeleteGalleryImage(image);
  }

  promptDeleteGalleryImage(image: { id?: number; url: string }): void {
    this.imagePendingDelete = image;
    this.showDeleteImageModal = true;
  }

  cancelDeleteGalleryImage(): void {
    this.imagePendingDelete = null;
    this.showDeleteImageModal = false;
  }

  confirmDeleteGalleryImage(): void {
    if (!this.imagePendingDelete) return;
    const image = this.imagePendingDelete;
    this.isDeletingImage = true;

    const finish = () => {
      try {
        this.ngZone.run(() => {
          this.isDeletingImage = false;
          this.imagePendingDelete = null;
          this.showDeleteImageModal = false;
          try {
            this.cd.detectChanges();
          } catch {}
        });
      } catch (e) {
        this.isDeletingImage = false;
        this.imagePendingDelete = null;
        this.showDeleteImageModal = false;
        try {
          this.cd.detectChanges();
        } catch {}
      }
    };

    // If photo has an ID, call delete-by-id
    if (image.id && Number(image.id) > 0) {
      this.workshopProfileService.deleteWorkShopPhotoById(Number(image.id)).subscribe({
        next: () => {
          const idx = this.profileData.galleryImages.findIndex(
            (g) => g.url === image.url || g.id === image.id
          );
          if (idx > -1) this.profileData.galleryImages.splice(idx, 1);
          if (this.toast) this.toast.show('Image removed', 'success');
          finish();
        },
        error: (error) => {
          console.error('Error removing image by id:', error);
          this.errorMessage = 'Failed to remove image';
          if (this.toast) this.toast.show('Failed to remove image. See console.', 'error');
          finish();
        },
      });
      return;
    }

    // Fallback - delete by URL
    this.workshopProfileService.deleteGalleryImage(this.workshopId, image.url).subscribe({
      next: () => {
        const idx = this.profileData.galleryImages.findIndex((g) => g.url === image.url);
        if (idx > -1) this.profileData.galleryImages.splice(idx, 1);
        if (this.toast) this.toast.show('Image removed', 'success');
        finish();
      },
      error: (error) => {
        console.error('Error removing image (fallback):', error);
        this.errorMessage = 'Failed to remove image';
        if (this.toast) this.toast.show('Failed to remove image. See console.', 'error');
        finish();
      },
    });
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
      // Ensure Angular updates the view when FileReader completes
      try {
        this.ngZone.run(() => {
          this.logoPreviewUrl = e.target.result;
          this.cd.detectChanges();
        });
      } catch (err) {
        // Fallback: assign and mark for change detection
        this.logoPreviewUrl = e.target.result;
        try {
          this.cd.detectChanges();
        } catch {}
      }
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
        // Ensure Angular updates the view when FileReader completes
        try {
          this.ngZone.run(() => {
            this.licensePreviewUrl = e.target.result;
            this.cd.detectChanges();
          });
        } catch (err) {
          this.licensePreviewUrl = e.target.result;
          try {
            this.cd.detectChanges();
          } catch {}
        }
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
    // Absolute URL already
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }

    // Leading slash -> treat as absolute path on backend host
    if (trimmed.startsWith('/')) {
      return `${this.backendBaseUrl}${trimmed}`;
    }

    // If value contains a slash treat it as a relative path and append to backend base
    if (trimmed.indexOf('/') !== -1) {
      return `${this.backendBaseUrl}/${trimmed}`;
    }

    // If it's a bare filename like "be774448d5b5.jpg" assume uploads folder
    return `${this.backendBaseUrl}/uploads/${trimmed}`;
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
    const idNum = Number(this.workshopId);
    const idForApi = Number.isFinite(idNum) && idNum > 0 ? idNum : 0;
    if (idForApi === 0) {
      // No valid workshop id - do not attempt upload
      if (this.toast) this.toast.show('Cannot upload: missing workshop id', 'error');
      console.warn('Skipping gallery upload: invalid workshop id', this.workshopId);
      return null;
    }

    return this.workshopProfileService.uploadWorkShopPhotos(idForApi, filesToUpload).pipe(
      tap((response) => {
        const payload = response?.data ?? response ?? {};
        let uploaded: any[] = [];

        if (Array.isArray(payload)) uploaded = payload as any[];
        else if (Array.isArray(payload.imageUrls)) uploaded = payload.imageUrls;
        else if (Array.isArray(payload.photos)) uploaded = payload.photos;
        else if (Array.isArray(payload.data)) uploaded = payload.data;

        // Normalize uploaded items into objects with {id?, url}
        const mapped = uploaded.map((it: any) => {
          if (typeof it === 'string') return { url: this.getFullBackendUrl(it) };
          const url =
            it.url ||
            it.photoUrl ||
            it.imageUrl ||
            it.fileUrl ||
            it.path ||
            it.filePath ||
            it.fileName ||
            '';
          return { id: it.id, url: this.getFullBackendUrl(url) };
        });

        if (mapped.length > 0) {
          this.profileData.galleryImages.push(...mapped);
        }

        this.selectedGalleryFiles = [];
        this.galleryPreviewUrls = [];
      })
    );
  }

  /**
   * Explicit upload action triggered by the 'Upload Selected' button.
   * Shows progress and adds uploaded images to `profileData.galleryImages`.
   */
  uploadSelectedGallery(): void {
    if (!this.selectedGalleryFiles || this.selectedGalleryFiles.length === 0) return;

    // Prefer numeric id from loaded profile if available
    const profileIdNum = Number(this.profileData?.id);
    const routeIdNum = Number(this.workshopId);
    const idForApi =
      Number.isFinite(profileIdNum) && profileIdNum > 0
        ? profileIdNum
        : Number.isFinite(routeIdNum) && routeIdNum > 0
        ? routeIdNum
        : 0;

    if (idForApi === 0) {
      if (this.toast) this.toast.show('Cannot upload: missing workshop id', 'error');
      console.warn('Skipping uploadSelectedGallery: invalid id', {
        profileDataId: this.profileData?.id,
        workshopId: this.workshopId,
      });
      return;
    }

    this.uploadInProgress = true;
    this.uploadProgress = 0;
    this.uploadError = '';

    console.log('Uploading gallery images', {
      workShopProfileId: idForApi,
      filesCount: this.selectedGalleryFiles.length,
    });

    this.workshopProfileService
      .uploadWorkShopPhotosWithProgress(idForApi, this.selectedGalleryFiles)
      .subscribe({
        next: (event: any) => {
          if (event.type === HttpEventType.UploadProgress) {
            const loaded = event.loaded || 0;
            const total = event.total || 1;
            this.uploadProgress = Math.round((loaded / total) * 100);
            try {
              this.cd.detectChanges();
            } catch {}
            return;
          }

          if (event.type === HttpEventType.Response) {
            const resp = event.body ?? event;
            const payload = resp?.data ?? resp ?? {};
            let uploaded: any[] = [];
            if (Array.isArray(payload)) uploaded = payload as any[];
            else if (Array.isArray(payload.imageUrls)) uploaded = payload.imageUrls;
            else if (Array.isArray(payload.photos)) uploaded = payload.photos;
            else if (Array.isArray(payload.data)) uploaded = payload.data;

            const mapped = uploaded.map((it: any) => {
              if (typeof it === 'string') return { url: this.getFullBackendUrl(it) };
              const url =
                it.url ||
                it.photoUrl ||
                it.imageUrl ||
                it.fileUrl ||
                it.path ||
                it.filePath ||
                it.fileName ||
                '';
              return { id: it.id, url: this.getFullBackendUrl(url) };
            });

            if (mapped.length > 0) this.profileData.galleryImages.push(...mapped);

            // Clear selected queue and previews
            this.selectedGalleryFiles = [];
            this.galleryPreviewUrls = [];
            this.uploadInProgress = false;
            this.uploadProgress = 100;
            if (this.toast) this.toast.show('Uploaded images successfully', 'success');

            // Refresh gallery from server so server-returned filenames/ids are used
            try {
              this.loadGalleryImages(idForApi);
            } catch (e) {
              // fallback: keep mapped items already appended
              console.warn('Failed to refresh gallery after upload', e);
            }

            try {
              this.cd.detectChanges();
            } catch {}
          }
        },
        error: (err) => {
          // Better error reporting for debugging and user feedback
          console.error('Error uploading gallery images:', err);
          const status = err?.status;
          const serverMessage =
            err?.error?.message || err?.error || err?.message || 'Unknown error';
          this.uploadInProgress = false;
          this.uploadError = String(serverMessage);
          const userMsg = status
            ? `Upload failed (${status}): ${serverMessage}`
            : `Upload failed: ${serverMessage}`;
          if (this.toast) this.toast.show(userMsg, 'error', 4000);
          try {
            this.cd.detectChanges();
          } catch {}
        },
      });
  }

  /**
   * Load gallery photos from WorkShopPhotoController and normalize them
   */
  loadGalleryImages(workshopId: number): void {
    this.workshopProfileService.getWorkShopPhotos(workshopId).subscribe({
      next: (resp) => {
        console.debug('WorkShopPhoto GET response:', resp);
        const payload = resp?.data ?? resp ?? [];
        console.debug('WorkShopPhoto parsed payload:', payload);
        let items: any[] = [];
        if (Array.isArray(payload)) items = payload;
        else if (Array.isArray(payload.photos)) items = payload.photos;

        this.profileData.galleryImages = items.map((it: any) => {
          if (typeof it === 'string') return { url: this.getFullBackendUrl(it) };
          const url =
            it.url ||
            it.photoUrl ||
            it.imageUrl ||
            it.fileUrl ||
            it.path ||
            it.filePath ||
            it.fileName ||
            '';
          return { id: it.id, url: this.getFullBackendUrl(url) };
        });
        console.debug('WorkShopPhoto mapped galleryImages:', this.profileData.galleryImages);
        // Ensure view updates immediately after loading images
        try {
          this.ngZone.run(() => this.cd.detectChanges());
        } catch {}
      },
      error: (err) => {
        console.warn('Failed to load gallery images:', err);
      },
    });
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

  // --- LocalStorage persistence methods ---
  private saveToLocalStorage(): void {
    try {
      // Never save UI state like isLoading - only save profile data
      const dataToStore = {
        ...this.profileData,
        timestamp: new Date().getTime(),
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(dataToStore));
      console.log('Profile data saved to localStorage');
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }

  private loadFromLocalStorage(): WorkshopProfileData | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Optional: Check if data is too old (e.g., older than 7 days)
        const timestamp = parsed.timestamp;
        if (timestamp) {
          const age = new Date().getTime() - timestamp;
          const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
          if (age > maxAge) {
            console.log('Cached data is too old, will refresh from API');
            localStorage.removeItem(this.STORAGE_KEY);
            return null;
          }
        }
        delete parsed.timestamp; // Remove timestamp before using
        return parsed as WorkshopProfileData;
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }
    return null;
  }

  private applyProfileData(data: WorkshopProfileData): void {
    // Map the loaded data to profileData
    this.profileData = {
      ...data,
      workingHours: data.workingHours || this.initializeWorkingHours(),
    };

    // Normalize gallery images (support strings or objects)
    if (data.galleryImages && Array.isArray(data.galleryImages)) {
      this.profileData.galleryImages = data.galleryImages.map((it: any) => {
        if (!it) return { url: '' } as any;
        if (typeof it === 'string') return { url: this.getFullBackendUrl(it) };
        const url =
          it.url ||
          it.photoUrl ||
          it.imageUrl ||
          it.fileUrl ||
          it.path ||
          it.filePath ||
          it.fileName ||
          '';
        return { id: it.id, url: this.getFullBackendUrl(url) };
      });
    } else {
      this.profileData.galleryImages = [];
    }

    // Load existing logo if available (ensure full absolute URL)
    if (this.profileData.LogoImageUrl) {
      this.profileData.LogoImageUrl = this.getFullBackendUrl(this.profileData.LogoImageUrl);
      this.logoPreviewUrl = this.profileData.LogoImageUrl;
    }

    // Load existing license if available (ensure full absolute URL)
    if (this.profileData.LicenceImageUrl) {
      this.profileData.LicenceImageUrl = this.getFullBackendUrl(this.profileData.LicenceImageUrl);
      this.licensePreviewUrl = this.profileData.LicenceImageUrl;
    }

    // Ensure change detection runs so previews update when applying cached data
    try {
      this.ngZone.run(() => this.cd.detectChanges());
    } catch (e) {}

    // Populate cities based on governorate
    if (this.profileData.location.governorate) {
      this.onGovernorateChange(this.profileData.location.governorate);
    }

    // Reinitialize map with loaded coordinates if map exists
    if (this.map && this.profileData.location) {
      const lat = this.profileData.location.latitude;
      const lng = this.profileData.location.longitude;
      this.map.setView([lat, lng], 13);
      this.updateMarker(lat, lng);
    }

    this.isFormDirty = false;
  }

  // --- Location modal actions ---
  requestLocation(): void {
    this.isLoadingLocation = true;
    this.locationError = '';

    this.geolocationService
      .requestLocation()
      .pipe(take(1))
      .subscribe({
        next: (position: GeolocationPosition) => {
          this.ngZone.run(() => {
            this.workshopLocation = position;
            this.isLoadingLocation = false;
            this.showLocationModal = false;

            // prevent any automatic redirects that may occur after saving location
            this.preventRedirectAfterLocation = true;

            // Mark location as set in this session
            sessionStorage.setItem('workshop_location_set', 'true');

            // Update profile coordinates and map
            this.profileData.location.latitude = position.latitude;
            this.profileData.location.longitude = position.longitude;
            if (this.map) {
              this.map.setView([position.latitude, position.longitude], 13);
              this.updateMarker(position.latitude, position.longitude);
            }
            this.isFormDirty = true;

            // Save to backend (non-blocking helper)
            this.geolocationService.saveWorkshopLocation(position);

            if (this.toast) this.toast.show('Location obtained and pinned.', 'success', 2000);
            this.cd.detectChanges();
          });
        },
        error: (err) => {
          console.error('Error getting location:', err);
          this.ngZone.run(() => {
            this.isLoadingLocation = false;
            this.locationError = err?.message || 'Failed to get location';
            if (err && err.code === 1) {
              this.locationPermissionDenied = true;
              if (this.toast)
                this.toast.show(
                  'Location permission denied. Please enable it in your browser.',
                  'warning'
                );
            }
            this.cd.detectChanges();
          });
        },
      });

    // Subscribe to error stream once
    this.geolocationService
      .getLocationErrors()
      .pipe(take(1))
      .subscribe({
        next: (error: GeolocationError) => {
          this.ngZone.run(() => {
            this.locationError = error.message;
            this.isLoadingLocation = false;
            if (error.code === 1) this.locationPermissionDenied = true;
            this.cd.detectChanges();
          });
        },
      });
  }

  dismissLocationRequest(): void {
    this.showLocationModal = false;
    sessionStorage.setItem('workshop_location_set', 'dismissed');
  }
}
