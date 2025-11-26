import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WorkshopServiceService, WorkshopServiceData } from '../../services/workshop-service.service';
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
  styleUrls: ['./workshop-services-catalog.component.css']
})
export class WorkshopServicesCatalogComponent implements OnInit {
  @Input() workshopId?: number;
  @Output() serviceEdited = new EventEmitter<WorkshopServiceData>();
  @Output() serviceDeleted = new EventEmitter<number>();

  // Data
  allServices: WorkshopServiceData[] = [];
  groupedServices: GroupedServices = {};
  filteredGroupedServices: GroupedServices = {};
  
  // UI State
  loading = false;
  loadingProfile = false;
  error: string | null = null;
  expandedOrigins: Set<string> = new Set();
  
  // Filters
  filters: FilterOptions = {
    searchTerm: '',
    origins: [],
    priceRange: { min: 0, max: 10000 },
    availability: 'all',
    sortBy: 'name'
  };
  
  // Delete confirmation
  deletingServiceId: number | null = null;
  deleteConfirmTimeout: any = null;
  
  // View options
  viewMode: 'grid' | 'list' = 'grid';
  showFilters = false;

  constructor(
    private workshopServiceAPI: WorkshopServiceService,
    private workshopProfileService: WorkshopProfileService
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

  /**
   * Fetch workshop ID from profile and then load services
   */
  fetchWorkshopIdAndLoadServices(): void {
    this.loadingProfile = true;
    this.error = null;

    console.log('Fetching workshop profile...');

    this.workshopProfileService.getMyWorkshopProfile().subscribe({
      next: (response) => {
        console.log('Workshop profile response:', response);
        
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

        console.log('Workshop ID fetched:', this.workshopId);
        this.loadingProfile = false;
        this.loadServices();
      },
      error: (error) => {
        console.error('Error fetching workshop profile:', error);
        this.error = 'Failed to load workshop profile. Please try again.';
        this.loadingProfile = false;
      }
    });
  }

  /**
   * Load all services from API
   */
  loadServices(): void {
    if (!this.workshopId) {
      this.error = 'Workshop ID is required';
      this.loading = false;
      return;
    }

    this.loading = true;
    this.error = null;

    console.log('Loading services for workshop:', this.workshopId);

    this.workshopServiceAPI.getWorkshopServices(this.workshopId).subscribe({
      next: (response) => {
        console.log('Services API response:', response);
        
        // Handle different response structures
        if (response && response.data) {
          // Data exists
          const servicesData = Array.isArray(response.data) ? response.data : [response.data];
          this.allServices = servicesData.filter((s: WorkshopServiceData) => s !== null && s !== undefined);
          
          console.log('Processed services:', this.allServices);
          
          this.groupServices();
          this.applyFilters();
          
          // Auto-expand first origin
          if (Object.keys(this.groupedServices).length > 0) {
            this.expandedOrigins.add(Object.keys(this.groupedServices)[0]);
          }
        } else if (Array.isArray(response)) {
          // Response is directly an array (no wrapper)
          this.allServices = response.filter((s: WorkshopServiceData) => s !== null && s !== undefined);
          console.log('Direct array response:', this.allServices);
          this.groupServices();
          this.applyFilters();
        } else {
          // No data or empty
          this.allServices = [];
          this.groupServices();
          this.applyFilters();
          console.log('No services found or empty response');
        }
        
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading services:', error);
        console.error('Error details:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          error: error.error
        });
        
        // Provide more specific error messages
        if (error.status === 404) {
          this.error = 'No services found for this workshop.';
          this.allServices = [];
          this.groupServices();
          this.applyFilters();
        } else if (error.status === 0) {
          this.error = 'Unable to connect to server. Please check your connection.';
        } else {
          this.error = error.error?.message || error.message || 'Failed to load services. Please try again.';
        }
        
        this.loading = false;
      }
    });
  }

  /**
   * Group services by origin
   */
  groupServices(): void {
    this.groupedServices = this.workshopServiceAPI.groupServicesByOrigin(this.allServices);
  }

  /**
   * Apply filters and search
   */
  applyFilters(): void {
    let filtered = [...this.allServices];

    // Search filter
    if (this.filters.searchTerm) {
      const term = this.filters.searchTerm.toLowerCase();
      filtered = filtered.filter(service => {
        const serviceName = service.serviceId.toString().toLowerCase();
        const origin = service.origin.toLowerCase();
        return serviceName.includes(term) || origin.includes(term);
      });
    }

    // Origin filter
    if (this.filters.origins.length > 0) {
      filtered = filtered.filter(service => 
        this.filters.origins.includes(service.origin)
      );
    }

    // Price range filter
    filtered = filtered.filter(service => 
      service.minPrice >= this.filters.priceRange.min &&
      service.maxPrice <= this.filters.priceRange.max
    );

    // Sort
    this.sortServices(filtered);

    // Regroup filtered services
    this.filteredGroupedServices = this.workshopServiceAPI.groupServicesByOrigin(filtered);
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
    Object.keys(this.filteredGroupedServices).forEach(origin => {
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
      sortBy: 'name'
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

    this.workshopServiceAPI.deleteWorkshopService(this.deletingServiceId).subscribe({
      next: (response) => {
        if (response.success) {
          this.serviceDeleted.emit(this.deletingServiceId!);
          this.allServices = this.allServices.filter(s => s.id !== this.deletingServiceId);
          this.groupServices();
          this.applyFilters();
          this.deletingServiceId = null;
          this.clearDeleteTimeout();
        } else {
          this.error = response.message || 'Failed to delete service';
        }
      },
      error: (error) => {
        console.error('Error deleting service:', error);
        this.error = 'Failed to delete service. Please try again.';
        this.deletingServiceId = null;
        this.clearDeleteTimeout();
      }
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
   * Get total services count
   */
  getTotalServicesCount(): number {
    return this.allServices.length;
  }

  /**
   * Get filtered services count
   */
  getFilteredServicesCount(): number {
    return Object.values(this.filteredGroupedServices)
      .reduce((sum, services) => sum + services.length, 0);
  }

  /**
   * Check if filters are active
   */
  hasActiveFilters(): boolean {
    return this.filters.searchTerm !== '' ||
           this.filters.origins.length > 0 ||
           this.filters.priceRange.min > 0 ||
           this.filters.priceRange.max < 10000;
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
   * Check if component is in loading state
   */
  isLoading(): boolean {
    return this.loading || this.loadingProfile;
  }
}
