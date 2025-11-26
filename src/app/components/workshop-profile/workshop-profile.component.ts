import { Component, OnInit, OnDestroy, ChangeDetectorRef, HostListener, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { WorkshopProfileService } from '../../services/workshop-profile.service';
import { Subscription } from 'rxjs';
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
  originPricing?: Array<{ originCode: string; originName: string; minPrice: number; maxPrice: number; isEnabled: boolean }>;
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

  // Gallery slider state
  currentImageIndex: number = 0;
  isAnimating: boolean = false;

  private routeSubscription?: Subscription;
  private profileSubscription?: Subscription;
  private photosSubscription?: Subscription;

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
  
  // Add Service Modal state
  showAddServiceModal = false;
  serviceGroupBy: 'origin' | 'category' | 'price' | 'duration' = 'origin';
  servicesViewMode: 'grid' | 'list' = 'grid';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private workshopProfileService: WorkshopProfileService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  // Auto-play interval (optional)
  private sliderInterval?: any;

  ngOnInit(): void {
    console.log('ngOnInit called');

    // Load data immediately on init
    this.loadWorkshopData();

    // Also subscribe to route changes for navigation
    this.routeSubscription = this.route.paramMap.subscribe(() => {
      console.log('Route param changed');
      this.loadWorkshopData();
    });
  }

  ngOnDestroy(): void {
    if (this.routeSubscription) this.routeSubscription.unsubscribe();
    if (this.profileSubscription) this.profileSubscription.unsubscribe();
    if (this.photosSubscription) this.photosSubscription.unsubscribe();
  }

  loadWorkshopData(): void {
    // Cancel any existing API calls
    if (this.profileSubscription) this.profileSubscription.unsubscribe();
    if (this.photosSubscription) this.photosSubscription.unsubscribe();

    this.errorMessage = '';

    const workshopIdFromRoute = this.route.snapshot.paramMap.get('id');
    const currentUserId = this.authService.getUserId();
    this.workshopId = workshopIdFromRoute || currentUserId || '';

    console.log('Calling API...');

    // Load workshop profile from API - backend handles permissions
    this.profileSubscription = this.workshopProfileService.getMyWorkshopProfile().subscribe({
      next: (response) => {
        console.log('Workshop Profile API Response:', response);

        // Extract data from response
        const data = response?.data ?? response;
        console.log('Extracted data:', data);

        if (!data || !data.id) {
          console.log('No valid profile data');
          this.errorMessage = 'No profile data found';
          return;
        }

        // Assign to profileData
        this.profileData = data;
        console.log('profileData assigned:', this.profileData);
        console.log('Profile name:', this.profileData.name);

        // Force change detection
        this.cdr.detectChanges();
        console.log('Change detection triggered');

        // Load photos if we have workshop ID
        if (this.profileData.id) {
          this.loadPhotos(this.profileData.id);
          this.loadWorkingHours(this.profileData.id);
        }
      },
      error: (error) => {
        console.error('Error loading workshop profile:', error);
        this.errorMessage = 'Failed to load workshop profile. Please try again.';
        this.profileData = {};
      },
    });
  }

  loadWorkingHours(workshopId: number): void {
    this.workshopProfileService.getWorkshopWorkingHours(workshopId).subscribe({
      next: (apiHours) => {
        console.log('Working Hours API Response:', apiHours);

        // Convert API format to display format and organize by day
        const hoursMap: any = {};
        const daysOrder = [
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
          'Sunday',
        ];

        apiHours.forEach((hour) => {
          hoursMap[hour.day] = {
            openTime: hour.from,
            closeTime: hour.to,
            isClosed: hour.isClosed,
          };
        });

        // Don't add default hours for days not in API response
        this.workingHours = hoursMap;
        console.log('Working Hours loaded:', this.workingHours);
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading working hours:', error);
        // Set empty working hours if API fails
        this.workingHours = {};
      },
    });
  }

  private setDefaultWorkingHours(): void {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    this.workingHours = {};
    days.forEach((day) => {
      this.workingHours[day] = {
        openTime: '09:00',
        closeTime: '17:00',
        isClosed: false,
      };
    });
  }

  loadPhotos(workshopId: string): void {
    const photosUrl = `https://localhost:44316/api/WorkShopPhoto/${workshopId}`;
    this.photosSubscription = this.http.get(photosUrl).subscribe({
      next: (response: any) => {
        this.photos = response?.data ?? response ?? [];
        this.currentImageIndex = 0;
        // Trigger change detection to update the view
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading photos:', error);
        this.photos = [];
        this.cdr.detectChanges();
      },
    });
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

  // ============================================
  // Add Service Modal Methods
  // ============================================

  openAddServiceModal(): void {
    console.log('Opening Add Service Modal...');
    this.showAddServiceModal = true;
    console.log('showAddServiceModal:', this.showAddServiceModal);
    this.cdr.detectChanges();
  }

  closeAddServiceModal(): void {
    console.log('Closing Add Service Modal...');
    this.showAddServiceModal = false;
    this.cdr.detectChanges();
  }

  handleServicesAdded(services: WorkshopServiceModel[]): void {
    console.log('Services added successfully:', services);
    
    // Update the services list
    this.workshopServices = [...this.workshopServices, ...services];
    
    // Reload services from API if workshop ID is available
    if (this.profileData?.id) {
      this.loadWorkshopServices();
    }
    
    // Refresh the catalog component
    if (this.catalogComponent) {
      console.log('Refreshing catalog component...');
      setTimeout(() => {
        this.catalogComponent?.loadServices();
      }, 500);
    }
    
    // Trigger change detection
    this.cdr.detectChanges();
  }

  /**
   * Handle service edited from catalog
   */
  onServiceEdited(service: any): void {
    console.log('Service edited:', service);
    // You can open an edit modal here or handle inline editing
    // For now, just log it
    alert('Edit functionality - coming soon!');
  }

  /**
   * Handle service deleted from catalog
   */
  onServiceDeleted(serviceId: number): void {
    console.log('Service deleted:', serviceId);
    // Reload services to reflect the deletion
    if (this.profileData?.id) {
      this.loadWorkshopServices();
    }
    this.cdr.detectChanges();
  }

  loadWorkshopServices(): void {
    if (!this.profileData?.id) return;
    
    this.workshopProfileService.getWorkshopServices(this.profileData.id).subscribe({
      next: (services) => {
        this.workshopServices = services;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading workshop services:', error);
      }
    });
  }

  deleteWorkshopService(serviceId: number): void {
    if (!confirm('Are you sure you want to delete this service?')) return;

    this.workshopProfileService.deleteWorkshopService(this.profileData.id, serviceId).subscribe({
      next: () => {
        this.workshopServices = this.workshopServices.filter(s => s.id !== serviceId);
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error deleting service:', error);
        alert('Failed to delete service. Please try again.');
      }
    });
  }

  toggleServiceAvailability(serviceId: number): void {
    this.workshopProfileService.toggleServiceAvailability(this.profileData.id, serviceId).subscribe({
      next: () => {
        const service = this.workshopServices.find(s => s.id === serviceId);
        if (service) {
          service.isAvailable = !service.isAvailable;
          this.cdr.detectChanges();
        }
      },
      error: (error) => {
        console.error('Error toggling service availability:', error);
      }
    });
  }

  getServicesByOrigin(): Map<string, WorkshopServiceModel[]> {
    const grouped = new Map<string, WorkshopServiceModel[]>();
    
    this.workshopServices.forEach(service => {
      service.carOriginSpecializations.forEach(origin => {
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
    
    this.workshopServices.forEach(service => {
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
      'german': '🇩🇪',
      'japanese': '🇯🇵',
      'korean': '🇰🇷',
      'american': '🇺🇸',
      'french': '🇫🇷',
      'italian': '🇮🇹',
      'british': '🇬🇧',
      'chinese': '🇨🇳',
      'all': '🌍'
    };
    return origins[originCode] || '🌍';
  }

  getOriginName(originCode: string): string {
    const origins: { [key: string]: string } = {
      'german': 'German',
      'japanese': 'Japanese',
      'korean': 'Korean',
      'american': 'American',
      'french': 'French',
      'italian': 'Italian',
      'british': 'British',
      'chinese': 'Chinese',
      'all': 'All Origins'
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
    return remaining.map(code => this.getOriginName(code)).join(', ');
  }

  // Enhanced header helper methods
  getUniqueOriginsCount(): number {
    if (!this.services || this.services.length === 0) {
      return 0;
    }
    
    const allOrigins = this.services
      .flatMap(service => service.carOriginSpecializations || [])
      .filter((origin, index, self) => self.indexOf(origin) === index);
    
    return allOrigins.length;
  }

  getPriceRange(): string {
    if (!this.services || this.services.length === 0) {
      return '0 EGP';
    }

    const allPrices: number[] = [];
    
    this.services.forEach(service => {
      if (service.originPricing && service.originPricing.length > 0) {
        service.originPricing.forEach(pricing => {
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
