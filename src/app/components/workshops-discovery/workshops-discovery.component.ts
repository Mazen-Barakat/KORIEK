import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  NgZone,
  ApplicationRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { GeolocationService } from '../../services/geolocation.service';
import { WorkshopProfileService } from '../../services/workshop-profile.service';
import { GOVERNORATES, EGYPTIAN_CITIES_BY_GOVERNORATE } from '../../models/workshop-profile.model';

interface Workshop {
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
  // Computed/display properties
  distance: number;
}

interface FilterOptions {
  workShopType: string;
  origin: string;
  governorate: string;
  city: string;
  nearestFirst: boolean;
  ratingSort: string; // '' = normal, 'desc' = highest first, 'asc' = lowest first
}

@Component({
  selector: 'app-workshops-discovery',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './workshops-discovery.component.html',
  styleUrls: ['./workshops-discovery.component.css'],
})
export class WorkshopsDiscoveryComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  workshops: Workshop[] = [];
  filteredWorkshops: Workshop[] = [];
  isLoading = true;
  isRequestingLocation = false;
  errorMessage = '';

  // User location
  userLatitude: number | null = null;
  userLongitude: number | null = null;
  locationError = '';

  // Search
  searchQuery = '';

  // Filters
  filters: FilterOptions = {
    workShopType: '',
    origin: '',
    governorate: '',
    city: '',
    nearestFirst: false,
    ratingSort: '',
  };

  showFilters = false;

  // Pagination
  currentPage = 1;
  pageSize = 15;
  totalRecords = 0;
  totalPages = 0;
  hasNextPage = false;
  hasPreviousPage = false;

  // Cities based on selected governorate
  filteredCities: string[] = [];

  // Available filter options
  workshopTypes = [
    { value: '', label: 'All Types' },
    { value: 'Independent', label: 'Independent' },
    { value: 'MaintainanceCenter', label: 'Maintenance Center' },
    { value: 'Specialized', label: 'Specialized' },
    { value: 'Mobile', label: 'Mobile' },
  ];

  carOrigins = [
    { value: '', label: 'All Origins' },
    { value: 'General', label: 'General' },
    { value: 'Germany', label: 'Germany 🇩🇪' },
    { value: 'Japan', label: 'Japan 🇯🇵' },
    { value: 'SouthKorea', label: 'South Korea 🇰🇷' },
    { value: 'USA', label: 'USA 🇺🇸' },
    { value: 'China', label: 'China 🇨🇳' },
    { value: 'France', label: 'France 🇫🇷' },
    { value: 'Italy', label: 'Italy 🇮🇹' },
    { value: 'CzechRepublic', label: 'Czech Republic 🇨🇿' },
    { value: 'Sweden', label: 'Sweden 🇸🇪' },
    { value: 'UK', label: 'UK 🇬🇧' },
    { value: 'Malaysia', label: 'Malaysia 🇲🇾' },
  ];

  governorates = GOVERNORATES;

  private apiUrl = 'https://localhost:44316/api';

  constructor(
    private http: HttpClient,
    private router: Router,
    private geolocationService: GeolocationService,
    private workshopProfileService: WorkshopProfileService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private appRef: ApplicationRef
  ) {}

  ngOnInit(): void {
    this.setupSearchDebounce();
    // Clear any previous location errors
    this.locationError = '';
    // Load workshops immediately without requesting location
    this.loadWorkshops();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSearchDebounce(): void {
    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.currentPage = 1;
        this.loadWorkshops();
      });
  }

  onSearchInput(): void {
    this.searchSubject.next(this.searchQuery);
  }

  loadWorkshops(): void {
    this.isLoading = true;
    this.errorMessage = '';

    const params: any = {
      pageNumber: this.currentPage,
      pageSize: this.pageSize,
    };

    // Add search query as name filter
    if (this.searchQuery.trim()) {
      params.name = this.searchQuery.trim();
    }

    // Add location if nearestFirst is checked and we have location
    if (this.filters.nearestFirst && this.userLatitude && this.userLongitude) {
      params.latitude = this.userLatitude;
      params.longitude = this.userLongitude;
    }

    // Add filters
    if (this.filters.workShopType) {
      params.workShopType = this.filters.workShopType;
    }
    if (this.filters.origin) {
      params.origin = this.filters.origin;
    }
    if (this.filters.governorate) {
      params.governorate = this.filters.governorate;
    }
    if (this.filters.city) {
      params.city = this.filters.city;
    }

    // Add rating sort
    if (this.filters.ratingSort === 'desc') {
      params.descRating = true;
    } else if (this.filters.ratingSort === 'asc') {
      params.descRating = false;
    }

    this.workshopProfileService
      .getAllWorkshopProfiles(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('API Response:', response);
          if (response?.success && response?.data) {
            const workshopsData = response.data.items || [];
            this.workshops = this.processWorkshops(workshopsData);
            this.totalRecords = response.data.totalRecords || 0;
            this.totalPages = response.data.totalPages || 0;
            this.hasNextPage = response.data.hasNextPage || false;
            this.hasPreviousPage = response.data.hasPreviousPage || false;
            this.applyLocalFilters();
          } else {
            this.workshops = [];
            this.filteredWorkshops = [];
          }
          this.isLoading = false;
          console.log('Setting isLoading=false, workshops:', this.filteredWorkshops.length);
          // Force full application change detection
          this.cdr.markForCheck();
          this.cdr.detectChanges();
          this.appRef.tick();
        },
        error: (error) => {
          console.error('Error loading workshops:', error);
          this.errorMessage = 'Failed to load workshops. Please try again.';
          this.isLoading = false;
          this.cdr.markForCheck();
          this.cdr.detectChanges();
          this.appRef.tick();
        },
      });
  }

  private processWorkshops(data: any[]): Workshop[] {
    return data.map((w: any) => ({
      id: w.id,
      name: w.name || 'Unknown Workshop',
      description: w.description || '',
      numbersOfTechnicians: w.numbersOfTechnicians || 0,
      phoneNumber: w.phoneNumber || '',
      rating: w.rating || 0,
      country: w.country || '',
      governorate: w.governorate || '',
      city: w.city || '',
      latitude: w.latitude || 0,
      longitude: w.longitude || 0,
      licenceImageUrl: w.licenceImageUrl || '',
      logoImageUrl: w.logoImageUrl || '',
      verificationStatus: w.verificationStatus || '',
      workShopType: w.workShopType || 'General',
      distance: this.calculateDistance(w.latitude, w.longitude),
    }));
  }

  private calculateDistance(lat: number, lng: number): number {
    if (!this.userLatitude || !this.userLongitude || !lat || !lng) {
      return 999;
    }

    const R = 6371; // Earth's radius in km
    const dLat = this.deg2rad(lat - this.userLatitude);
    const dLon = this.deg2rad(lng - this.userLongitude);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(this.userLatitude)) *
        Math.cos(this.deg2rad(lat)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  applyLocalFilters(): void {
    // No local filtering/sorting - all handled by backend
    this.filteredWorkshops = [...this.workshops];
  }

  // Handle governorate change - update cities dropdown
  onGovernorateChange(): void {
    if (this.filters.governorate) {
      this.filteredCities = EGYPTIAN_CITIES_BY_GOVERNORATE[this.filters.governorate] || [];
    } else {
      this.filteredCities = [];
    }
    this.filters.city = '';
    this.onFilterChange();
  }

  // Handle nearest checkbox change - request location if needed
  onNearestChange(): void {
    if (this.filters.nearestFirst && !this.userLatitude && !this.userLongitude) {
      // Request location when user checks "Nearest First"
      this.isRequestingLocation = true;
      this.locationError = '';
      this.cdr.detectChanges();

      // Load workshops immediately without location first
      this.loadWorkshops();

      // Then request location in parallel
      this.geolocationService
        .requestLocation()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (position: any) => {
            this.userLatitude = position.latitude;
            this.userLongitude = position.longitude;
            this.locationError = '';
            this.isRequestingLocation = false;
            console.log('Location obtained:', position.latitude, position.longitude);
            // Reload with location now that we have it
            this.loadWorkshops();
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error('Location error:', err);
            this.locationError = err?.message || 'Could not get location. Showing all workshops.';
            this.isRequestingLocation = false;
            // Keep nearestFirst checked but show warning
            // Workshops are already loaded without location sorting
            this.cdr.detectChanges();
          },
        });
    } else if (this.filters.nearestFirst && this.userLatitude && this.userLongitude) {
      // Already have location, just reload with location
      this.loadWorkshops();
    } else {
      // Unchecked nearest, reload without location
      this.loadWorkshops();
    }
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  resetFilters(): void {
    this.filters = {
      workShopType: '',
      origin: '',
      governorate: '',
      city: '',
      nearestFirst: false,
      ratingSort: '',
    };
    this.filteredCities = [];
    this.searchQuery = '';
    this.currentPage = 1;
    this.loadWorkshops();
  }

  viewWorkshop(workshop: Workshop): void {
    this.router.navigate(['/workshop-details', workshop.id]);
  }

  getLogoUrl(workshop: Workshop): string {
    if (workshop.logoImageUrl) {
      if (workshop.logoImageUrl.startsWith('http')) {
        return workshop.logoImageUrl;
      }
      return `https://localhost:44316${workshop.logoImageUrl}`;
    }
    return '';
  }

  onImageError(event: Event, workshop: Workshop): void {
    // Hide the broken image and show initials instead
    const imgElement = event.target as HTMLImageElement;
    imgElement.style.display = 'none';
    workshop.logoImageUrl = ''; // This will trigger the initials fallback
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }

  formatDistance(distance: number): string {
    if (distance === 999) return 'N/A';
    if (distance < 1) return `${Math.round(distance * 1000)}m`;
    return `${distance}km`;
  }

  viewWorkshopDetails(workshopId: number): void {
    this.router.navigate(['/workshop-details', workshopId]);
  }

  // Returns an array for star rendering: 1 = full, 0.5 = half, 0 = empty
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

  getActiveFilterCount(): number {
    let count = 0;
    if (this.filters.workShopType) count++;
    if (this.filters.origin) count++;
    if (this.filters.governorate) count++;
    if (this.filters.city) count++;
    if (this.filters.nearestFirst) count++;
    if (this.filters.ratingSort) count++;
    return count;
  }

  // Format workshop type for display
  formatWorkshopType(type: string): string {
    const typeMap: { [key: string]: string } = {
      MaintainanceCenter: 'Maintenance Center',
      Independent: 'Independent',
      Mobile: 'Mobile',
      Specialized: 'Specialized',
    };
    return typeMap[type] || type;
  }

  // Pagination methods
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadWorkshops();
      // Scroll to top of results
      window.scrollTo({ top: 300, behavior: 'smooth' });
    }
  }

  nextPage(): void {
    if (this.hasNextPage) {
      this.currentPage++;
      this.loadWorkshops();
      window.scrollTo({ top: 300, behavior: 'smooth' });
    }
  }

  previousPage(): void {
    if (this.hasPreviousPage) {
      this.currentPage--;
      this.loadWorkshops();
      window.scrollTo({ top: 300, behavior: 'smooth' });
    }
  }

  // Trigger API call when filters change
  onFilterChange(): void {
    this.currentPage = 1;
    this.loadWorkshops();
  }

  // Enhanced pagination helper methods
  getStartRecord(): number {
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  getEndRecord(): number {
    return Math.min(this.currentPage * this.pageSize, this.totalRecords);
  }

  getVisiblePages(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;

    let start = Math.max(2, this.currentPage - 1);
    let end = Math.min(this.totalPages - 1, this.currentPage + 1);

    // Adjust if we're near the start
    if (this.currentPage <= 3) {
      start = 2;
      end = Math.min(this.totalPages - 1, maxVisible - 1);
    }

    // Adjust if we're near the end
    if (this.currentPage >= this.totalPages - 2) {
      start = Math.max(2, this.totalPages - maxVisible + 2);
      end = this.totalPages - 1;
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return pages;
  }

  onPageSizeChange(): void {
    this.currentPage = 1; // Reset to first page
    this.loadWorkshops();
  }

  onQuickJump(event: Event): void {
    const input = event.target as HTMLInputElement;
    const page = parseInt(input.value, 10);

    if (page && page >= 1 && page <= this.totalPages) {
      this.goToPage(page);
    } else {
      // Reset to current page if invalid
      input.value = this.currentPage.toString();
    }
  }
}
