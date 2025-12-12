import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  NgZone,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, forkJoin, of } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';

// API Response interfaces
interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

interface WorkshopProfileApi {
  id: number;
  name: string;
  description: string;
  numbersOfTechnicians: number;
  phoneNumber: string;
  rating: number;
  country: string;
  governorate: string;
  city: string;
  latitude: number;
  longitude: number;
  licenceImageUrl: string;
  logoImageUrl: string;
  verificationStatus: string;
  workShopType: string;
}

interface WorkingHoursApi {
  id: number;
  day: string;
  from: string;
  to: string;
  isClosed: boolean;
  workShopProfileId: number;
}

interface WorkshopServiceApi {
  id: number;
  serviceId: number;
  workShopProfileId: number;
  duration: number;
  minPrice: number;
  maxPrice: number;
  origin: string;
  serviceName: string;
  serviceDescription: string;
}

interface WorkshopServicesResponse {
  items: WorkshopServiceApi[];
  pageNumber: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

interface WorkshopPhotoApi {
  id: number;
  photoUrl: string;
  workShopProfileId: number;
}

interface ReviewApi {
  rating: number;
  comment: string;
  paidAmount: number;
  createdAt: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string;
}

// Component interfaces
interface WorkshopDetails {
  id: number;
  name: string;
  description: string;
  rating: number;
  reviewCount: number;
  city: string;
  governorate: string;
  country: string;
  phone: string;
  logoImageUrl: string;
  coverImageUrl: string;
  isOpen: boolean;
  workShopType: string;
  latitude: number;
  longitude: number;
  verificationStatus: string;
  workingHours: WorkingHours[];
  gallery: string[];
  reviews: Review[];
  amenities: string[];
  numbersOfTechnicians: number;
  distance?: number;
}

interface WorkingHours {
  day: string;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

interface WorkshopService {
  id: number;
  serviceId: number;
  serviceName: string;
  serviceDescription: string;
  duration: number;
  minPrice: number;
  maxPrice: number;
  origin: string;
}

interface Review {
  id: number;
  userName: string;
  userAvatar?: string;
  rating: number;
  comment: string;
  date: string;
  carModel?: string;
  paidAmount?: number;
}

interface RatingBar {
  stars: number;
  percentage: number;
  count: number;
}

@Component({
  selector: 'app-workshop-details',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './workshop-details.component.html',
  styleUrls: ['./workshop-details.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkshopDetailsComponent implements OnInit, OnDestroy {
  private readonly API_BASE_URL = 'https://korik-demo.runasp.net/api';

  workshop: WorkshopDetails | null = null;
  workshopServices: WorkshopService[] = [];
  // Pagination state for services
  servicesPageNumber = 1;
  servicesPageSize = 15;
  servicesTotalRecords = 0;
  servicesTotalPages = 0;
  isLoading = true;
  errorMessage = '';
  activeTab: 'overview' | 'services' | 'reviews' | 'gallery' = 'overview';
  selectedImage: string | null = null;
  isFavorited = false;
  ratingBars: RatingBar[] = [];
  currentHeroImage: string | null = null;

  private destroy$ = new Subject<void>();
  private workshopId: number = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.workshopId = +params['id'];
      this.loadWorkshopDetails();
    });
  }

  /**
   * Load services with pagination. Call this when services tab is active or page changes.
   */
  loadServices(page = this.servicesPageNumber, pageSize = this.servicesPageSize): void {
    this.servicesPageNumber = page;
    this.servicesPageSize = pageSize;

    this.http
      .get<ApiResponse<WorkshopServicesResponse>>(
        `${this.API_BASE_URL}/WorkshopService/Get-Workshop-Services-By-Profile-ID?Id=${this.workshopId}&PageNumber=${this.servicesPageNumber}&PageSize=${this.servicesPageSize}`
      )
      .pipe(
        takeUntil(this.destroy$),
        catchError((err) => of(null))
      )
      .subscribe((res) => {
        if (res && res.success && res.data) {
          this.workshopServices = res.data.items.map((service) => ({
            id: service.id,
            serviceId: service.serviceId,
            serviceName: service.serviceName,
            serviceDescription: service.serviceDescription,
            duration: service.duration,
            minPrice: service.minPrice,
            maxPrice: service.maxPrice,
            origin: service.origin,
          }));
          this.servicesTotalRecords = res.data.totalRecords ?? 0;
          this.servicesTotalPages =
            res.data.totalPages ??
            Math.ceil(this.servicesTotalRecords / this.servicesPageSize || 1);
        } else {
          this.workshopServices = [];
          this.servicesTotalRecords = 0;
          this.servicesTotalPages = 0;
        }
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      });
  }

  // Pagination helpers
  setServicesPage(page: number): void {
    if (page < 1 || page > this.servicesTotalPages) return;
    this.loadServices(page, this.servicesPageSize);
  }

  firstServicesPage(): void {
    this.setServicesPage(1);
  }

  lastServicesPage(): void {
    this.setServicesPage(this.servicesTotalPages || 1);
  }

  prevServicesPage(): void {
    this.setServicesPage(Math.max(1, this.servicesPageNumber - 1));
  }

  nextServicesPage(): void {
    this.setServicesPage(Math.min(this.servicesTotalPages || 1, this.servicesPageNumber + 1));
  }

  changeServicesPageSize(size: any): void {
    const newSize = typeof size === 'string' ? parseInt(size, 10) : Number(size);
    if (!newSize || newSize <= 0) return;
    this.servicesPageSize = newSize;
    this.servicesPageNumber = 1;
    this.loadServices(1, newSize);
  }

  getServicesShowingStart(): number {
    return (this.servicesPageNumber - 1) * this.servicesPageSize + 1;
  }

  getServicesShowingEnd(): number {
    const end = this.servicesPageNumber * this.servicesPageSize;
    return end > this.servicesTotalRecords ? this.servicesTotalRecords : end;
  }

  onServicesPageClick(p: number | '...') {
    if (p === '...') return;
    this.setServicesPage(p as number);
  }

  /**
   * Compute a compact pagination array. Returns numbers and '...' where appropriate.
   */
  getServicesPages(): Array<number | '...'> {
    const total = this.servicesTotalPages || 1;
    const current = this.servicesPageNumber || 1;
    const delta = 1; // neighbors
    const range: Array<number | '...'> = [];

    if (total <= 7) {
      for (let i = 1; i <= total; i++) range.push(i);
      return range;
    }

    const left = Math.max(2, current - delta);
    const right = Math.min(total - 1, current + delta);

    range.push(1);
    if (left > 2) range.push('...');

    for (let i = left; i <= right; i++) range.push(i);

    if (right < total - 1) range.push('...');
    range.push(total);
    return range;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadWorkshopDetails(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    // Fetch all data in parallel
    forkJoin({
      profile: this.http
        .get<ApiResponse<WorkshopProfileApi>>(
          `${this.API_BASE_URL}/WorkShopProfile/Get-WorkShop-ById-Profile?id=${this.workshopId}`
        )
        .pipe(
          catchError((err) => {
            console.error('Error loading workshop profile:', err);
            return of(null);
          })
        ),
      workingHours: this.http
        .get<ApiResponse<WorkingHoursApi[]>>(
          `${this.API_BASE_URL}/WorkShopWorkingHours/workshop/${this.workshopId}`
        )
        .pipe(
          catchError((err) => {
            console.error('Error loading working hours:', err);
            return of(null);
          })
        ),
      services: this.http
        .get<ApiResponse<WorkshopServicesResponse>>(
          `${this.API_BASE_URL}/WorkshopService/Get-Workshop-Services-By-Profile-ID?Id=${this.workshopId}&PageNumber=${this.servicesPageNumber}&PageSize=${this.servicesPageSize}`
        )
        .pipe(
          catchError((err) => {
            console.error('Error loading services:', err);
            return of(null);
          })
        ),
      photos: this.http
        .get<ApiResponse<WorkshopPhotoApi[]>>(
          `${this.API_BASE_URL}/WorkShopPhoto/${this.workshopId}`
        )
        .pipe(
          catchError((err) => {
            console.error('Error loading photos:', err);
            return of(null);
          })
        ),
      reviews: this.http
        .get<ApiResponse<ReviewApi[]>>(`${this.API_BASE_URL}/Review/all-Review/${this.workshopId}`)
        .pipe(
          catchError((err) => {
            console.error('Error loading reviews:', err);
            return of(null);
          })
        ),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (results) => {
          if (results.profile?.success && results.profile.data) {
            const profile = results.profile.data;

            // Map working hours
            const workingHours: WorkingHours[] =
              results.workingHours?.success && results.workingHours.data
                ? results.workingHours.data.map((wh) => ({
                    day: wh.day,
                    openTime: this.formatTime(wh.from),
                    closeTime: this.formatTime(wh.to),
                    isClosed: wh.isClosed,
                  }))
                : this.getDefaultWorkingHours();

            // Map gallery photos
            const gallery: string[] =
              results.photos?.success && results.photos.data && results.photos.data.length > 0
                ? results.photos.data.map((photo) => this.getFullImageUrl(photo.photoUrl))
                : [];

            // Map services
            this.workshopServices =
              results.services?.success && results.services.data?.items
                ? results.services.data.items.map((service) => ({
                    id: service.id,
                    serviceId: service.serviceId,
                    serviceName: service.serviceName,
                    serviceDescription: service.serviceDescription,
                    duration: service.duration,
                    minPrice: service.minPrice,
                    maxPrice: service.maxPrice,
                    origin: service.origin,
                  }))
                : [];

            // Map reviews from API
            const reviews: Review[] =
              results.reviews?.success && results.reviews.data
                ? results.reviews.data.map((review, index) => ({
                    id: index + 1,
                    userName: `${review.firstName} ${review.lastName}`.trim() || 'Customer',
                    userAvatar: review.profileImageUrl
                      ? this.getFullImageUrl(review.profileImageUrl)
                      : undefined,
                    rating: review.rating,
                    comment: review.comment,
                    date: review.createdAt,
                    paidAmount: review.paidAmount,
                  }))
                : [];

            // Calculate average rating from reviews if profile rating is 0
            const avgRating =
              reviews.length > 0
                ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
                : profile.rating || 0;

            // Create workshop details object
            this.workshop = {
              id: profile.id,
              name: profile.name,
              description:
                profile.description ||
                'Professional automotive services with experienced technicians.',
              rating: profile.rating || avgRating,
              reviewCount: reviews.length,
              city: profile.city,
              governorate: profile.governorate,
              country: profile.country,
              phone: profile.phoneNumber,
              logoImageUrl: this.getFullImageUrl(profile.logoImageUrl),
              coverImageUrl: gallery.length > 0 ? gallery[0] : this.getDefaultCoverImage(),
              isOpen: this.checkIfOpen(workingHours),
              workShopType: profile.workShopType,
              latitude: profile.latitude,
              longitude: profile.longitude,
              verificationStatus: profile.verificationStatus,
              workingHours: workingHours,
              gallery: gallery,
              reviews: reviews,
              amenities: this.getDefaultAmenities(),
              numbersOfTechnicians: profile.numbersOfTechnicians,
            };

            this.calculateRatingBars();
            this.isLoading = false;
            this.cdr.markForCheck();
            this.cdr.detectChanges();
          } else {
            this.errorMessage = 'Workshop not found. Please try again.';
            this.isLoading = false;
            this.cdr.markForCheck();
            this.cdr.detectChanges();
          }
        },
        error: (error) => {
          console.error('Error loading workshop details:', error);
          this.errorMessage = 'Failed to load workshop details. Please try again.';
          this.isLoading = false;
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        },
      });
  }

  private formatTime(time: string): string {
    if (!time) return '00:00';
    // Handle format like "09:00:00" -> "09:00"
    const parts = time.split(':');
    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1]}`;
    }
    return time;
  }

  private getFullImageUrl(url: string | null): string {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `https://korik-demo.runasp.net${url}`;
  }

  private checkIfOpen(workingHours: WorkingHours[]): boolean {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = days[new Date().getDay()];
    const todayHours = workingHours.find((h) => h.day === today);

    if (!todayHours || todayHours.isClosed) return false;

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;

    return currentTime >= todayHours.openTime && currentTime <= todayHours.closeTime;
  }

  private getDefaultWorkingHours(): WorkingHours[] {
    return [
      { day: 'Sunday', openTime: '09:00', closeTime: '17:00', isClosed: false },
      { day: 'Monday', openTime: '09:00', closeTime: '17:00', isClosed: false },
      { day: 'Tuesday', openTime: '09:00', closeTime: '17:00', isClosed: false },
      { day: 'Wednesday', openTime: '09:00', closeTime: '17:00', isClosed: false },
      { day: 'Thursday', openTime: '09:00', closeTime: '17:00', isClosed: false },
      { day: 'Friday', openTime: '09:00', closeTime: '17:00', isClosed: true },
      { day: 'Saturday', openTime: '09:00', closeTime: '17:00', isClosed: false },
    ];
  }

  private getDefaultCoverImage(): string {
    return 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=1200&h=600&fit=crop';
  }

  private getDefaultAmenities(): string[] {
    return ['Parking', 'Card Payment', 'WiFi'];
  }

  setActiveTab(tab: 'overview' | 'services' | 'reviews' | 'gallery'): void {
    this.activeTab = tab;
    if (tab === 'services') {
      // load services for current page when services tab is opened
      this.loadServices(this.servicesPageNumber, this.servicesPageSize);
    }
  }

  setAsHeroImage(imageUrl: string): void {
    this.currentHeroImage = imageUrl;
    this.cdr.markForCheck();
    // Scroll to top to show the new cover
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  openImageModal(imageUrl: string): void {
    this.selectedImage = imageUrl;
  }

  closeImageModal(): void {
    this.selectedImage = null;
  }

  previousImage(): void {
    if (this.workshop?.gallery && this.selectedImage) {
      const currentIndex = this.workshop.gallery.indexOf(this.selectedImage);
      if (currentIndex > 0) {
        this.selectedImage = this.workshop.gallery[currentIndex - 1];
      } else {
        this.selectedImage = this.workshop.gallery[this.workshop.gallery.length - 1];
      }
    }
  }

  nextImage(): void {
    if (this.workshop?.gallery && this.selectedImage) {
      const currentIndex = this.workshop.gallery.indexOf(this.selectedImage);
      if (currentIndex < this.workshop.gallery.length - 1) {
        this.selectedImage = this.workshop.gallery[currentIndex + 1];
      } else {
        this.selectedImage = this.workshop.gallery[0];
      }
    }
  }

  goBack(): void {
    this.router.navigate(['/workshops']);
  }

  /**
   * Navigate to booking page with workshop and optionally service pre-selected
   */
  bookService(service?: WorkshopService): void {
    if (this.workshop) {
      const queryParams: any = {
        workshopId: this.workshop.id,
        workshopName: this.workshop.name,
      };

      // If a specific service is selected, include its details
      if (service) {
        queryParams.workshopServiceId = service.id;
        queryParams.serviceId = service.serviceId;
        queryParams.serviceName = service.serviceName;
        queryParams.minPrice = service.minPrice;
        queryParams.maxPrice = service.maxPrice;
        if (service.origin) {
          queryParams.origin = service.origin;
        }
      }

      this.router.navigate(['/booking'], { queryParams });
    }
  }

  callWorkshop(): void {
    if (this.workshop?.phone) {
      window.location.href = `tel:${this.workshop.phone}`;
    }
  }

  emailWorkshop(): void {
    // Email not available in API, could add contact form
  }

  openMaps(): void {
    if (this.workshop) {
      const url = `https://www.google.com/maps?q=${this.workshop.latitude},${this.workshop.longitude}`;
      window.open(url, '_blank');
    }
  }

  getInitials(name: string): string {
    if (!name) return 'WS';
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }

  getStarArray(rating: number): number[] {
    const stars: number[] = [];
    for (let i = 1; i <= 5; i++) {
      if (rating >= i) {
        stars.push(1); // full star
      } else if (rating >= i - 0.5) {
        stars.push(0.5); // half star
      } else {
        stars.push(0); // empty star
      }
    }
    return stars;
  }

  getTodayHours(): string {
    if (!this.workshop?.workingHours) return 'Hours not available';

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = days[new Date().getDay()];
    const todayHours = this.workshop.workingHours.find((h) => h.day === today);

    if (!todayHours || todayHours.isClosed) return 'Closed today';
    return `${todayHours.openTime} - ${todayHours.closeTime}`;
  }

  scrollToReviews(): void {
    const reviewsList = document.querySelector('.reviews-list');
    if (reviewsList) {
      reviewsList.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  shareWorkshop(): void {
    if (this.workshop) {
      const shareData = {
        title: this.workshop.name,
        text: `Check out ${this.workshop.name} - ${this.workshop.description?.substring(
          0,
          100
        )}...`,
        url: window.location.href,
      };

      if (navigator.share) {
        navigator.share(shareData).catch(console.error);
      } else {
        navigator.clipboard
          .writeText(window.location.href)
          .then(() => {
            alert('Link copied to clipboard!');
          })
          .catch(console.error);
      }
    }
  }

  toggleFavorite(): void {
    this.isFavorited = !this.isFavorited;
  }

  formatWorkshopType(type: string): string {
    if (!type) return 'General';
    return type
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .trim()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  formatDistance(distance: number | undefined): string {
    if (distance === undefined || distance === null) return 'Distance N/A';
    if (distance < 1) {
      return `${Math.round(distance * 1000)} m`;
    }
    return `${distance.toFixed(1)} km`;
  }

  isToday(day: string): boolean {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = days[new Date().getDay()];
    return day === today;
  }

  formatServicePrice(service: WorkshopService): string {
    if (service.minPrice === service.maxPrice) {
      return `${service.minPrice} EGP`;
    }
    return `${service.minPrice} - ${service.maxPrice} EGP`;
  }

  formatServiceDuration(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) {
      return `${hours} hr`;
    }
    return `${hours} hr ${mins} min`;
  }

  private calculateRatingBars(): void {
    if (!this.workshop?.reviews || this.workshop.reviews.length === 0) {
      this.ratingBars = [5, 4, 3, 2, 1].map((stars) => ({
        stars,
        percentage: 0,
        count: 0,
      }));
      return;
    }

    const totalReviews = this.workshop.reviews.length;
    const ratingCounts: { [key: number]: number } = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

    this.workshop.reviews.forEach((review) => {
      const roundedRating = Math.round(review.rating);
      if (roundedRating >= 1 && roundedRating <= 5) {
        ratingCounts[roundedRating]++;
      }
    });

    this.ratingBars = [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      percentage: totalReviews > 0 ? (ratingCounts[stars] / totalReviews) * 100 : 0,
      count: ratingCounts[stars],
    }));
  }
}
