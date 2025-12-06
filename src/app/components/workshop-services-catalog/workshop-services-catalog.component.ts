import {
  Component,
  OnInit,
  OnChanges,
  SimpleChanges,
  Input,
  Output,
  EventEmitter,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import {
  WorkshopServiceService,
  WorkshopServiceData,
} from '../../services/workshop-service.service';
import { WorkshopProfileService } from '../../services/workshop-profile.service';

interface GroupedServices {
  [origin: string]: WorkshopServiceData[];
}

interface FilterOptions {
  searchTerm: string;
  origins: string[];
  priceRange: { min: number; max: number };
  availability: 'all' | 'available' | 'unavailable';
  sortBy: 'name' | 'price' | 'duration' | 'date';
}

@Component({
  selector: 'app-workshop-services-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './workshop-services-catalog.component.html',
  styleUrls: ['./workshop-services-catalog.component.css'],
})
export class WorkshopServicesCatalogComponent implements OnInit, OnChanges {
  @Input() workshopId?: number;
  @Output() serviceEdited = new EventEmitter<WorkshopServiceData>();
  @Output() serviceDeleted = new EventEmitter<number>();
  @Output() servicesLoaded = new EventEmitter<WorkshopServiceData[]>();

  // Data
  allServices: WorkshopServiceData[] = [];
  groupedServices: GroupedServices = {};
  filteredGroupedServices: GroupedServices = {};

  // Pagination - Load all services at once since they're grouped by origin
  currentPage = 1;
  pageSize = 500; // Large value to load all services
  totalRecords = 0;
  totalPages = 0;
  hasPreviousPage = false;
  hasNextPage = false;

  // Services display limit per origin
  servicesPerOriginInitial = 6; // Show 6 services initially per origin
  servicesPerOriginIncrement = 4; // Load 4 more on each click
  originVisibleCounts: Map<string, number> = new Map(); // Track visible count per origin

  // UI State
  loading = false;
  loadingProfile = false;
  error: string | null = null;
  expandedOrigins: Set<string> = new Set();
  private isLoadingRequest = false; // Prevent duplicate API calls

  // Filters
  filters: FilterOptions = {
    searchTerm: '',
    origins: [],
    priceRange: { min: 0, max: 10000 },
    availability: 'all',
    sortBy: 'name',
  };

  // Delete confirmation
  deletingServiceId: number | null = null;
  deleteConfirmTimeout: any = null;

  // View options
  viewMode: 'grid' | 'list' = 'grid';
  showFilters = false;

  // Expose Math for template
  Math = Math;

  constructor(
    private workshopServiceAPI: WorkshopServiceService,
    private workshopProfileService: WorkshopProfileService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (this.workshopId) {
      // Workshop ID provided via input
      this.loadServices();
    } else {
      // Fetch workshop ID from profile
      this.fetchWorkshopIdAndLoadServices();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Watch for workshopId changes from parent component
    if (changes['workshopId'] && !changes['workshopId'].firstChange) {
      if (this.workshopId) {
        console.log('📝 Workshop ID changed to:', this.workshopId);
        this.loadServices();
      }
    }
    // Handle initial load when workshopId becomes available
    if (changes['workshopId'] && changes['workshopId'].firstChange && this.workshopId) {
      console.log('📝 Initial workshop ID received:', this.workshopId);
      // Don't load here if ngOnInit already loaded
      if (!this.loading && !this.loadingProfile && this.allServices.length === 0) {
        this.loadServices();
      }
    }
  }

  /**
   * Fetch workshop ID from profile and then load services
   */
  fetchWorkshopIdAndLoadServices(): void {
    this.loadingProfile = true;
    this.error = null;

    this.workshopProfileService.getMyWorkshopProfile().subscribe({
      next: (response) => {
        // Handle different response structures
        if (response?.data?.id) {
          this.workshopId = response.data.id;
        } else if (response?.id) {
          this.workshopId = response.id;
        } else {
          this.error = 'Workshop ID not found in profile response';
          this.loadingProfile = false;
          return;
        }

        this.loadingProfile = false;
        this.loadServices();
      },
      error: (error) => {
        console.error('Error fetching workshop profile:', error);
        this.error = 'Failed to load workshop profile. Please try again.';
        this.loadingProfile = false;
      },
    });
  }

  /**
   * Load all services from API
   */
  loadServices(): void {
    if (!this.workshopId) {
      console.log('⚠️ Cannot load services - Workshop ID is required');
      this.error = null; // Don't show error, just wait for ID
      this.loading = false;
      this.isLoadingRequest = false;
      return;
    }

    // Prevent duplicate simultaneous requests
    if (this.isLoadingRequest) {
      return;
    }

    console.log('🔄 Loading services for workshop ID:', this.workshopId);
    this.loading = true;
    this.isLoadingRequest = true;
    this.error = null;

    this.workshopServiceAPI
      .getWorkshopServices(this.workshopId, this.currentPage, this.pageSize)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.isLoadingRequest = false;
        })
      )
      .subscribe({
        next: (response: any) => {
          console.log('📦 API Response:', response);
          console.log('✅ Success status:', response?.success);
          console.log('📊 Status code: 200 (implicit success)');

          // Check if response indicates success
          const isSuccess = response?.success !== false; // Treat undefined as success (implicit)

          if (!isSuccess) {
            console.warn('⚠️ API returned success: false');
            this.error = response?.message || 'Failed to load services';
            this.allServices = [];
            this.groupServices();
            this.applyFilters();
            this.cdr.detectChanges();
            return;
          }

          // Handle successful response - extract data
          if (response && response.data) {
            const data = response.data as any;

            // Check if it's a paginated response
            if (data.items && Array.isArray(data.items)) {
              console.log('📄 Paginated response with', data.items.length, 'items');
              this.allServices = data.items.filter(
                (s: WorkshopServiceData) => s !== null && s !== undefined
              );
              // Store pagination info
              this.totalRecords = data.totalRecords || 0;
              this.totalPages = data.totalPages || 0;
              this.hasPreviousPage = data.hasPreviousPage || false;
              this.hasNextPage = data.hasNextPage || false;
              this.currentPage = data.pageNumber || 1;
            } else if (Array.isArray(data)) {
              console.log('📋 Array response with', data.length, 'items');
              this.allServices = data.filter(
                (s: WorkshopServiceData) => s !== null && s !== undefined
              );
            } else if (data) {
              console.log('📝 Single item response');
              this.allServices = [data];
            } else {
              console.log('📭 Empty data');
              this.allServices = [];
            }

            this.groupServices();
            this.applyFilters();

            // Auto-expand first origin
            if (Object.keys(this.groupedServices).length > 0) {
              this.expandedOrigins.add(Object.keys(this.groupedServices)[0]);
            }
          } else if (Array.isArray(response)) {
            // Response is directly an array (no wrapper)
            console.log('📋 Direct array response with', response.length, 'items');
            this.allServices = response.filter(
              (s: WorkshopServiceData) => s !== null && s !== undefined
            );
            this.groupServices();
            this.applyFilters();
          } else {
            // No data or empty
            console.log('📭 No data in response');
            this.allServices = [];
            this.groupServices();
            this.applyFilters();
          }

          console.log('✅ Services loaded successfully:', this.allServices.length);

          // Emit services to parent component for stats
          this.servicesLoaded.emit(this.allServices);

          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('❌ HTTP Error:', {
            status: error.status,
            statusText: error.statusText,
            message: error.message,
            errorBody: error.error,
          });

          // Handle different error cases based on HTTP status code
          if (error.status === 404) {
            // 404 means no services found - this is OK, not an error
            console.log('ℹ️ 404: No services found (treating as empty list)');
            this.error = null; // Don't show error for empty list
            this.allServices = [];
            this.groupServices();
            this.applyFilters();
          } else if (error.status === 0) {
            console.error('🔌 Network error: Unable to connect');
            this.error = 'Unable to connect to server. Please check your connection.';
            this.allServices = [];
            this.groupServices();
            this.applyFilters();
          } else if (error.status >= 400 && error.status < 500) {
            console.error('⚠️ Client error:', error.status);
            this.error =
              error.error?.message || `Request failed (${error.status}): ${error.statusText}`;
            this.allServices = [];
            this.groupServices();
            this.applyFilters();
          } else if (error.status >= 500) {
            console.error('💥 Server error:', error.status);
            this.error = 'Server error. Please try again later.';
            this.allServices = [];
            this.groupServices();
            this.applyFilters();
          } else {
            console.error('❓ Unknown error:', error);
            this.error =
              error.error?.message || error.message || 'Failed to load services. Please try again.';
            this.allServices = [];
            this.groupServices();
            this.applyFilters();
          }

          // Force change detection in error cases too
          this.cdr.detectChanges();

          // Loading will be cleared by finalize
        },
      });
  }

  /**
   * Group services by origin
   */
  groupServices(): void {
    // Create completely new object reference for change detection
    const newGrouped = this.workshopServiceAPI.groupServicesByOrigin(this.allServices);
    this.groupedServices = { ...newGrouped };
    console.log(
      '📦 Grouped services:',
      Object.keys(this.groupedServices).map((k) => `${k}: ${this.groupedServices[k].length}`)
    );
  }

  /**
   * Apply filters and search
   */
  applyFilters(): void {
    let filtered = [...this.allServices];

    // Search filter
    if (this.filters.searchTerm) {
      const term = this.filters.searchTerm.toLowerCase();
      filtered = filtered.filter((service) => {
        const serviceName = (service.serviceName || '').toLowerCase();
        const serviceDescription = (service.serviceDescription || '').toLowerCase();
        const origin = (service.origin || '').toLowerCase();
        return (
          serviceName.includes(term) || serviceDescription.includes(term) || origin.includes(term)
        );
      });
    }

    // Origin filter
    if (this.filters.origins.length > 0) {
      filtered = filtered.filter((service) => this.filters.origins.includes(service.origin));
    }

    // Price range filter
    filtered = filtered.filter(
      (service) =>
        service.minPrice >= this.filters.priceRange.min &&
        service.maxPrice <= this.filters.priceRange.max
    );

    // Sort
    this.sortServices(filtered);

    // Regroup filtered services with new object reference
    const newFiltered = this.workshopServiceAPI.groupServicesByOrigin(filtered);
    this.filteredGroupedServices = { ...newFiltered };
    console.log(
      '🔍 Filtered groups:',
      Object.keys(this.filteredGroupedServices).map(
        (k) => `${k}: ${this.filteredGroupedServices[k].length}`
      )
    );
  }

  /**
   * Sort services
   */
  sortServices(services: WorkshopServiceData[]): void {
    services.sort((a, b) => {
      switch (this.filters.sortBy) {
        case 'price':
          return a.minPrice - b.minPrice;
        case 'duration':
          return a.duration - b.duration;
        case 'name':
        default:
          return a.serviceId - b.serviceId;
      }
    });
  }

  /**
   * Toggle origin expansion
   */
  toggleOrigin(origin: string): void {
    if (this.expandedOrigins.has(origin)) {
      this.expandedOrigins.delete(origin);
    } else {
      this.expandedOrigins.add(origin);
    }
  }

  /**
   * Check if origin is expanded
   */
  isOriginExpanded(origin: string): boolean {
    return this.expandedOrigins.has(origin);
  }

  /**
   * Expand all origins
   */
  expandAll(): void {
    Object.keys(this.filteredGroupedServices).forEach((origin) => {
      this.expandedOrigins.add(origin);
    });
  }

  /**
   * Collapse all origins
   */
  collapseAll(): void {
    this.expandedOrigins.clear();
  }

  /**
   * Get origin info
   */
  getOriginInfo(origin: string) {
    return this.workshopServiceAPI.getOriginInfo(origin);
  }

  /**
   * Get service count for origin
   */
  getServiceCount(origin: string): number {
    return this.filteredGroupedServices[origin]?.length || 0;
  }

  /**
   * Handle search input
   */
  onSearch(): void {
    this.applyFilters();
  }

  /**
   * Handle filter change
   */
  onFilterChange(): void {
    this.applyFilters();
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    this.filters = {
      searchTerm: '',
      origins: [],
      priceRange: { min: 0, max: 10000 },
      availability: 'all',
      sortBy: 'name',
    };
    this.applyFilters();
  }

  /**
   * Toggle filter panel
   */
  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  /**
   * Edit service
   */
  onEditService(service: WorkshopServiceData): void {
    this.serviceEdited.emit(service);
  }

  /**
   * Initiate delete with confirmation
   */
  onDeleteService(serviceId: number): void {
    this.deletingServiceId = serviceId;

    // Auto-cancel after 5 seconds
    this.deleteConfirmTimeout = setTimeout(() => {
      this.cancelDelete();
    }, 5000);
  }

  /**
   * Confirm and execute delete
   */
  confirmDelete(): void {
    if (this.deletingServiceId === null) return;

    const deletedServiceId = this.deletingServiceId;

    console.log('🗑️ Attempting to delete service ID:', deletedServiceId);

    this.workshopServiceAPI.deleteWorkshopService(this.deletingServiceId).subscribe({
      next: (response: any) => {
        console.log('🗑️ Delete API response:', response);

        if (response?.success || response) {
          console.log('✅ Service deleted successfully from backend');

          // Create new array reference (important for change detection)
          this.allServices = [...this.allServices.filter((s) => s.id !== deletedServiceId)];

          console.log('📋 Remaining services after delete:', this.allServices.length);

          // Recreate grouped objects with new references
          this.groupedServices = {};
          this.filteredGroupedServices = {};

          // Regroup and refilter
          this.groupServices();
          this.applyFilters();

          console.log(
            '🔍 Filtered groups after delete:',
            Object.keys(this.filteredGroupedServices)
          );

          // Emit event and clear state
          this.serviceDeleted.emit(deletedServiceId);
          this.deletingServiceId = null;
          this.clearDeleteTimeout();

          // Force change detection multiple times to ensure UI updates
          this.cdr.detectChanges();
          this.cdr.markForCheck();

          // No need to reload from API - we already have the correct state locally
          // The delete was successful and we've updated our local data immediately
        } else {
          this.error = (response?.message || 'Failed to delete service') as string;
          this.deletingServiceId = null;
          this.clearDeleteTimeout();
        }
      },
      error: (error: any) => {
        console.error('❌ Error deleting service:', error);
        this.error = 'Failed to delete service. Please try again.';
        this.deletingServiceId = null;
        this.clearDeleteTimeout();
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  /**
   * Cancel delete operation
   */
  cancelDelete(): void {
    this.deletingServiceId = null;
    this.clearDeleteTimeout();
  }

  /**
   * Clear delete timeout
   */
  private clearDeleteTimeout(): void {
    if (this.deleteConfirmTimeout) {
      clearTimeout(this.deleteConfirmTimeout);
      this.deleteConfirmTimeout = null;
    }
  }

  /**
   * Get origins list
   */
  getOriginsList(): string[] {
    return Object.keys(this.filteredGroupedServices);
  }

  /**
   * Get origins count
   */
  getOriginsCount(): number {
    return Object.keys(this.filteredGroupedServices).length;
  }

  /**
   * Get visible services for an origin (limited based on current count)
   */
  getVisibleServicesForOrigin(origin: string): WorkshopServiceData[] {
    const services = this.filteredGroupedServices[origin] || [];
    const visibleCount = this.originVisibleCounts.get(origin) || this.servicesPerOriginInitial;
    return services.slice(0, visibleCount);
  }

  /**
   * Check if origin has more services than currently displayed
   */
  hasMoreServices(origin: string): boolean {
    const services = this.filteredGroupedServices[origin] || [];
    const visibleCount = this.originVisibleCounts.get(origin) || this.servicesPerOriginInitial;
    return services.length > visibleCount;
  }

  /**
   * Check if showing all services for an origin
   */
  isShowingAllServices(origin: string): boolean {
    const services = this.filteredGroupedServices[origin] || [];
    const visibleCount = this.originVisibleCounts.get(origin) || this.servicesPerOriginInitial;
    return visibleCount >= services.length;
  }

  /**
   * Load more services for an origin (add 4 more)
   */
  loadMoreServices(origin: string): void {
    const currentCount = this.originVisibleCounts.get(origin) || this.servicesPerOriginInitial;
    const services = this.filteredGroupedServices[origin] || [];
    const newCount = Math.min(currentCount + this.servicesPerOriginIncrement, services.length);
    this.originVisibleCounts.set(origin, newCount);
  }

  /**
   * Show less services for an origin (reset to initial)
   */
  showLessServices(origin: string): void {
    this.originVisibleCounts.set(origin, this.servicesPerOriginInitial);
  }

  /**
   * Get count of remaining hidden services
   */
  getRemainingServicesCount(origin: string): number {
    const services = this.filteredGroupedServices[origin] || [];
    const visibleCount = this.originVisibleCounts.get(origin) || this.servicesPerOriginInitial;
    return Math.max(0, services.length - visibleCount);
  }

  /**
   * Get total services count
   */
  getTotalServicesCount(): number {
    return this.allServices.length;
  }

  /**
   * Get filtered services count
   */
  getFilteredServicesCount(): number {
    return Object.values(this.filteredGroupedServices).reduce(
      (sum, services) => sum + services.length,
      0
    );
  }

  /**
   * Check if filters are active
   */
  hasActiveFilters(): boolean {
    return (
      this.filters.searchTerm !== '' ||
      this.filters.origins.length > 0 ||
      this.filters.priceRange.min > 0 ||
      this.filters.priceRange.max < 10000
    );
  }

  /**
   * Retry loading
   */
  retry(): void {
    if (this.workshopId) {
      this.loadServices();
    } else {
      this.fetchWorkshopIdAndLoadServices();
    }
  }

  /**
   * Navigate to next page
   */
  nextPage(): void {
    if (this.hasNextPage && !this.loading) {
      this.currentPage++;
      this.loadServices();
    }
  }

  /**
   * Navigate to previous page
   */
  previousPage(): void {
    if (this.hasPreviousPage && !this.loading) {
      this.currentPage--;
      this.loadServices();
    }
  }

  /**
   * Go to specific page
   */
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage && !this.loading) {
      this.currentPage = page;
      this.loadServices();
    }
  }

  /**
   * Check if component is in loading state
   */
  isLoading(): boolean {
    return this.loading || this.loadingProfile;
  }

  /**
   * Get visible page numbers for pagination
   */
  getVisiblePages(): number[] {
    const pages: number[] = [];
    const start = Math.max(2, this.currentPage - 1);
    const end = Math.min(this.totalPages - 1, this.currentPage + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  /**
   * Get start record number for display
   */
  getStartRecord(): number {
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  /**
   * Get end record number for display
   */
  getEndRecord(): number {
    return Math.min(this.currentPage * this.pageSize, this.totalRecords);
  }

  /**
   * Handle page size change
   */
  onPageSizeChange(): void {
    this.currentPage = 1;
    this.loadServices();
  }
}
