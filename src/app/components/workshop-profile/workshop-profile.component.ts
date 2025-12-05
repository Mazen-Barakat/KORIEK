import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  HostListener,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { WorkshopProfileService } from '../../services/workshop-profile.service';
import {
  WorkshopServiceService,
  WorkshopServiceData,
} from '../../services/workshop-service.service';
import { Subscription, forkJoin, of, timeout } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { AddServiceModalComponent } from '../add-service-modal/add-service-modal.component';
import { WorkshopServicesCatalogComponent } from '../workshop-services-catalog/workshop-services-catalog.component';
import { WorkshopService as WorkshopServiceModel } from '../../models/workshop-profile.model';

interface Service {
  id: string;
  name: string;
  description: string;
  duration: number;
  minPrice: number;
  maxPrice: number;
  imageUrl?: string;
  selected?: boolean;
  carOriginSpecializations?: string[];
  isAvailable?: boolean;
  originPricing?: Array<{
    originCode: string;
    originName: string;
    minPrice: number;
    maxPrice: number;
    isEnabled: boolean;
  }>;
}

interface Review {
  id: number;
  userName: string;
  userAvatar?: string;
  rating: number;
  comment: string;
  date: string;
  paidAmount?: number;
}

interface RatingBar {
  stars: number;
  percentage: number;
  count: number;
}

@Component({
  selector: 'app-workshop-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, AddServiceModalComponent, WorkshopServicesCatalogComponent],
  templateUrl: './workshop-profile.component.html',
  styleUrls: ['./workshop-profile.component.css'],
})
export class WorkshopProfileComponent implements OnInit, OnDestroy {
  // Direct API response data - no mapping needed
  profileData: any = {};
  photos: string[] = [];
  workingHours: any = {};
  workshopId: string = '';

  selectedTab: 'services' | 'reviews' = 'services';
  errorMessage: string = '';
  isLoadingProfile = false;
  isLoadingReviews = false;

  // Reviews data
  reviews: Review[] = [];
  ratingBars: RatingBar[] = [];
  averageRating: number = 0;

  // Gallery slider state
  currentImageIndex: number = 0;
  isAnimating: boolean = false;

  private routeSubscription?: Subscription;
  private profileSubscription?: Subscription;
  private photosSubscription?: Subscription;
  private loadingTimeoutId?: any;

  // Service form state for add/edit
  editingService: Service | null = null;
  serviceForm: Partial<Service> = {
    name: '',
    description: '',
    duration: 30,
    minPrice: 0,
    maxPrice: 0,
    imageUrl: '',
  };

  services: Service[] = [];
  workshopServices: WorkshopServiceModel[] = [];

  // Catalog component reference
  @ViewChild(WorkshopServicesCatalogComponent) catalogComponent?: WorkshopServicesCatalogComponent;
  @ViewChild('addServiceModal') addServiceModalComponent?: any;

  // Add Service Modal state
  showAddServiceModal = false;
  serviceGroupBy: 'origin' | 'category' | 'price' | 'duration' = 'origin';
  servicesViewMode: 'grid' | 'list' = 'grid';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private workshopProfileService: WorkshopProfileService,
    private workshopServiceService: WorkshopServiceService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  // Auto-play interval (optional)
  private sliderInterval?: any;

  ngOnInit(): void {
    // Load data immediately on init
    this.loadWorkshopData();

    // Also subscribe to route changes for navigation
    this.routeSubscription = this.route.paramMap.subscribe(() => {
      this.loadWorkshopData();
    });
  }

  ngOnDestroy(): void {
    if (this.routeSubscription) this.routeSubscription.unsubscribe();
    if (this.profileSubscription) this.profileSubscription.unsubscribe();
    if (this.photosSubscription) this.photosSubscription.unsubscribe();
    if (this.loadingTimeoutId) clearTimeout(this.loadingTimeoutId);
  }

  loadWorkshopData(): void {
    // Cancel any existing API calls
    if (this.profileSubscription) this.profileSubscription.unsubscribe();
    if (this.photosSubscription) this.photosSubscription.unsubscribe();

    // Clear any existing timeout
    if (this.loadingTimeoutId) {
      clearTimeout(this.loadingTimeoutId);
    }

    this.errorMessage = '';
    this.isLoadingProfile = true;

    // Safety timeout: Force stop loading after 10 seconds
    this.loadingTimeoutId = setTimeout(() => {
      if (this.isLoadingProfile) {
        console.error('⚠️ Loading timeout - forcing load complete');
        this.isLoadingProfile = false;
        this.errorMessage = 'Loading took too long. Some data may be missing.';
        this.cdr.detectChanges();
      }
    }, 10000);

    const workshopIdFromRoute = this.route.snapshot.paramMap.get('id');
    const currentUserId = this.authService.getUserId();
    this.workshopId = workshopIdFromRoute || currentUserId || '';

    console.log('🚀 Starting workshop data load...');

    // Load workshop profile from API - backend handles permissions
    this.profileSubscription = this.workshopProfileService.getMyWorkshopProfile().subscribe({
      next: (response) => {
        console.log('📦 Profile API response received:', response);

        // Extract data from response
        const data = response?.data ?? response;
        console.log('📦 Extracted data:', data);

        if (!data || !data.id) {
          console.error('❌ No valid profile data');
          this.errorMessage = 'No profile data found';
          this.isLoadingProfile = false;

          // Clear the safety timeout
          if (this.loadingTimeoutId) {
            clearTimeout(this.loadingTimeoutId);
          }

          return;
        }

        // Assign to profileData
        this.profileData = data;
        this.workshopId = data.id.toString();

        // Load additional data in parallel using forkJoin
        const photosUrl = `https://localhost:44316/api/WorkShopPhoto/${data.id}`;

        const photosRequest = this.http.get(photosUrl).pipe(
          timeout(5000), // 5 second timeout
          catchError((error) => {
            console.error('Photos API failed, continuing with empty array:', error);
            return of({ data: [] });
          })
        );

        const workingHoursRequest = this.workshopProfileService
          .getWorkshopWorkingHours(data.id)
          .pipe(
            timeout(5000), // 5 second timeout
            catchError((error) => {
              console.error('Working hours API failed, continuing with empty array:', error);
              return of([]);
            })
          );

        forkJoin({
          photos: photosRequest,
          workingHours: workingHoursRequest,
        }).subscribe({
          next: (results) => {
            console.log('✅ ForkJoin completed, processing results...');

            // Handle photos
            this.photos = (results.photos as any)?.data ?? (results.photos as any) ?? [];
            this.currentImageIndex = 0;
            console.log('Photos loaded:', this.photos.length);

            // Handle working hours
            const apiResponse = results.workingHours as any;
            const apiHours = apiResponse?.data || apiResponse || [];
            const hoursMap: any = {};

            if (Array.isArray(apiHours) && apiHours.length > 0) {
              apiHours.forEach((hour) => {
                const dayName = hour.day; // API returns 'day' field directly as day name
                hoursMap[dayName] = {
                  openTime: hour.from, // API uses 'from' field
                  closeTime: hour.to, // API uses 'to' field
                  isClosed: hour.isClosed,
                };
              });
            }

            this.workingHours = hoursMap;
            console.log('Working hours loaded:', Object.keys(hoursMap).length, 'days', hoursMap);

            // CRITICAL: Set loading to false
            this.isLoadingProfile = false;
            console.log('✅ Profile loading complete - isLoadingProfile:', this.isLoadingProfile);

            // Clear the safety timeout
            if (this.loadingTimeoutId) {
              clearTimeout(this.loadingTimeoutId);
            }

            this.cdr.detectChanges();
          },
          error: (error) => {
            console.error('❌ ForkJoin error (should not happen due to catchError):', error);
            // Even on error, stop loading
            this.isLoadingProfile = false;

            // Clear the safety timeout
            if (this.loadingTimeoutId) {
              clearTimeout(this.loadingTimeoutId);
            }

            this.cdr.detectChanges();
          },
        });

        // Load reviews
        this.loadReviews(data.id);
      },
      error: (error) => {
        console.error('Error loading workshop profile:', error);
        this.errorMessage = 'Failed to load workshop profile. Please try again.';
        this.profileData = {};
        this.isLoadingProfile = false;

        // Clear the safety timeout
        if (this.loadingTimeoutId) {
          clearTimeout(this.loadingTimeoutId);
        }
      },
    });
  }

  loadReviews(workshopId: number): void {
    this.isLoadingReviews = true;
    const reviewsUrl = `https://localhost:44316/api/Review/all-Review/${workshopId}`;

    this.http
      .get<any>(reviewsUrl)
      .pipe(
        timeout(5000),
        catchError((error) => {
          console.error('Reviews API failed:', error);
          return of({ success: false, data: [] });
        })
      )
      .subscribe({
        next: (response) => {
          if (response?.success && response?.data) {
            this.reviews = response.data.map((review: any, index: number) => ({
              id: index + 1,
              userName: `${review.firstName || ''} ${review.lastName || ''}`.trim() || 'Customer',
              userAvatar: review.profileImageUrl
                ? this.getFullImageUrl(review.profileImageUrl)
                : undefined,
              rating: review.rating,
              comment: review.comment,
              date: review.createdAt,
              paidAmount: review.paidAmount,
            }));

            // Calculate average rating
            if (this.reviews.length > 0) {
              this.averageRating =
                this.reviews.reduce((sum, r) => sum + r.rating, 0) / this.reviews.length;
            }

            // Calculate rating bars
            this.calculateRatingBars();
          }
          this.isLoadingReviews = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.isLoadingReviews = false;
          this.cdr.detectChanges();
        },
      });
  }

  calculateRatingBars(): void {
    const counts = [0, 0, 0, 0, 0]; // 5, 4, 3, 2, 1 stars
    this.reviews.forEach((review) => {
      const rating = Math.round(review.rating);
      if (rating >= 1 && rating <= 5) {
        counts[5 - rating]++;
      }
    });

    const maxCount = Math.max(...counts, 1);
    this.ratingBars = [5, 4, 3, 2, 1].map((stars, index) => ({
      stars,
      count: counts[index],
      percentage: (counts[index] / maxCount) * 100,
    }));
  }

  getFullImageUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `https://localhost:44316${url.startsWith('/') ? '' : '/'}${url}`;
  }

  getStarArray(rating: number): number[] {
    const stars: number[] = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < fullStars; i++) {
      stars.push(1);
    }
    if (hasHalfStar && stars.length < 5) {
      stars.push(0.5);
    }
    while (stars.length < 5) {
      stars.push(0);
    }
    return stars;
  }

  getDayName(dayOfWeek: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayOfWeek] || 'Unknown';
  }

  // Hero slider methods
  selectImage(index: number): void {
    if (this.isAnimating || index === this.currentImageIndex) return;
    this.isAnimating = true;
    this.currentImageIndex = index;
    this.scrollThumbnailIntoView(index);

    setTimeout(() => {
      this.isAnimating = false;
    }, 600);
  }

  nextImage(): void {
    if (this.photos.length === 0 || this.isAnimating) return;
    this.isAnimating = true;
    this.currentImageIndex = (this.currentImageIndex + 1) % this.photos.length;
    this.scrollThumbnailIntoView(this.currentImageIndex);

    setTimeout(() => {
      this.isAnimating = false;
    }, 600);
  }

  previousImage(): void {
    if (this.photos.length === 0 || this.isAnimating) return;
    this.isAnimating = true;
    this.currentImageIndex = (this.currentImageIndex - 1 + this.photos.length) % this.photos.length;
    this.scrollThumbnailIntoView(this.currentImageIndex);

    setTimeout(() => {
      this.isAnimating = false;
    }, 600);
  }

  scrollThumbnailIntoView(index: number): void {
    setTimeout(() => {
      const thumbnailContainer = document.querySelector('.hero-thumbnails');
      const thumbnail = document.querySelectorAll('.hero-thumbnail-card')[index];
      if (thumbnailContainer && thumbnail) {
        thumbnail.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }, 50);
  }

  getCardPosition(index: number): any {
    const diff = index - this.currentImageIndex;

    if (diff === 0) {
      // Active card - centered
      return {
        transform: 'translateX(0%)',
        zIndex: 10,
        opacity: 1,
      };
    } else if (diff === 1 || (diff < 0 && diff === -(this.photos.length - 1))) {
      // Next card - to the right
      return {
        transform: 'translateX(100%)',
        zIndex: 5,
        opacity: 0,
      };
    } else if (diff === -1 || (diff > 0 && diff === this.photos.length - 1)) {
      // Previous card - to the left
      return {
        transform: 'translateX(-100%)',
        zIndex: 5,
        opacity: 0,
      };
    } else {
      // Hidden cards
      return {
        transform: 'translateX(100%)',
        zIndex: 1,
        opacity: 0,
      };
    }
  }

  // Helper methods for template
  buildAssetUrl(path: string | any): string {
    if (!path) return '';

    // Handle object with URL properties
    if (typeof path === 'object') {
      const url = path.photoUrl || path.url || path.imageUrl || path.path || '';
      return this.buildAssetUrl(url);
    }

    // Handle string path
    if (typeof path !== 'string') return '';

    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    const baseUrl = 'https://localhost:44316';
    return `${baseUrl}${path.startsWith('/') ? path : '/' + path}`;
  }

  generateInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  getLocation(): string {
    if (!this.profileData) return '';
    const parts = [
      this.profileData.city,
      this.profileData.governorate,
      this.profileData.country,
    ].filter(Boolean);
    return parts.join(', ') || 'Location not provided';
  }

  get selectedServices(): Service[] {
    return this.services.filter((s) => s.selected);
  }

  get totalEstimate(): number {
    return this.selectedServices.reduce((sum, service) => sum + (service.minPrice || 0), 0);
  }

  get selectedServiceCount(): number {
    return this.selectedServices.length;
  }

  toggleServiceSelection(service: Service): void {
    service.selected = !service.selected;
  }

  startAddService(): void {
    this.editingService = null;
    this.serviceForm = {
      name: '',
      description: '',
      duration: 30,
      minPrice: 0,
      maxPrice: 0,
      imageUrl: '',
    };
  }

  startEditService(service: Service): void {
    this.editingService = service;
    this.serviceForm = { ...service };
  }

  saveService(): void {
    if (!this.serviceForm.name || !this.serviceForm.description) {
      alert('Please provide a name and description for the service.');
      return;
    }
    const min = Number(this.serviceForm.minPrice) || 0;
    const max = Number(this.serviceForm.maxPrice) || min;
    if (min > max) {
      alert('Min price must be less than or equal to Max price.');
      return;
    }

    if (this.editingService) {
      this.editingService.name = String(this.serviceForm.name);
      this.editingService.description = String(this.serviceForm.description);
      this.editingService.duration = Number(this.serviceForm.duration);
      this.editingService.minPrice = min;
      this.editingService.maxPrice = max;
      this.editingService.imageUrl = String(this.serviceForm.imageUrl || '');
    } else {
      const newService: Service = {
        id: Date.now().toString(),
        name: String(this.serviceForm.name),
        description: String(this.serviceForm.description),
        duration: Number(this.serviceForm.duration),
        minPrice: min,
        maxPrice: max,
        imageUrl: String(this.serviceForm.imageUrl || ''),
        selected: false,
      };
      this.services.push(newService);
    }
    this.editingService = null;
    this.serviceForm = {
      name: '',
      description: '',
      duration: 30,
      minPrice: 0,
      maxPrice: 0,
      imageUrl: '',
    };
  }

  deleteService(service: Service): void {
    if (!confirm('Delete this service?')) return;
    this.services = this.services.filter((s) => s.id !== service.id);
  }

  onServicesLoaded(services: any[]): void {
    console.log('📊 Services loaded from catalog:', services.length);
    // Update parent services array for stats calculation
    this.services = services.map((service) => ({
      id: service.id,
      name: service.serviceName,
      description: service.serviceDescription,
      duration: service.duration,
      minPrice: service.minPrice,
      maxPrice: service.maxPrice,
      imageUrl: service.imageUrl,
      carOriginSpecializations: service.origin ? [service.origin] : [],
      originPricing: service.originPricing || [],
      isAvailable: service.isAvailable,
    }));
    console.log(
      '📈 Stats updated - Active Services:',
      this.services.length,
      'Car Origins:',
      this.getUniqueOriginsCount()
    );
    this.cdr.detectChanges();
  }

  cancelEdit(): void {
    this.editingService = null;
    this.serviceForm = {
      name: '',
      description: '',
      duration: 30,
      minPrice: 0,
      maxPrice: 0,
      imageUrl: '',
    };
  }

  makePhoneCall(): void {
    if (this.profileData?.phoneNumber) {
      window.location.href = `tel:${this.profileData.phoneNumber}`;
    }
  }

  getDirections(): void {
    // Prioritize latitude/longitude if available
    const lat = this.profileData?.latitude;
    const lng = this.profileData?.longitude;
    if (lat && lng) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
      window.open(url, '_blank', 'noopener');
      return;
    }
    // Fallback to address-based search if lat/lng missing
    const location = this.getLocation();
    if (location && location !== 'Location not provided') {
      const encodedLocation = encodeURIComponent(location);
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${encodedLocation}`,
        '_blank',
        'noopener'
      );
    }
  }

  visitWebsite(): void {
    if (this.profileData?.website) {
      const url = this.profileData.website.startsWith('http')
        ? this.profileData.website
        : `https://${this.profileData.website}`;
      window.open(url, '_blank');
    }
  }

  sendEmail(): void {
    const user = this.authService.getUser();
    const email = user?.email || this.profileData?.email;
    if (email) {
      window.location.href = `mailto:${email}`;
    }
  }

  bookAppointment(): void {
    if (this.selectedServiceCount === 0) {
      alert('Please select at least one service to book an appointment.');
      return;
    }
    this.router.navigate(['/booking'], {
      queryParams: {
        workshopId: this.workshopId,
        services: this.selectedServices.map((s) => s.id).join(','),
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/workshops']);
  }

  editProfile(): void {
    if (this.workshopId) {
      this.router.navigate(['/workshop-profile-edit'], { queryParams: { id: this.workshopId } });
    } else {
      this.router.navigate(['/workshop-profile-edit']);
    }
  }

  switchTab(tab: 'services' | 'reviews'): void {
    this.selectedTab = tab;
  }

  formatDuration(minutes: number): string {
    if (!minutes && minutes !== 0) return '';
    if (minutes < 60) {
      return `${minutes} mins`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours} hr ${mins} mins` : `${hours} hr`;
  }

  formatWorkingHours(day: string): string {
    const hours = this.workingHours[day];
    if (!hours) return 'Not set';
    if (hours.isClosed) {
      return 'Closed';
    }
    if (hours.openTime && hours.closeTime) {
      const openTime12 = this.formatTime12Hour(hours.openTime);
      const closeTime12 = this.formatTime12Hour(hours.closeTime);
      return `${openTime12} - ${closeTime12}`;
    }
    return 'Not set';
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

  isWorkingHoursClosed(day: string): boolean {
    const hours = this.workingHours[day];
    return !hours || hours.isClosed === true;
  }

  isWorkshopOpenNow(): boolean {
    const now = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = dayNames[now.getDay()];

    const todayHours = this.workingHours[today];

    // If no hours set or marked as closed
    if (!todayHours || todayHours.isClosed) {
      return false;
    }

    // Get current time in minutes since midnight
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Parse opening and closing times
    const [openHour, openMin] = todayHours.openTime.split(':').map(Number);
    const [closeHour, closeMin] = todayHours.closeTime.split(':').map(Number);

    const openMinutes = openHour * 60 + openMin;
    const closeMinutes = closeHour * 60 + closeMin;

    // Check if current time is between opening and closing
    return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
  }

  // ============================================
  // Add Service Modal Methods
  // ============================================

  openAddServiceModal(): void {
    this.showAddServiceModal = true;
    this.cdr.detectChanges();
  }

  closeAddServiceModal(): void {
    this.showAddServiceModal = false;
    this.editingService = null;
    this.cdr.detectChanges();
  }

  handleServicesAdded(services: WorkshopServiceModel[]): void {
    console.log('Services added successfully:', services);

    // Update the services list
    this.workshopServices = [...this.workshopServices, ...services];

    // Don't close the modal here - let the modal close itself after showing success message
    // Just refresh the catalog component immediately
    if (this.catalogComponent) {
      console.log('Refreshing catalog component...');
      this.catalogComponent.loadServices();
    }

    // Trigger change detection
    this.cdr.detectChanges();
  }

  /**
   * Handle service updated from modal
   */
  handleServiceUpdated(service: any): void {
    console.log('Service updated successfully:', service);

    // Refresh the catalog component to show updated service
    if (this.catalogComponent) {
      console.log('Refreshing catalog component after update...');
      this.catalogComponent.loadServices();
    }

    // Trigger change detection
    this.cdr.detectChanges();
  }

  /**
   * Handle service edited from catalog
   */
  onServiceEdited(service: any): void {
    console.log('Service edited:', service);
    this.editingService = service;
    this.showAddServiceModal = true;
  }

  /**
   * Handle service deleted from catalog
   */
  onServiceDeleted(serviceId: number): void {
    // Remove the deleted service from the local array to update stats immediately
    this.services = this.services.filter((service) => Number(service.id) !== serviceId);
    console.log(
      '📊 Service deleted, stats updated - Active Services:',
      this.services.length,
      'Car Origins:',
      this.getUniqueOriginsCount()
    );
    this.cdr.detectChanges();
  }

  loadWorkshopServices(): void {
    if (!this.profileData?.id) return;

    this.workshopServiceService.getWorkshopServices(this.profileData.id).subscribe({
      next: (response) => {
        console.log('Services API response:', response);
        if (response.success && response.data) {
          // Handle paginated response structure
          const data = response.data as any;
          if (data.items && Array.isArray(data.items)) {
            // Map WorkshopServiceData to WorkshopServiceModel
            this.workshopServices = data.items.map((item: WorkshopServiceData) => ({
              id: item.id,
              serviceId: item.serviceId,
              name: item.serviceName || 'Service',
              description: item.serviceDescription || '',
              duration: item.duration,
              minPrice: item.minPrice,
              maxPrice: item.maxPrice,
              origin: item.origin,
              workShopProfileId: item.workShopProfileId,
            }));
          } else if (Array.isArray(response.data)) {
            this.workshopServices = response.data as any;
          } else {
            this.workshopServices = [];
          }
        } else {
          this.workshopServices = [];
        }
        console.log('Loaded workshop services:', this.workshopServices);
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading workshop services:', error);
        this.workshopServices = [];
        this.cdr.detectChanges();
      },
    });
  }

  deleteWorkshopService(serviceId: number): void {
    if (!confirm('Are you sure you want to delete this service?')) return;

    this.workshopProfileService.deleteWorkshopService(this.profileData.id, serviceId).subscribe({
      next: () => {
        this.workshopServices = this.workshopServices.filter((s) => s.id !== serviceId);
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error deleting service:', error);
        alert('Failed to delete service. Please try again.');
      },
    });
  }

  toggleServiceAvailability(serviceId: number): void {
    this.workshopProfileService
      .toggleServiceAvailability(this.profileData.id, serviceId)
      .subscribe({
        next: () => {
          const service = this.workshopServices.find((s) => s.id === serviceId);
          if (service) {
            service.isAvailable = !service.isAvailable;
            this.cdr.detectChanges();
          }
        },
        error: (error) => {
          console.error('Error toggling service availability:', error);
        },
      });
  }

  getServicesByOrigin(): Map<string, WorkshopServiceModel[]> {
    const grouped = new Map<string, WorkshopServiceModel[]>();

    this.workshopServices.forEach((service) => {
      service.carOriginSpecializations.forEach((origin) => {
        if (!grouped.has(origin)) {
          grouped.set(origin, []);
        }
        grouped.get(origin)!.push(service);
      });
    });

    return grouped;
  }

  getServicesByCategory(): Map<string, WorkshopServiceModel[]> {
    const grouped = new Map<string, WorkshopServiceModel[]>();

    this.workshopServices.forEach((service) => {
      const category = service.categoryName || 'Other';
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(service);
    });

    return grouped;
  }

  changeServiceGrouping(groupBy: 'origin' | 'category' | 'price' | 'duration'): void {
    this.serviceGroupBy = groupBy;
  }

  toggleServicesViewMode(): void {
    this.servicesViewMode = this.servicesViewMode === 'grid' ? 'list' : 'grid';
  }

  getOriginFlag(originCode: string): string {
    const origins: { [key: string]: string } = {
      german: '🇩🇪',
      japanese: '🇯🇵',
      korean: '🇰🇷',
      american: '🇺🇸',
      french: '🇫🇷',
      italian: '🇮🇹',
      british: '🇬🇧',
      chinese: '🇨🇳',
      all: '🌍',
    };
    return origins[originCode] || '🌍';
  }

  getOriginName(originCode: string): string {
    const origins: { [key: string]: string } = {
      german: 'German',
      japanese: 'Japanese',
      korean: 'Korean',
      american: 'American',
      french: 'French',
      italian: 'Italian',
      british: 'British',
      chinese: 'Chinese',
      all: 'All Origins',
    };
    return origins[originCode] || originCode;
  }

  formatServiceDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0 && mins > 0) {
      return `${hours}h ${mins}m`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return `${mins}m`;
    }
  }

  formatServicePrice(minPrice: number, maxPrice: number): string {
    return `${minPrice.toLocaleString()} - ${maxPrice.toLocaleString()} EGP`;
  }

  getRemainingOrigins(service: Service): string {
    if (!service.carOriginSpecializations || service.carOriginSpecializations.length <= 3) {
      return '';
    }
    const remaining = service.carOriginSpecializations.slice(3);
    return remaining.map((code) => this.getOriginName(code)).join(', ');
  }

  // Enhanced header helper methods
  getUniqueOriginsCount(): number {
    if (!this.services || this.services.length === 0) {
      return 0;
    }

    const allOrigins = this.services
      .flatMap((service) => service.carOriginSpecializations || [])
      .filter((origin, index, self) => self.indexOf(origin) === index);

    return allOrigins.length;
  }

  getPriceRange(): string {
    if (!this.services || this.services.length === 0) {
      return '0 EGP';
    }

    const allPrices: number[] = [];

    this.services.forEach((service) => {
      if (service.originPricing && service.originPricing.length > 0) {
        service.originPricing.forEach((pricing) => {
          allPrices.push(pricing.minPrice);
          allPrices.push(pricing.maxPrice);
        });
      } else {
        // Fallback to service-level pricing if originPricing is not available
        allPrices.push(service.minPrice);
        allPrices.push(service.maxPrice);
      }
    });

    if (allPrices.length === 0) {
      return '0 EGP';
    }

    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);

    if (minPrice === maxPrice) {
      return `${minPrice.toLocaleString()} EGP`;
    }

    return `${minPrice.toLocaleString()} - ${maxPrice.toLocaleString()} EGP`;
  }
}
