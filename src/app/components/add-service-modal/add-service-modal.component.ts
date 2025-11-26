import {
  Component,
  OnInit,
  OnChanges,
  SimpleChanges,
  Input,
  Output,
  EventEmitter,
  HostListener,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { WorkshopProfileService } from '../../services/workshop-profile.service';
import {
  WorkshopServiceService,
  WorkshopServiceCreateRequest,
} from '../../services/workshop-service.service';
import {
  WorkshopService,
  ServiceCategory,
  ServiceSubcategory,
  ServiceItem,
  CAR_ORIGINS,
  CategoryAPIResponse,
  CategoryData,
  SubcategoryAPIResponse,
  SubcategoryData,
  ServiceAPIResponse,
  ServiceData,
} from '../../models/workshop-profile.model';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

interface SelectedService {
  categoryId: number;
  subcategoryId: number;
  serviceId: number;
  categoryName: string;
  subcategoryName: string;
  serviceName: string;
  configured: boolean;
}

@Component({
  selector: 'app-add-service-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './add-service-modal.component.html',
  styleUrls: ['./add-service-modal.component.css'],
})
export class AddServiceModalComponent implements OnInit, OnChanges, OnDestroy {
  @Output() close = new EventEmitter<void>();
  @Output() servicesAdded = new EventEmitter<WorkshopService[]>();
  @Output() serviceUpdated = new EventEmitter<any>();

  // Edit mode properties
  isEditMode = false;
  @Input() editingService: any = null;

  // Search subjects for debouncing (categories only)
  private categorySearchSubject = new Subject<string>();
  private searchSubscription?: Subscription;

  // Step management - simplified to 3 steps
  currentStep = 1;
  totalSteps = 3;

  // Data from API
  categories: ServiceCategory[] = [];
  filteredCategories: ServiceCategory[] = [];

  // Smart defaults for service configuration
  defaultDuration = 60; // minutes
  categoryPriceRanges: { [key: number]: { min: number; max: number } } = {
    1: { min: 100, max: 300 }, // Periodic Maintenance
    2: { min: 150, max: 400 }, // Seasonal Check-ups
    3: { min: 200, max: 800 }, // Mechanical Repairs
    4: { min: 300, max: 1000 }, // Electrical
    5: { min: 250, max: 900 }, // AC & Cooling
    6: { min: 500, max: 2000 }, // Body & Paint
    7: { min: 50, max: 200 }, // Tires
  };

  applyToAll = true; // Bulk configuration toggle

  // Per-origin pricing configuration
  pricingMode: { [serviceIndex: number]: 'unified' | 'per-origin' } = {};

  // API state management
  workshopProfileId: number | null = null;
  isLoadingSubmit = false;
  submitError: string | null = null;

  // Selection state - nested navigation
  selectedCategory: ServiceCategory | null = null;
  selectedSubcategory: ServiceSubcategory | null = null;
  selectedServices: SelectedService[] = [];

  // UI state for nested navigation
  showSubcategories = false;
  showServices = false;

  // Expandable configuration
  expandedServiceIndex: number | null = null;

  // Search and filter
  categorySearchTerm = '';
  subcategorySearchTerm = '';
  serviceSearchTerm = '';

  // Configuration form
  configurationForm!: FormGroup;
  activeConfigTab = 0;

  // Car origins
  carOrigins = CAR_ORIGINS;

  // UI state
  isLoading = false;
  isSubmitting = false;
  showMessage = false;
  isSuccess = false;
  resultMessage = '';
  isRedirecting = false;
  redirectCountdown = 3;

  // Draft management
  showDraftBanner = false;
  hasSavedDraft = false;

  constructor(
    private fb: FormBuilder,
    private workshopService: WorkshopProfileService,
    private workshopServiceAPI: WorkshopServiceService
  ) {}

  ngOnInit(): void {
    // Check if we're in edit mode based on editingService input
    if (this.editingService) {
      this.isEditMode = true;
    }

    this.loadServiceCategories();
    this.initializeConfigurationForm();
    this.loadWorkshopProfileId();

    // Skip draft check in edit mode
    if (!this.isEditMode) {
      this.checkForSavedDraft();
    }

    this.setupSearchDebounce();

    // If in edit mode, populate form with existing service data
    if (this.isEditMode && this.editingService) {
      this.populateEditForm();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Detect when editingService input changes
    if (changes['editingService'] && changes['editingService'].currentValue) {
      console.log('editingService input changed:', changes['editingService'].currentValue);
      this.isEditMode = true;
      this.editingService = changes['editingService'].currentValue;

      // If already initialized, populate the form now
      if (this.configurationForm) {
        this.populateEditForm();
      }
    }
  }

  /**
   * Set the modal to edit mode with existing service data
   */
  setEditMode(service: any): void {
    this.isEditMode = true;
    this.editingService = service;
    console.log('Edit mode activated for service:', service);
  }

  /**
   * Populate form with existing service data for editing
   */
  populateEditForm(): void {
    if (!this.editingService) {
      console.log('No editingService - cannot populate form');
      return;
    }

    console.log('Populating edit form with service:', this.editingService);

    // Skip to configuration step since we're editing
    this.currentStep = 3;

    // Create a selected service entry
    const selectedService: SelectedService = {
      categoryId: 0, // We don't have this from the response
      subcategoryId: 0,
      serviceId: this.editingService.serviceId,
      categoryName: '',
      subcategoryName: '',
      serviceName: this.editingService.serviceName || 'Service',
      configured: true,
    };

    this.selectedServices = [selectedService];

    // Map origin from API to form format (e.g., 'Japan' -> 'japanese')
    const originCode = this.mapOriginNameToCode(this.editingService.origin);

    // Create the form group with the service data
    const serviceGroup = this.fb.group({
      durationMinutes: [
        this.editingService.duration || 60,
        [Validators.required, Validators.min(15)],
      ],
      minPrice: [this.editingService.minPrice || 0, [Validators.required, Validators.min(0)]],
      maxPrice: [this.editingService.maxPrice || 0, [Validators.required, Validators.min(0)]],
      carOriginSpecializations: [originCode || '', Validators.required],
    });

    // Add the form group to the array
    this.serviceConfigArray.push(serviceGroup);

    // Set pricing mode to unified for editing
    this.pricingMode[0] = 'unified';

    console.log('Form populated. serviceConfigArray length:', this.serviceConfigArray.length);
    console.log('Form value:', serviceGroup.value);
  }

  /**
   * Map origin name from API to origin code used in form
   */
  mapOriginNameToCode(originName: string): string {
    if (!originName) return '';

    const originMap: { [key: string]: string } = {
      Germany: 'german',
      Japan: 'japanese',
      SouthKorea: 'korean',
      USA: 'american',
      China: 'chinese',
      Italy: 'italian',
      France: 'french',
      UK: 'british',
    };

    return originMap[originName] || originName.toLowerCase();
  }

  /**
   * Map origin code from form to origin name for API
   */
  mapOriginCodeToName(originCode: string): string {
    if (!originCode) return '';

    const codeMap: { [key: string]: string } = {
      german: 'Germany',
      japanese: 'Japan',
      korean: 'SouthKorea',
      american: 'USA',
      chinese: 'China',
      italian: 'Italy',
      french: 'France',
      british: 'UK',
    };

    return codeMap[originCode] || originCode;
  }

  /**
   * Load the workshop profile ID from the API
   */
  loadWorkshopProfileId(): void {
    this.workshopService.getMyWorkshopProfile().subscribe({
      next: (response: any) => {
        if (response?.data?.id) {
          this.workshopProfileId = response.data.id;
          console.log('Workshop Profile ID loaded:', this.workshopProfileId);
        } else {
          console.error('Workshop profile ID not found in response:', response);
          this.showErrorMessage('Failed to load workshop profile ID');
        }
      },
      error: (error: any) => {
        console.error('Error loading workshop profile:', error);
        this.showErrorMessage('Failed to load workshop profile. Please try again.');
      },
    });
  }

  ngOnDestroy(): void {
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }
    this.categorySearchSubject.complete();
  }

  /**
   * Setup debounced search (300ms delay for categories only)
   */
  private setupSearchDebounce(): void {
    this.searchSubscription = this.categorySearchSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((term) => {
        this.performCategoryFilter(term);
      });
  }

  // ============================================
  // Data Loading
  // ============================================

  loadServiceCategories(forceRefresh = false): void {
    this.isLoading = true;
    this.workshopService.loadServiceCategories(forceRefresh).subscribe({
      next: (response: CategoryAPIResponse) => {
        if (response.success && response.data) {
          // Map API response to internal ServiceCategory format
          this.categories = response.data.map((cat: CategoryData) => ({
            id: cat.id,
            name: cat.name,
            icon: cat.iconURL || '🔧',
            subcategories: [],
          }));

          // Sort by display order
          this.categories.sort((a, b) => {
            const orderA = response.data.find((d) => d.id === a.id)?.displayOrder || 0;
            const orderB = response.data.find((d) => d.id === b.id)?.displayOrder || 0;
            return orderA - orderB;
          });

          this.filteredCategories = [...this.categories];

          // Eagerly load all subcategory counts
          this.loadAllSubcategoryCounts();
        } else {
          this.showErrorMessage(response.message || 'Failed to load categories');
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading service categories:', error);
        this.showErrorMessage('Failed to load service categories. Please try again.');
        this.isLoading = false;
      },
    });
  }

  // ============================================
  // Step Navigation
  // ============================================

  nextStep(): void {
    if (this.canProceedToNextStep()) {
      this.currentStep++;
      this.saveDraft();
      this.scrollToTop();

      // Initialize configuration form when reaching step 4
      if (this.currentStep === 4) {
        this.buildConfigurationForm();
      }
    }
  }

  previousStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.scrollToTop();
    }
  }

  goToStep(step: number): void {
    if (step >= 1 && step <= this.currentStep && step <= this.totalSteps) {
      this.currentStep = step;
      this.scrollToTop();
    }
  }

  canProceedToNextStep(): boolean {
    switch (this.currentStep) {
      case 1:
        return this.selectedServices.length > 0;
      case 2:
        return this.configurationForm.valid && this.allServicesConfigured();
      default:
        return false;
    }
  }

  allServicesConfigured(): boolean {
    return this.serviceConfigArray.controls.every((control) => {
      const group = control as FormGroup;
      return group.valid && group.get('carOriginSpecializations')?.value?.length > 0;
    });
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ============================================
  // Step 1: Category Selection
  // ============================================

  selectCategory(category: ServiceCategory): void {
    this.selectedCategory = category;
    this.selectedSubcategory = null;
    this.showServices = false;

    // Check if subcategories are already loaded (from preload)
    if (category.subcategories && category.subcategories.length > 0) {
      this.showSubcategories = true;
      return;
    }

    // Load subcategories from API
    this.isLoading = true;
    this.workshopService.getSubcategoriesByCategory(category.id).subscribe({
      next: (response: SubcategoryAPIResponse) => {
        if (response.success && response.data) {
          // Map API response to internal ServiceSubcategory format
          this.selectedCategory!.subcategories = response.data.map((sub: SubcategoryData) => ({
            id: sub.id,
            name: sub.name,
            services: [],
          }));

          this.showSubcategories = true;
        } else {
          this.showErrorMessage(response.message || 'Failed to load subcategories');
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading subcategories:', error);
        this.showErrorMessage('Failed to load subcategories. Please try again.');
        this.isLoading = false;
      },
    });
  }

  /**
   * Preload subcategories on hover for instant display
   */
  /**
   * Load subcategory counts for all categories eagerly
   */
  loadAllSubcategoryCounts(): void {
    this.categories.forEach((category) => {
      this.workshopService.getSubcategoriesByCategory(category.id).subscribe({
        next: (response: SubcategoryAPIResponse) => {
          if (response.success && response.data) {
            category.subcategories = response.data.map((sub: SubcategoryData) => ({
              id: sub.id,
              name: sub.name,
              services: [],
            }));

            // Load service counts for each subcategory
            this.loadServiceCountsForSubcategories(category.subcategories);
          }
        },
        error: (error) => {
          console.error('Load subcategories failed for category:', category.name, error);
        },
      });
    });
  }

  /**
   * Load service counts for subcategories
   */
  loadServiceCountsForSubcategories(subcategories: ServiceSubcategory[]): void {
    subcategories.forEach((subcategory) => {
      this.workshopService.getServicesBySubcategory(subcategory.id).subscribe({
        next: (response: ServiceAPIResponse) => {
          if (response.success && response.data) {
            subcategory.services = response.data.map((svc: ServiceData) => ({
              id: svc.id,
              name: svc.name,
            }));
          }
        },
        error: (error) => {
          console.error('Load services failed for subcategory:', subcategory.name, error);
        },
      });
    });
  }

  preloadSubcategories(category: ServiceCategory): void {
    // Skip if already loaded
    if (category.subcategories && category.subcategories.length > 0) {
      return;
    }

    // Silently preload in background
    this.workshopService.getSubcategoriesByCategory(category.id).subscribe({
      next: (response: SubcategoryAPIResponse) => {
        if (response.success && response.data) {
          category.subcategories = response.data.map((sub: SubcategoryData) => ({
            id: sub.id,
            name: sub.name,
            services: [],
          }));

          // Also load service counts
          this.loadServiceCountsForSubcategories(category.subcategories);
        }
      },
      error: (error) => {
        console.error('Preload subcategories failed:', error);
      },
    });
  }

  filterCategories(): void {
    // Trigger debounced search
    this.categorySearchSubject.next(this.categorySearchTerm);
  }

  /**
   * Perform actual category filtering (called after debounce)
   */
  private performCategoryFilter(term: string): void {
    term = term.toLowerCase().trim();
    if (!term) {
      this.filteredCategories = [...this.categories];
    } else {
      this.filteredCategories = this.categories.filter((cat) =>
        cat.name.toLowerCase().includes(term)
      );
    }
  }

  /**
   * Trigger API call when search bar is focused or All Categories clicked
   */
  onSearchOrAllCategories(): void {
    if (this.categories.length === 0) {
      this.loadServiceCategories(true);
    }
  }

  // ============================================
  // Step 2: Subcategory Selection
  // ============================================

  selectSubcategory(subcategory: ServiceSubcategory): void {
    this.selectedSubcategory = subcategory;

    // Check if services are already loaded (from preload)
    if (subcategory.services && subcategory.services.length > 0) {
      this.showServices = true;
      return;
    }

    // Load services from API
    this.isLoading = true;
    this.workshopService.getServicesBySubcategory(subcategory.id).subscribe({
      next: (response: ServiceAPIResponse) => {
        if (response.success && response.data) {
          // Map API response to internal ServiceItem format
          this.selectedSubcategory!.services = response.data.map((svc: ServiceData) => ({
            id: svc.id,
            name: svc.name,
          }));

          this.showServices = true;
        } else {
          this.showErrorMessage(response.message || 'Failed to load services');
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading services:', error);
        this.showErrorMessage('Failed to load services. Please try again.');
        this.isLoading = false;
      },
    });
  }

  /**
   * Preload services on hover for instant display
   */
  preloadServices(subcategory: ServiceSubcategory): void {
    // Skip if already loaded
    if (subcategory.services && subcategory.services.length > 0) {
      return;
    }

    // Silently preload in background
    this.workshopService.getServicesBySubcategory(subcategory.id).subscribe({
      next: (response: ServiceAPIResponse) => {
        if (response.success && response.data) {
          subcategory.services = response.data.map((svc: ServiceData) => ({
            id: svc.id,
            name: svc.name,
          }));
        }
      },
      error: (error) => {
        console.error('Preload services failed:', error);
      },
    });
  }

  getFilteredSubcategories(): ServiceSubcategory[] {
    if (!this.selectedCategory) return [];

    const term = this.subcategorySearchTerm.toLowerCase().trim();
    if (!term) {
      return this.selectedCategory.subcategories;
    }

    return this.selectedCategory.subcategories.filter((sub) =>
      sub.name.toLowerCase().includes(term)
    );
  }

  /**
   * Filter subcategories immediately (no debounce)
   */
  filterSubcategories(): void {
    // Filtering is handled by getFilteredSubcategories() which is called in template
    // No debounce needed for subcategories
  }

  /**
   * Perform actual subcategory filtering (called after debounce)
   */
  private performSubcategoryFilter(term: string): void {
    // The filtering is already handled by getFilteredSubcategories()
    // This method is here for consistency and future API-based search
  }

  getServiceCount(subcategory: ServiceSubcategory): number {
    return subcategory.services.length;
  }

  // ============================================
  // Step 3: Service Multi-Select
  // ============================================

  getFilteredServices(): ServiceItem[] {
    if (!this.selectedSubcategory) return [];

    const term = this.serviceSearchTerm.toLowerCase().trim();
    if (!term) {
      return this.selectedSubcategory.services;
    }

    return this.selectedSubcategory.services.filter((service) =>
      service.name.toLowerCase().includes(term)
    );
  }

  isServiceSelected(serviceId: number): boolean {
    return this.selectedServices.some((s) => s.serviceId === serviceId);
  }

  toggleServiceSelection(service: ServiceItem): void {
    const index = this.selectedServices.findIndex((s) => s.serviceId === service.id);

    if (index > -1) {
      this.selectedServices.splice(index, 1);
      // Remove from configuration form
      const configIndex = this.serviceConfigArray.controls.findIndex(
        (ctrl) => ctrl.get('serviceId')?.value === service.id
      );
      if (configIndex > -1) {
        this.serviceConfigArray.removeAt(configIndex);
      }
    } else {
      this.selectedServices.push({
        categoryId: this.selectedCategory!.id,
        subcategoryId: this.selectedSubcategory!.id,
        serviceId: service.id,
        categoryName: this.selectedCategory!.name,
        subcategoryName: this.selectedSubcategory!.name,
        serviceName: service.name,
        configured: false,
      });
      // Auto-add to configuration form with smart defaults
      this.addServiceToConfig(service);
    }
    this.saveDraft();
  }

  addServiceToConfig(service: ServiceItem): void {
    const priceRange = this.categoryPriceRanges[this.selectedCategory!.id] || {
      min: 100,
      max: 500,
    };
    const serviceIndex = this.serviceConfigArray.length;

    // Initialize pricing mode as unified by default
    this.pricingMode[serviceIndex] = 'unified';

    const newGroup = this.fb.group(
      {
        serviceId: [service.id],
        categoryId: [this.selectedCategory!.id],
        subcategoryId: [this.selectedSubcategory!.id],
        serviceName: [service.name],
        categoryName: [this.selectedCategory!.name],
        subcategoryName: [this.selectedSubcategory!.name],
        description: [''],
        durationMinutes: [
          this.defaultDuration,
          [Validators.required, Validators.min(15), Validators.max(480)],
        ],
        minPrice: [priceRange.min, [Validators.required, Validators.min(0)]],
        maxPrice: [priceRange.max, [Validators.required, Validators.min(0)]],
        carOriginSpecializations: [[], [Validators.required, Validators.minLength(1)]],
        originPricing: [this.createOriginPricingArray(priceRange)],
        imageUrl: [''],
        isAvailable: [true],
      },
      { validators: this.priceRangeValidator }
    );

    this.serviceConfigArray.push(newGroup);

    // If applyToAll is enabled and this is not the first service, copy first service config
    if (this.applyToAll && this.serviceConfigArray.length > 1) {
      const firstConfig = this.serviceConfigArray.at(0);
      newGroup.patchValue({
        durationMinutes: firstConfig.get('durationMinutes')?.value,
        minPrice: firstConfig.get('minPrice')?.value,
        maxPrice: firstConfig.get('maxPrice')?.value,
        carOriginSpecializations: [...firstConfig.get('carOriginSpecializations')?.value],
      });
    }
  }

  selectAllServices(): void {
    if (!this.selectedSubcategory) return;

    const filteredServices = this.getFilteredServices();
    filteredServices.forEach((service) => {
      if (!this.isServiceSelected(service.id)) {
        this.selectedServices.push({
          categoryId: this.selectedCategory!.id,
          subcategoryId: this.selectedSubcategory!.id,
          serviceId: service.id,
          categoryName: this.selectedCategory!.name,
          subcategoryName: this.selectedSubcategory!.name,
          serviceName: service.name,
          configured: false,
        });
      }
    });
  }

  clearAllServices(): void {
    if (!this.selectedSubcategory) return;

    this.selectedServices = this.selectedServices.filter(
      (s) => s.subcategoryId !== this.selectedSubcategory!.id
    );
  }

  getSelectedCount(): number {
    return this.selectedServices.length;
  }

  // ============================================
  // Inline Configuration
  // ============================================

  initializeConfigurationForm(): void {
    this.configurationForm = this.fb.group({
      services: this.fb.array([]),
    });
  }

  buildConfigurationForm(): void {
    // No longer needed - services auto-added on selection
  }

  toggleServiceExpansion(index: number): void {
    this.expandedServiceIndex = this.expandedServiceIndex === index ? null : index;
  }

  isServiceExpanded(index: number): boolean {
    return this.expandedServiceIndex === index;
  }

  removeServiceFromConfig(index: number): void {
    if (this.selectedServices.length <= 1) {
      // Don't allow removing the last service
      return;
    }

    // Remove from selected services array
    this.selectedServices.splice(index, 1);

    // Remove from form array
    this.serviceConfigArray.removeAt(index);

    // Remove pricing mode if exists
    if (this.pricingMode[index] !== undefined) {
      delete this.pricingMode[index];
      // Re-index the remaining pricing modes
      const newPricingMode: { [key: number]: 'unified' | 'per-origin' } = {};
      Object.keys(this.pricingMode).forEach((key) => {
        const keyNum = parseInt(key);
        if (keyNum > index) {
          newPricingMode[keyNum - 1] = this.pricingMode[keyNum];
        } else if (keyNum < index) {
          newPricingMode[keyNum] = this.pricingMode[keyNum];
        }
      });
      this.pricingMode = newPricingMode;
    }

    // Adjust expanded index if needed
    if (this.expandedServiceIndex !== null) {
      if (this.expandedServiceIndex === index) {
        this.expandedServiceIndex = null;
      } else if (this.expandedServiceIndex > index) {
        this.expandedServiceIndex--;
      }
    }

    // Save draft
    this.saveDraft();
  }

  proceedToConfiguration(): void {
    if (this.selectedServices.length > 0) {
      this.nextStep();
    }
  }

  createServiceConfigGroup(service: SelectedService): FormGroup {
    return this.fb.group(
      {
        serviceId: [service.serviceId],
        categoryId: [service.categoryId],
        subcategoryId: [service.subcategoryId],
        serviceName: [service.serviceName],
        categoryName: [service.categoryName],
        subcategoryName: [service.subcategoryName],
        description: [''],
        durationMinutes: [60, [Validators.required, Validators.min(15), Validators.max(480)]],
        minPrice: [0, [Validators.required, Validators.min(0)]],
        maxPrice: [0, [Validators.required, Validators.min(0)]],
        carOriginSpecializations: [[], [Validators.required, Validators.minLength(1)]],
        imageUrl: [''],
        isAvailable: [true],
      },
      { validators: this.priceRangeValidator }
    );
  }

  createOriginPricingArray(priceRange: { min: number; max: number }): any[] {
    return this.carOrigins
      .filter((o) => o.code !== 'all')
      .map((origin) => ({
        originCode: origin.code,
        originName: origin.name,
        minPrice: priceRange.min,
        maxPrice: priceRange.max,
        isEnabled: false,
      }));
  }

  togglePricingMode(serviceIndex: number): void {
    const currentMode = this.pricingMode[serviceIndex] || 'unified';
    this.pricingMode[serviceIndex] = currentMode === 'unified' ? 'per-origin' : 'unified';

    const serviceGroup = this.getServiceFormGroup(serviceIndex);

    if (this.pricingMode[serviceIndex] === 'per-origin') {
      // When switching to per-origin, copy unified pricing to all origins and enable them
      const minPrice = serviceGroup.get('minPrice')?.value || 0;
      const maxPrice = serviceGroup.get('maxPrice')?.value || 0;
      const selectedOrigins = serviceGroup.get('carOriginSpecializations')?.value || ['all'];
      const originPricing = serviceGroup.get('originPricing')?.value || [];

      // Enable origins that were selected in unified mode, or all if 'all' was selected
      const shouldEnableAll = selectedOrigins.includes('all');

      originPricing.forEach((origin: any) => {
        origin.minPrice = minPrice;
        origin.maxPrice = maxPrice;
        origin.isEnabled = shouldEnableAll || selectedOrigins.includes(origin.originCode);
      });

      serviceGroup.get('originPricing')?.setValue(originPricing);

      // Update specializations with enabled origins
      const enabledOrigins = originPricing
        .filter((o: any) => o.isEnabled)
        .map((o: any) => o.originCode);
      serviceGroup.get('carOriginSpecializations')?.setValue(enabledOrigins);
    } else {
      // When switching to unified, keep current pricing from first enabled origin
      const originPricing = serviceGroup.get('originPricing')?.value || [];
      const firstEnabled = originPricing.find((o: any) => o.isEnabled);

      if (firstEnabled) {
        serviceGroup.get('minPrice')?.setValue(firstEnabled.minPrice);
        serviceGroup.get('maxPrice')?.setValue(firstEnabled.maxPrice);
      }

      serviceGroup.get('carOriginSpecializations')?.setValue(['all']);
    }
  }

  getPricingMode(serviceIndex: number): 'unified' | 'per-origin' {
    return this.pricingMode[serviceIndex] || 'unified';
  }

  updateOriginPricing(
    serviceIndex: number,
    originCode: string,
    field: 'minPrice' | 'maxPrice',
    value: number
  ): void {
    const serviceGroup = this.getServiceFormGroup(serviceIndex);
    const originPricing = serviceGroup.get('originPricing')?.value || [];

    const origin = originPricing.find((o: any) => o.originCode === originCode);
    if (origin) {
      origin[field] = value;
      serviceGroup.get('originPricing')?.setValue(originPricing);
    }
  }

  toggleOriginEnabled(serviceIndex: number, originCode: string): void {
    const serviceGroup = this.getServiceFormGroup(serviceIndex);
    const originPricing = serviceGroup.get('originPricing')?.value || [];

    const origin = originPricing.find((o: any) => o.originCode === originCode);
    if (origin) {
      origin.isEnabled = !origin.isEnabled;
      serviceGroup.get('originPricing')?.setValue(originPricing);

      // Update carOriginSpecializations
      const enabledOrigins = originPricing
        .filter((o: any) => o.isEnabled)
        .map((o: any) => o.originCode);
      serviceGroup.get('carOriginSpecializations')?.setValue(enabledOrigins);
    }
  }

  enableAllOrigins(serviceIndex: number): void {
    const serviceGroup = this.getServiceFormGroup(serviceIndex);
    const originPricing = serviceGroup.get('originPricing')?.value || [];

    originPricing.forEach((origin: any) => {
      origin.isEnabled = true;
    });

    serviceGroup.get('originPricing')?.setValue(originPricing);
    serviceGroup
      .get('carOriginSpecializations')
      ?.setValue(originPricing.map((o: any) => o.originCode));
  }

  disableAllOrigins(serviceIndex: number): void {
    const serviceGroup = this.getServiceFormGroup(serviceIndex);
    const originPricing = serviceGroup.get('originPricing')?.value || [];

    originPricing.forEach((origin: any) => {
      origin.isEnabled = false;
    });

    serviceGroup.get('originPricing')?.setValue(originPricing);
    serviceGroup.get('carOriginSpecializations')?.setValue([]);
  }

  copyPricingToAll(serviceIndex: number): void {
    const serviceGroup = this.getServiceFormGroup(serviceIndex);
    const originPricing = serviceGroup.get('originPricing')?.value || [];

    // Find first enabled origin as reference
    const reference = originPricing.find((o: any) => o.isEnabled);
    if (!reference) return;

    originPricing.forEach((origin: any) => {
      if (origin.isEnabled) {
        origin.minPrice = reference.minPrice;
        origin.maxPrice = reference.maxPrice;
      }
    });

    serviceGroup.get('originPricing')?.setValue(originPricing);
  }

  getEnabledOriginsCount(serviceIndex: number): number {
    const originPricing = this.getOriginPricing(serviceIndex);
    return originPricing.filter((o: any) => o.isEnabled).length;
  }

  getOriginPricing(serviceIndex: number): any[] {
    const serviceGroup = this.getServiceFormGroup(serviceIndex);
    return serviceGroup.get('originPricing')?.value || [];
  }

  priceRangeValidator(group: FormGroup): { [key: string]: boolean } | null {
    const minPrice = group.get('minPrice')?.value;
    const maxPrice = group.get('maxPrice')?.value;

    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
      return { priceRangeInvalid: true };
    }

    return null;
  }

  get serviceConfigArray(): FormArray {
    return this.configurationForm.get('services') as FormArray;
  }

  getServiceFormGroup(index: number): FormGroup {
    return this.serviceConfigArray.at(index) as FormGroup;
  }

  switchConfigTab(index: number): void {
    this.activeConfigTab = index;
  }

  // Car origin selection helpers

  /**
   * Get selectable origins (excluding 'all')
   */
  getSelectableOrigins() {
    return this.carOrigins.filter((o) => o.code !== 'all');
  }

  /**
   * Toggle all origins (globe button)
   * Only activates when explicitly clicked
   */
  toggleAllOrigins(serviceIndex: number): void {
    const serviceGroup = this.getServiceFormGroup(serviceIndex);
    const origins = serviceGroup.get('carOriginSpecializations')?.value || [];

    if (this.areAllOriginsSelected(serviceIndex)) {
      // Clear all selections (remove 'all' code)
      serviceGroup.patchValue({ carOriginSpecializations: [] });
    } else {
      // Select all origins by setting 'all' code
      // This indicates bulk selection via globe, not individual selections
      serviceGroup.patchValue({ carOriginSpecializations: ['all'] });
    }
  }

  /**
   * Toggle a single origin (manual selection)
   * Automatically deselects 'all' when individual origins are selected
   */
  toggleSingleOrigin(serviceIndex: number, originCode: string): void {
    const serviceGroup = this.getServiceFormGroup(serviceIndex);
    const origins = serviceGroup.get('carOriginSpecializations')?.value || [];

    const index = origins.indexOf(originCode);
    if (index > -1) {
      // Deselect this origin
      origins.splice(index, 1);
    } else {
      // Select this origin
      origins.push(originCode);

      // Remove 'all' if it exists (manual selection excludes "all origins" mode)
      const allIndex = origins.indexOf('all');
      if (allIndex > -1) {
        origins.splice(allIndex, 1);
      }
    }

    serviceGroup.patchValue({ carOriginSpecializations: [...origins] });
  }

  /**
   * Check if all origins are selected (ONLY via explicit globe click, not manual selection)
   */
  areAllOriginsSelected(serviceIndex: number): boolean {
    const serviceGroup = this.getServiceFormGroup(serviceIndex);
    const origins = serviceGroup.get('carOriginSpecializations')?.value || [];

    // Only show globe as selected if 'all' code is explicitly in the array
    return origins.includes('all');
  }

  /**
   * Check if a specific origin is selected
   * Also returns true if 'all' is selected (for visual feedback)
   */
  isCarOriginSelected(serviceIndex: number, originCode: string): boolean {
    const serviceGroup = this.getServiceFormGroup(serviceIndex);
    const origins = serviceGroup.get('carOriginSpecializations')?.value || [];

    // If 'all' is selected, show all individual origins as selected too
    if (origins.includes('all')) {
      return true;
    }

    return origins.includes(originCode);
  }

  /**
   * Get count of selected origins
   * If 'all' is selected, return count of all selectable origins
   */
  getSelectedOriginsCount(serviceIndex: number): number {
    const serviceGroup = this.getServiceFormGroup(serviceIndex);
    const origins = serviceGroup.get('carOriginSpecializations')?.value || [];

    if (origins.includes('all')) {
      return this.carOrigins.filter((o) => o.code !== 'all').length;
    }

    return origins.length;
  }

  /**
   * Old method - kept for backward compatibility
   */
  toggleCarOrigin(serviceIndex: number, originCode: string): void {
    if (originCode === 'all') {
      this.toggleAllOrigins(serviceIndex);
    } else {
      this.toggleSingleOrigin(serviceIndex, originCode);
    }
  }

  // Bulk actions
  applyDurationToAll(): void {
    const currentDuration = this.getServiceFormGroup(this.activeConfigTab).get(
      'durationMinutes'
    )?.value;
    this.serviceConfigArray.controls.forEach((control, index) => {
      if (index !== this.activeConfigTab) {
        control.patchValue({ durationMinutes: currentDuration });
      }
    });
  }

  applyPriceToAll(): void {
    const currentGroup = this.getServiceFormGroup(this.activeConfigTab);
    const minPrice = currentGroup.get('minPrice')?.value;
    const maxPrice = currentGroup.get('maxPrice')?.value;

    this.serviceConfigArray.controls.forEach((control, index) => {
      if (index !== this.activeConfigTab) {
        control.patchValue({ minPrice, maxPrice });
      }
    });
  }

  applyOriginToAll(): void {
    const currentOrigins = this.getServiceFormGroup(this.activeConfigTab).get(
      'carOriginSpecializations'
    )?.value;
    this.serviceConfigArray.controls.forEach((control, index) => {
      if (index !== this.activeConfigTab) {
        control.patchValue({ carOriginSpecializations: [...currentOrigins] });
      }
    });
  }

  // ============================================
  // Step 5: Review & Submit
  // ============================================

  getConfiguredServices(): WorkshopService[] {
    return this.serviceConfigArray.controls.map((control) => control.value);
  }

  editService(index: number): void {
    this.currentStep = 4;
    this.activeConfigTab = index;
    this.scrollToTop();
  }

  onSubmit(): void {
    if (!this.configurationForm.valid) {
      this.showErrorMessage('Please complete all required fields with valid values.');
      return;
    }

    if (!this.workshopProfileId) {
      this.showErrorMessage('Workshop profile not loaded. Please refresh and try again.');
      return;
    }

    this.isSubmitting = true;
    this.isLoadingSubmit = true;
    this.submitError = null;
    this.showMessage = false;

    // Handle edit mode differently
    if (this.isEditMode && this.editingService) {
      this.proceedWithUpdate();
      return;
    }

    const services = this.getConfiguredServices();

    // Check for duplicate services before submission
    this.workshopServiceAPI.getWorkshopServices(this.workshopProfileId).subscribe({
      next: (response: any) => {
        // Handle paginated response structure
        const existingServices =
          response.data?.items || (Array.isArray(response.data) ? response.data : []);
        const duplicates = this.findDuplicateServices(services, existingServices);

        if (duplicates.length > 0) {
          // Reset loading states immediately
          this.isSubmitting = false;
          this.isLoadingSubmit = false;

          // Show friendly error message for duplicates
          const duplicateNames = duplicates.map((d) => d.serviceName).join(', ');
          const message =
            duplicates.length === 1
              ? `The service "${duplicateNames}" already exists in your portfolio. Please select a different service or update the existing one.`
              : `The following services already exist in your portfolio: ${duplicateNames}. Please select different services or update the existing ones.`;

          this.showErrorMessage(message);
          return;
        }

        // No duplicates, proceed with submission
        this.proceedWithSubmission(services);
      },
      error: (error: any) => {
        console.error('Error checking for duplicates:', error);
        // If we can't check, proceed anyway (fail open)
        this.proceedWithSubmission(services);
      },
    });
  }

  private findDuplicateServices(newServices: any[], existingServices: any[]): any[] {
    const duplicates: any[] = [];

    newServices.forEach((newService) => {
      const isDuplicate = existingServices.some(
        (existing) => existing.serviceId === newService.serviceId
      );

      if (isDuplicate) {
        duplicates.push(newService);
      }
    });

    return duplicates;
  }

  /**
   * Handle update of existing service
   */
  private proceedWithUpdate(): void {
    if (!this.editingService) return;

    const serviceForm = this.serviceConfigArray.at(0) as FormGroup;
    if (!serviceForm) {
      this.showErrorMessage('Form configuration error. Please try again.');
      return;
    }

    const formValue = serviceForm.value;

    // Get selected origin (single value in edit mode)
    const originCode = formValue.carOriginSpecializations || '';

    // Use the same mapping as create service
    const originName = this.mapOriginToEnum(originCode);

    // Prepare update payload - include ID in the body as per DTO
    const updatePayload = {
      id: this.editingService.id,
      duration: formValue.durationMinutes,
      minPrice: formValue.minPrice,
      maxPrice: formValue.maxPrice,
      origin: originName,
    };

    console.log('Updating service:', this.editingService.id, updatePayload);

    // Call update API
    this.workshopServiceAPI.updateWorkshopService(this.editingService.id, updatePayload).subscribe({
      next: (response: any) => {
        console.log('Service updated successfully:', response);
        this.isSubmitting = false;
        this.isLoadingSubmit = false;

        // Emit updated service
        this.serviceUpdated.emit(response.data || response);

        // Show success message and close
        this.showSuccessMessageWithRedirect('Service updated successfully!', [
          response.data || response,
        ]);
      },
      error: (error: any) => {
        console.error('Error updating service:', error);
        this.isSubmitting = false;
        this.isLoadingSubmit = false;

        let errorMessage = 'Failed to update service. Please try again.';
        if (error?.error?.message) {
          errorMessage = error.error.message;
        } else if (error?.message) {
          errorMessage = error.message;
        }

        this.showErrorMessage(errorMessage);
      },
    });
  }

  private proceedWithSubmission(services: any[]): void {
    // Transform form data to API requests
    const apiRequests: WorkshopServiceCreateRequest[] = [];

    services.forEach((service, serviceIndex) => {
      const pricingMode = this.pricingMode[serviceIndex] || 'unified';

      console.log(`Processing service ${serviceIndex + 1}:`, {
        serviceName: service.serviceName,
        serviceId: service.serviceId,
        pricingMode,
        carOriginSpecializations: service.carOriginSpecializations,
      });

      if (pricingMode === 'unified') {
        // Unified mode: Create records for each selected origin
        const origins = service.carOriginSpecializations || [];

        if (origins.includes('all')) {
          // If 'all' is selected, create records for each specific origin
          const allOrigins = [
            'german',
            'japanese',
            'korean',
            'american',
            'french',
            'italian',
            'british',
            'chinese',
          ];
          console.log(`  → Creating ${allOrigins.length} records (all origins)`);
          allOrigins.forEach((origin) => {
            apiRequests.push({
              serviceId: service.serviceId,
              workShopProfileId: this.workshopProfileId!,
              duration: service.durationMinutes,
              minPrice: service.minPrice,
              maxPrice: service.maxPrice,
              origin: this.mapOriginToEnum(origin),
            });
          });
        } else {
          // Create one record per selected origin with same pricing
          console.log(`  → Creating ${origins.length} records (selected origins)`);
          origins.forEach((origin: string) => {
            apiRequests.push({
              serviceId: service.serviceId,
              workShopProfileId: this.workshopProfileId!,
              duration: service.durationMinutes,
              minPrice: service.minPrice,
              maxPrice: service.maxPrice,
              origin: this.mapOriginToEnum(origin),
            });
          });
        }
      } else {
        // Per-origin mode: Create one record per enabled origin with individual pricing
        const originPricing = service.originPricing || [];
        const enabledOrigins = originPricing.filter((o: any) => o.isEnabled);
        console.log(`  → Creating ${enabledOrigins.length} records (per-origin pricing)`);

        originPricing.forEach((originConfig: any) => {
          if (originConfig.isEnabled) {
            apiRequests.push({
              serviceId: service.serviceId,
              workShopProfileId: this.workshopProfileId!,
              duration: service.durationMinutes,
              minPrice: originConfig.minPrice,
              maxPrice: originConfig.maxPrice,
              origin: this.mapOriginToEnum(originConfig.originCode),
            });
          }
        });
      }
    });

    console.log('=== WORKSHOP SERVICE SUBMISSION ===');
    console.log('Workshop Profile ID:', this.workshopProfileId);
    console.log('Total API Requests:', apiRequests.length);
    console.log('API Requests Details:', JSON.stringify(apiRequests, null, 2));

    // Call API to create workshop services
    this.workshopServiceAPI.createWorkshopServices(apiRequests).subscribe({
      next: (response: any) => {
        console.log('Services created successfully:', response);
        this.isSubmitting = false;
        this.isLoadingSubmit = false;
        this.submitError = null;

        // Check if there were any failures
        if (response.failedCount > 0) {
          this.showErrorMessage(
            `Created ${response.successCount} service(s), but ${response.failedCount} failed. Please check the console for details.`
          );
        } else {
          // Show success message with auto-redirect
          this.showSuccessMessageWithRedirect(
            `Successfully added ${response.successCount} service${
              response.successCount > 1 ? 's' : ''
            }!`,
            services
          );
        }
      },
      error: (error: any) => {
        console.error('Error adding services:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        this.isSubmitting = false;
        this.isLoadingSubmit = false;

        // Extract error message from response
        let errorMessage = 'Failed to add services. Please try again.';
        if (error?.error?.message) {
          errorMessage = error.error.message;
        } else if (error?.message) {
          errorMessage = error.message;
        } else if (error?.error?.errors) {
          errorMessage = JSON.stringify(error.error.errors);
        }

        this.submitError = errorMessage;
        this.showErrorMessage(errorMessage);
      },
    });
  }

  // ============================================
  // Draft Management
  // ============================================

  saveDraft(): void {
    const draft = {
      step: this.currentStep,
      selectedCategory: this.selectedCategory,
      selectedSubcategory: this.selectedSubcategory,
      selectedServices: this.selectedServices,
      configurationData: this.configurationForm.value,
      showSubcategories: this.showSubcategories,
      showServices: this.showServices,
      applyToAll: this.applyToAll,
      timestamp: Date.now(),
    };
    localStorage.setItem('addServiceDraft', JSON.stringify(draft));
    this.showAutoSaveIndicator();
  }

  showingAutoSave = false;
  showAutoSaveIndicator(): void {
    this.showingAutoSave = true;
    setTimeout(() => {
      this.showingAutoSave = false;
    }, 1500);
  }

  checkForSavedDraft(): void {
    const saved = localStorage.getItem('addServiceDraft');
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        const hoursSinceSave = (Date.now() - draft.timestamp) / (1000 * 60 * 60);

        if (hoursSinceSave < 24) {
          this.hasSavedDraft = true;
          this.showDraftBanner = true;
        } else {
          this.clearDraft();
        }
      } catch (error) {
        console.error('Error parsing draft:', error);
        this.clearDraft();
      }
    }
  }

  restoreDraft(): void {
    const saved = localStorage.getItem('addServiceDraft');
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        this.currentStep = draft.step;
        this.selectedCategory = draft.selectedCategory;
        this.selectedSubcategory = draft.selectedSubcategory;
        this.selectedServices = draft.selectedServices;
        this.showSubcategories = draft.showSubcategories || false;
        this.showServices = draft.showServices || false;
        this.applyToAll = draft.applyToAll !== undefined ? draft.applyToAll : true;

        if (draft.configurationData) {
          this.configurationForm.patchValue(draft.configurationData);
        }

        this.showDraftBanner = false;
      } catch (error) {
        console.error('Error restoring draft:', error);
      }
    }
  }

  dismissDraft(): void {
    this.showDraftBanner = false;
    this.clearDraft();
  }

  clearDraft(): void {
    localStorage.removeItem('addServiceDraft');
    this.hasSavedDraft = false;
  }

  // ============================================
  // UI Helpers
  // ============================================

  /**
   * Map frontend origin codes to backend CarOrigin enum values
   */
  mapOriginToEnum(originCode: string): string {
    const originMap: { [key: string]: string } = {
      all: 'General',
      german: 'Germany',
      japanese: 'Japan',
      korean: 'SouthKorea',
      american: 'USA',
      chinese: 'China',
      french: 'France',
      italian: 'Italy',
      british: 'UK',
      czech: 'CzechRepublic',
      swedish: 'Sweden',
      malaysian: 'Malaysia',
    };

    return originMap[originCode.toLowerCase()] || 'General';
  }

  showSuccessMessageWithRedirect(message: string, services: any[]): void {
    this.resultMessage = message;
    this.isSuccess = true;
    this.showMessage = true;
    this.isRedirecting = true;
    this.redirectCountdown = 3;

    // Emit services added immediately so parent can start reloading
    this.servicesAdded.emit(services);

    // Countdown timer
    const countdownInterval = setInterval(() => {
      this.redirectCountdown--;
      if (this.redirectCountdown <= 0) {
        clearInterval(countdownInterval);
      }
    }, 1000);

    // Close modal after 3 seconds
    setTimeout(() => {
      this.clearDraft();
      this.closeModal();
    }, 3000);
  }

  showErrorMessage(message: string): void {
    this.resultMessage = message;
    this.isSuccess = false;
    this.showMessage = true;
    this.isRedirecting = false;
    // Ensure loading states are reset
    this.isSubmitting = false;
    this.isLoadingSubmit = false;
  }

  dismissMessage(): void {
    this.showMessage = false;
    this.isRedirecting = false;
  }

  closeModal(): void {
    this.close.emit();
  }

  // Keyboard shortcuts
  @HostListener('document:keydown.escape')
  handleEscape(): void {
    if (!this.isSubmitting) {
      // Go back one level if in nested navigation, otherwise close
      if (this.showServices) {
        this.showServices = false;
      } else if (this.showSubcategories) {
        this.showSubcategories = false;
      } else if (this.currentStep > 1) {
        this.previousStep();
      } else {
        this.closeModal();
      }
    }
  }

  @HostListener('document:keydown.enter', ['$event'])
  handleEnter(event: any): void {
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return;
    }

    if (this.canProceedToNextStep() && !this.isSubmitting) {
      event.preventDefault();
      if (this.currentStep === this.totalSteps) {
        this.onSubmit();
      } else {
        this.nextStep();
      }
    }
  }

  @HostListener('document:keydown./', ['$event'])
  handleSearchShortcut(event: any): void {
    const target = event.target as HTMLElement;
    if (target.tagName !== 'INPUT') {
      event.preventDefault();
      const searchInput = document.querySelector('.search-bar input') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
      }
    }
  }

  @HostListener('document:keydown.control.a', ['$event'])
  handleSelectAll(event: any): void {
    if (this.currentStep === 1 && this.showServices) {
      event.preventDefault();
      this.selectAllServices();
    }
  }

  // Format helpers
  formatDuration(minutes: number): string {
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

  formatPrice(price: number): string {
    return `${price.toLocaleString()} EGP`;
  }

  getOriginFlagByCode(originCode: string): string {
    const origin = this.carOrigins.find((o) => o.code === originCode);
    return origin?.flag || '🌍';
  }
}
