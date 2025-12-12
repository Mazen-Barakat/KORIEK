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
        const photosUrl = `https://localhost:44316/WorkShopPhoto/${data.id}`;

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
    const reviewsUrl = `https://korik-demo.runasp.net/api/Review/all-Review/${workshopId}`;

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
    return `https://korik-demo.runasp.net${url.startsWith('/') ? '' : '/'}${url}`;
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
    const baseUrl = 'https://korik-demo.runasp.net';
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

  getKoriekProfileSlug(): string {
    const name = this.profileData?.name || 'workshop';
    const slug = name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    return `koriek.com/workshop/${slug}`;
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

  // ==================== PDF Export ====================
  exportToPDF(): void {
    const workshopName = this.profileData?.name || 'Workshop';
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Get services from catalog component if available
    const catalogServices = this.catalogComponent?.allServices || this.workshopServices || [];

    // Group services by origin for the PDF
    const servicesByOrigin = this.groupServicesByOrigin(catalogServices);

    // Format rating properly
    const formattedRating = this.profileData?.rating
      ? Number(this.profileData.rating).toFixed(1)
      : '0.0';

    const printContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>KORIEK - ${workshopName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      color: #1f2937;
      line-height: 1.5;
      padding: 40px;
      max-width: 900px;
      margin: 0 auto;
    }

    /* Header - KORIEK Brand */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 20px;
      border-bottom: 3px solid #ef4444;
      margin-bottom: 30px;
    }
    .header-left {
      display: flex;
      flex-direction: column;
    }
    .header-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
    }
    .koriek-logo {
      width: 70px;
      height: auto;
    }
    .logo { font-size: 28px; font-weight: 700; color: #ef4444; }
    .report-title { font-size: 14px; color: #6b7280; margin-top: 4px; }
    .report-date { font-size: 12px; color: #9ca3af; text-align: right; }

    /* Workshop Header - Clean Professional Design */
    .workshop-header {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 24px 28px;
      margin-bottom: 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
      display: flex;
      align-items: center;
      gap: 20px;
    }
    .workshop-logo {
      width: 70px;
      height: 70px;
      border-radius: 12px;
      object-fit: cover;
      border: 2px solid #e5e7eb;
      flex-shrink: 0;
    }
    .workshop-logo-placeholder {
      width: 70px;
      height: 70px;
      border-radius: 12px;
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 24px;
      font-weight: 700;
      flex-shrink: 0;
    }
    .workshop-info {
      flex: 1;
    }
    .workshop-name-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }
    .workshop-name {
      font-size: 26px;
      font-weight: 800;
      color: #111827;
      letter-spacing: -0.5px;
    }
    .verified-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #10b981;
      color: white;
      padding: 5px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .workshop-type-badge {
      display: inline-block;
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      color: white;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      box-shadow: 0 2px 6px rgba(59, 130, 246, 0.3);
      margin-top: 4px;
    }

    /* Stats Summary */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }
    .summary-card {
      background: #f9fafb;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }
    .summary-card.rating { border-left: 4px solid #f59e0b; }
    .summary-card.reviews { border-left: 4px solid #3b82f6; }
    .summary-card.services { border-left: 4px solid #22c55e; }
    .summary-card.techs { border-left: 4px solid #ef4444; }
    .summary-number { font-size: 28px; font-weight: 700; }
    .summary-card.rating .summary-number { color: #f59e0b; }
    .summary-card.reviews .summary-number { color: #3b82f6; }
    .summary-card.services .summary-number { color: #22c55e; }
    .summary-card.techs .summary-number { color: #ef4444; }
    .summary-label { font-size: 11px; color: #6b7280; text-transform: uppercase; }

    /* Sections */
    .section {
      margin-bottom: 28px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 16px;
      font-weight: 700;
      color: #111827;
      padding-bottom: 8px;
      border-bottom: 2px solid #e5e7eb;
      margin-bottom: 16px;
    }

    /* Contact Grid */
    .contact-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }
    .contact-item { }
    .contact-label { font-size: 11px; color: #9ca3af; text-transform: uppercase; }
    .contact-value { font-size: 14px; font-weight: 600; color: #374151; }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    th {
      background: #f3f4f6;
      padding: 10px 12px;
      text-align: left;
      font-weight: 600;
      color: #374151;
      border-bottom: 2px solid #e5e7eb;
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    tr:last-child td { border-bottom: none; }

    .hours-closed { color: #ef4444; font-weight: 500; }
    .hours-open { color: #22c55e; }

    /* Services Origin Groups */
    .origin-group {
      margin-bottom: 20px;
      page-break-inside: avoid;
    }
    .origin-header {
      background: linear-gradient(135deg, #fee2e2 0%, #fef3c7 100%);
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .origin-name { font-size: 16px; font-weight: 600; color: #111827; }
    .origin-count {
      background: #ef4444;
      color: white;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
    }

    .service-name { font-weight: 600; color: #1e293b; }
    .service-description { font-size: 12px; color: #64748b; margin-top: 4px; }

    .price-badge {
      background: #dcfce7;
      color: #166534;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
    }
    .duration-badge {
      background: #fee2e2;
      color: #991b1b;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 11px;
    }

    /* Reviews */
    .reviews-summary {
      display: flex;
      align-items: center;
      gap: 30px;
      margin-bottom: 20px;
      padding: 20px;
      background: linear-gradient(135deg, #fee2e2 0%, #fef3c7 100%);
      border-radius: 10px;
    }
    .average-rating { text-align: center; }
    .rating-number { font-size: 48px; font-weight: 700; color: #111827; line-height: 1; }
    .stars { color: #f59e0b; font-size: 18px; margin: 8px 0; }
    .rating-count { font-size: 13px; color: #6b7280; }

    .rating-bars { flex: 1; }
    .rating-bar-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }
    .bar-label { font-size: 12px; color: #6b7280; min-width: 50px; }
    .bar-track {
      flex: 1;
      height: 8px;
      background: #e5e7eb;
      border-radius: 4px;
      overflow: hidden;
    }
    .bar-fill { height: 100%; background: #f59e0b; border-radius: 4px; }
    .bar-count { font-size: 12px; color: #6b7280; min-width: 30px; text-align: right; }

    .review-item {
      padding: 16px;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      margin-bottom: 12px;
      page-break-inside: avoid;
    }
    .review-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .reviewer-name { font-weight: 600; color: #1e293b; }
    .review-date { font-size: 12px; color: #64748b; }
    .review-rating { color: #f59e0b; font-size: 14px; }
    .review-comment { font-size: 14px; color: #475569; line-height: 1.6; }

    /* About */
    .about-text { font-size: 14px; color: #475569; line-height: 1.8; }

    /* Footer */
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #9ca3af;
      font-size: 11px;
    }
    .footer-brand { font-weight: 700; color: #ef4444; }

    .no-data { color: #9ca3af; font-style: italic; padding: 20px; text-align: center; }

    @media print {
      body { padding: 20px; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <div class="logo">KORIEK</div>
      <div class="report-title">Workshop Profile Report</div>
    </div>
    <div class="header-right">
      <img class="koriek-logo" src="${
        window.location.origin
      }/Assets/logo.png" alt="KORIEK Logo" onerror="this.style.display='none'" />
      <div class="report-date">Generated: ${currentDate}</div>
    </div>
  </div>

  <div class="workshop-header">
    ${
      this.profileData?.logoImageUrl
        ? `<img class="workshop-logo" src="${this.buildAssetUrl(
            this.profileData.logoImageUrl
          )}" alt="${workshopName} logo" />`
        : `<div class="workshop-logo-placeholder">${this.generateInitials(workshopName)}</div>`
    }
    <div class="workshop-info">
      <div class="workshop-name-row">
        <span class="workshop-name">${workshopName}</span>
        ${
          this.profileData?.verificationStatus === 'Verified'
            ? '<span class="verified-badge">✓ Verified</span>'
            : ''
        }
      </div>
      ${
        this.profileData?.workShopType
          ? `<span class="workshop-type-badge">${this.profileData.workShopType}</span>`
          : ''
      }
    </div>
  </div>

  <div class="summary-grid">
    <div class="summary-card rating">
      <div class="summary-number">${formattedRating}</div>
      <div class="summary-label">Rating</div>
    </div>
    <div class="summary-card reviews">
      <div class="summary-number">${this.reviews?.length || 0}</div>
      <div class="summary-label">Reviews</div>
    </div>
    <div class="summary-card services">
      <div class="summary-number">${catalogServices?.length || 0}</div>
      <div class="summary-label">Services</div>
    </div>
    <div class="summary-card techs">
      <div class="summary-number">${this.profileData?.numbersOfTechnicians || 0}</div>
      <div class="summary-label">Technicians</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Contact Information</div>
    <div class="contact-grid">
      <div class="contact-item">
        <div class="contact-label">Phone</div>
        <div class="contact-value">${this.profileData?.phoneNumber || 'Not provided'}</div>
      </div>
      <div class="contact-item">
        <div class="contact-label">Email</div>
        <div class="contact-value">${this.profileData?.email || 'Not provided'}</div>
      </div>
      <div class="contact-item">
        <div class="contact-label">Website</div>
        <div class="contact-value">${this.profileData?.website || 'Not provided'}</div>
      </div>
      <div class="contact-item">
        <div class="contact-label">Location</div>
        <div class="contact-value">${
          this.profileData?.latitude && this.profileData?.longitude
            ? `${this.profileData.latitude.toFixed(4)}, ${this.profileData.longitude.toFixed(4)}`
            : 'Not provided'
        }</div>
      </div>
    </div>
  </div>

  ${
    this.profileData?.description
      ? `
  <div class="section">
    <div class="section-title">About</div>
    <p class="about-text">${this.profileData.description}</p>
  </div>
  `
      : ''
  }

  ${this.generateWorkingHoursHTML()}

  ${this.generateServicesHTML(servicesByOrigin)}

  ${this.generateReviewsHTML()}

  <div class="footer">
    <p>This report was generated by <span class="footer-brand">KORIEK</span></p>
    <p>© ${new Date().getFullYear()} All rights reserved</p>
  </div>
</body>
</html>
    `;

    // Create a hidden iframe for printing instead of opening new window
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.left = '-9999px';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(printContent);
      iframeDoc.close();

      // Wait for content to load then print
      iframe.onload = () => {
        setTimeout(() => {
          iframe.contentWindow?.print();
          // Remove iframe after printing
          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 1000);
        }, 250);
      };
    }
  }

  private groupServicesByOrigin(services: any[]): Map<string, any[]> {
    const grouped = new Map<string, any[]>();

    services.forEach((service) => {
      const origin = service.origin || 'Other';
      if (!grouped.has(origin)) {
        grouped.set(origin, []);
      }
      grouped.get(origin)!.push(service);
    });

    return grouped;
  }

  private generateWorkingHoursHTML(): string {
    if (!this.workingHours || Object.keys(this.workingHours).length === 0) {
      return '';
    }

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let rows = '';

    days.forEach((day, index) => {
      const hours = this.workingHours[day];
      let status: string;
      const isClosed = !hours || hours.isClosed;

      if (isClosed) {
        status = 'Closed';
      } else {
        status = `${hours.openTime || 'N/A'} - ${hours.closeTime || 'N/A'}`;
      }

      const isOpen = !isClosed;
      const dayNumber = index + 1;

      rows += `
        <div class="working-hours-item ${isOpen ? 'open' : 'closed'}">
          <div class="day-info">
            <div class="day-name">${day}</div>
            <div class="day-number">Day ${dayNumber}</div>
          </div>
          <div class="hours-content">
            <div class="hours-time ${isOpen ? 'open-text' : 'closed-text'}">${status}</div>
          </div>
          <div class="status-indicator">
            <span class="status-dot ${isOpen ? 'open' : 'closed'}"></span>
          </div>
        </div>
      `;
    });

    return `
    <div class="section">
      <div class="working-hours-header">
        <div class="working-hours-title-wrapper">
          <h3 class="working-hours-title">Working Hours</h3>
          <p class="working-hours-subtitle">7 days service availability</p>
        </div>
        <div class="working-hours-badge">Open Today</div>
      </div>
      <div class="working-hours-grid">
        ${rows}
      </div>
    </div>
    `;
  }

  private generateServicesHTML(servicesByOrigin: Map<string, any[]>): string {
    if (servicesByOrigin.size === 0) {
      return '';
    }

    let html = `
    <div class="section">
      <div class="section-title">Services Catalog</div>
    `;

    servicesByOrigin.forEach((services, origin) => {
      html += `
      <div class="origin-group">
        <div class="origin-header">
          <span class="origin-name">${this.getOriginDisplayName(origin)}</span>
          <span class="origin-count">${services.length} service${
        services.length > 1 ? 's' : ''
      }</span>
        </div>
        <table class="services-table">
          <thead>
            <tr>
              <th style="width: 50%">Service</th>
              <th style="width: 30%">Price Range</th>
              <th style="width: 20%">Duration</th>
            </tr>
          </thead>
          <tbody>
      `;

      services.forEach((service) => {
        const price =
          service.minPrice !== undefined && service.maxPrice !== undefined
            ? `${service.minPrice.toLocaleString()} - ${service.maxPrice.toLocaleString()} EGP`
            : 'Price varies';
        const duration = service.duration ? this.formatDuration(service.duration) : 'Varies';

        html += `
            <tr>
              <td>
                <div class="service-name">${
                  service.serviceName || service.name || 'Unnamed Service'
                }</div>
                ${
                  service.serviceDescription
                    ? `<div class="service-description">${service.serviceDescription}</div>`
                    : ''
                }
              </td>
              <td><span class="price-badge">${price}</span></td>
              <td><span class="duration-badge">${duration}</span></td>
            </tr>
        `;
      });

      html += `
          </tbody>
        </table>
      </div>
      `;
    });

    html += '</div>';
    return html;
  }

  private getOriginDisplayName(origin: string): string {
    const originNames: { [key: string]: string } = {
      EU: 'European',
      USA: 'American',
      JAP: 'Japanese',
      KOR: 'Korean',
      CHI: 'Chinese',
      Other: 'Other Origins',
    };
    return originNames[origin] || origin;
  }

  private generateReviewsHTML(): string {
    if (!this.reviews || this.reviews.length === 0) {
      return '';
    }

    // Rating bars HTML
    let ratingBarsHTML = '';
    this.ratingBars.forEach((bar) => {
      ratingBarsHTML += `
        <div class="rating-bar-row">
          <span class="bar-label">${bar.stars} stars</span>
          <div class="bar-track">
            <div class="bar-fill" style="width: ${bar.percentage}%"></div>
          </div>
          <span class="bar-count">${bar.count}</span>
        </div>
      `;
    });

    // Reviews list HTML (show top 5 for PDF)
    const displayReviews = this.reviews.slice(0, 5);
    let reviewsListHTML = '';
    displayReviews.forEach((review) => {
      const stars =
        '★'.repeat(Math.round(review.rating)) + '☆'.repeat(5 - Math.round(review.rating));
      const date = new Date(review.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

      reviewsListHTML += `
        <div class="review-item">
          <div class="review-header">
            <div>
              <span class="reviewer-name">${review.userName}</span>
              <span class="review-date"> • ${date}</span>
            </div>
            <span class="review-rating">${stars}</span>
          </div>
          <p class="review-comment">${review.comment || 'No comment provided.'}</p>
        </div>
      `;
    });

    return `
    <div class="section">
      <div class="section-title">Customer Reviews (Top 5)</div>
      <div class="reviews-summary">
        <div class="average-rating">
          <div class="rating-number">${this.averageRating.toFixed(1)}</div>
          <div class="stars">★★★★★</div>
          <div class="rating-count">${this.reviews.length} review${
      this.reviews.length > 1 ? 's' : ''
    }</div>
        </div>
        <div class="rating-bars">
          ${ratingBarsHTML}
        </div>
      </div>
      ${reviewsListHTML}
      ${
        this.reviews.length > 5
          ? `<p style="text-align: center; color: #64748b; margin-top: 16px;">Showing 5 of ${this.reviews.length} reviews</p>`
          : ''
      }
    </div>
    `;
  }
}
