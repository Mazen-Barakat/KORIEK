import { Component, OnInit, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { WorkshopProfileService } from '../../services/workshop-profile.service';
import { WorkshopService, ServiceCategory, ServiceSubcategory, ServiceItem, CAR_ORIGINS } from '../../models/workshop-profile.model';

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
  styleUrls: ['./add-service-modal.component.css']
})
export class AddServiceModalComponent implements OnInit {
  @Output() close = new EventEmitter<void>();
  @Output() servicesAdded = new EventEmitter<WorkshopService[]>();

  // Step management - simplified to 3 steps
  currentStep = 1;
  totalSteps = 3;

  // Data from JSON
  categories: ServiceCategory[] = [];
  filteredCategories: ServiceCategory[] = [];
  
  // Smart defaults for service configuration
  defaultDuration = 60; // minutes
  categoryPriceRanges: { [key: number]: { min: number; max: number } } = {
    1: { min: 100, max: 300 },   // Periodic Maintenance
    2: { min: 150, max: 400 },   // Seasonal Check-ups
    3: { min: 200, max: 800 },   // Mechanical Repairs
    4: { min: 300, max: 1000 },  // Electrical
    5: { min: 250, max: 900 },   // AC & Cooling
    6: { min: 500, max: 2000 },  // Body & Paint
    7: { min: 50, max: 200 }     // Tires
  };
  
  applyToAll = true; // Bulk configuration toggle
  
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
  
  // Draft management
  showDraftBanner = false;
  hasSavedDraft = false;

  constructor(
    private fb: FormBuilder,
    private workshopService: WorkshopProfileService
  ) {}

  ngOnInit(): void {
    this.loadServiceCategories();
    this.initializeConfigurationForm();
    this.checkForSavedDraft();
  }

  // ============================================
  // Data Loading
  // ============================================

  loadServiceCategories(): void {
    this.isLoading = true;
    this.workshopService.loadServiceCategories().subscribe({
      next: (data) => {
        this.categories = data.categories || [];
        this.filteredCategories = [...this.categories];
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading service categories:', error);
        this.showErrorMessage('Failed to load service categories. Please try again.');
        this.isLoading = false;
      }
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
    return this.serviceConfigArray.controls.every(control => {
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
    this.showSubcategories = true;
    this.showServices = false;
  }

  filterCategories(): void {
    const term = this.categorySearchTerm.toLowerCase().trim();
    if (!term) {
      this.filteredCategories = [...this.categories];
    } else {
      this.filteredCategories = this.categories.filter(cat =>
        cat.name.toLowerCase().includes(term)
      );
    }
  }

  // ============================================
  // Step 2: Subcategory Selection
  // ============================================

  selectSubcategory(subcategory: ServiceSubcategory): void {
    this.selectedSubcategory = subcategory;
    this.showServices = true;
  }

  getFilteredSubcategories(): ServiceSubcategory[] {
    if (!this.selectedCategory) return [];
    
    const term = this.subcategorySearchTerm.toLowerCase().trim();
    if (!term) {
      return this.selectedCategory.subcategories;
    }
    
    return this.selectedCategory.subcategories.filter(sub =>
      sub.name.toLowerCase().includes(term)
    );
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
    
    return this.selectedSubcategory.services.filter(service =>
      service.name.toLowerCase().includes(term)
    );
  }

  isServiceSelected(serviceId: number): boolean {
    return this.selectedServices.some(s => s.serviceId === serviceId);
  }

  toggleServiceSelection(service: ServiceItem): void {
    const index = this.selectedServices.findIndex(s => s.serviceId === service.id);
    
    if (index > -1) {
      this.selectedServices.splice(index, 1);
      // Remove from configuration form
      const configIndex = this.serviceConfigArray.controls.findIndex(
        ctrl => ctrl.get('serviceId')?.value === service.id
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
        configured: false
      });
      // Auto-add to configuration form with smart defaults
      this.addServiceToConfig(service);
    }
    this.saveDraft();
  }
  
  addServiceToConfig(service: ServiceItem): void {
    const priceRange = this.categoryPriceRanges[this.selectedCategory!.id] || { min: 100, max: 500 };
    const newGroup = this.fb.group({
      serviceId: [service.id],
      categoryId: [this.selectedCategory!.id],
      subcategoryId: [this.selectedSubcategory!.id],
      serviceName: [service.name],
      categoryName: [this.selectedCategory!.name],
      subcategoryName: [this.selectedSubcategory!.name],
      description: [''],
      durationMinutes: [this.defaultDuration, [Validators.required, Validators.min(15), Validators.max(480)]],
      minPrice: [priceRange.min, [Validators.required, Validators.min(0)]],
      maxPrice: [priceRange.max, [Validators.required, Validators.min(0)]],
      carOriginSpecializations: [['all'], [Validators.required, Validators.minLength(1)]],
      imageUrl: [''],
      isAvailable: [true]
    }, { validators: this.priceRangeValidator });
    
    this.serviceConfigArray.push(newGroup);
    
    // If applyToAll is enabled and this is not the first service, copy first service config
    if (this.applyToAll && this.serviceConfigArray.length > 1) {
      const firstConfig = this.serviceConfigArray.at(0);
      newGroup.patchValue({
        durationMinutes: firstConfig.get('durationMinutes')?.value,
        minPrice: firstConfig.get('minPrice')?.value,
        maxPrice: firstConfig.get('maxPrice')?.value,
        carOriginSpecializations: [...firstConfig.get('carOriginSpecializations')?.value]
      });
    }
  }

  selectAllServices(): void {
    if (!this.selectedSubcategory) return;
    
    const filteredServices = this.getFilteredServices();
    filteredServices.forEach(service => {
      if (!this.isServiceSelected(service.id)) {
        this.selectedServices.push({
          categoryId: this.selectedCategory!.id,
          subcategoryId: this.selectedSubcategory!.id,
          serviceId: service.id,
          categoryName: this.selectedCategory!.name,
          subcategoryName: this.selectedSubcategory!.name,
          serviceName: service.name,
          configured: false
        });
      }
    });
  }

  clearAllServices(): void {
    if (!this.selectedSubcategory) return;
    
    this.selectedServices = this.selectedServices.filter(
      s => s.subcategoryId !== this.selectedSubcategory!.id
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
      services: this.fb.array([])
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
  
  proceedToConfiguration(): void {
    if (this.selectedServices.length > 0) {
      this.nextStep();
    }
  }

  createServiceConfigGroup(service: SelectedService): FormGroup {
    return this.fb.group({
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
      isAvailable: [true]
    }, { validators: this.priceRangeValidator });
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
  toggleCarOrigin(serviceIndex: number, originCode: string): void {
    const serviceGroup = this.getServiceFormGroup(serviceIndex);
    const origins = serviceGroup.get('carOriginSpecializations')?.value || [];
    
    if (originCode === 'all') {
      // Select all or deselect all
      if (origins.includes('all')) {
        serviceGroup.patchValue({ carOriginSpecializations: [] });
      } else {
        const allOrigins = this.carOrigins.map(o => o.code);
        serviceGroup.patchValue({ carOriginSpecializations: allOrigins });
      }
    } else {
      // Toggle individual origin
      const index = origins.indexOf(originCode);
      if (index > -1) {
        origins.splice(index, 1);
        // Remove 'all' if it was selected
        const allIndex = origins.indexOf('all');
        if (allIndex > -1) origins.splice(allIndex, 1);
      } else {
        origins.push(originCode);
      }
      serviceGroup.patchValue({ carOriginSpecializations: origins });
    }
  }

  isCarOriginSelected(serviceIndex: number, originCode: string): boolean {
    const serviceGroup = this.getServiceFormGroup(serviceIndex);
    const origins = serviceGroup.get('carOriginSpecializations')?.value || [];
    return origins.includes(originCode);
  }

  // Bulk actions
  applyDurationToAll(): void {
    const currentDuration = this.getServiceFormGroup(this.activeConfigTab).get('durationMinutes')?.value;
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
    const currentOrigins = this.getServiceFormGroup(this.activeConfigTab).get('carOriginSpecializations')?.value;
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
    return this.serviceConfigArray.controls.map(control => control.value);
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

    this.isSubmitting = true;
    this.showMessage = false;
    const services = this.getConfiguredServices();

    // For mock/development: Since API might not be ready, emit immediately
    // In production, this will call the actual API
    console.log('Submitting services:', services);
    
    // Simulate API call for now - replace with actual API when ready
    setTimeout(() => {
      this.isSubmitting = false;
      this.clearDraft();
      this.servicesAdded.emit(services);
      this.closeModal();
    }, 800);
    
    /* Uncomment when API is ready:
    this.workshopService.addWorkshopServices(workshopId, services).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        this.clearDraft();
        this.servicesAdded.emit(services);
        this.closeModal();
      },
      error: (error) => {
        console.error('Error adding services:', error);
        this.isSubmitting = false;
        this.showErrorMessage('Failed to add services. Please try again.');
      }
    });
    */
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
      timestamp: Date.now()
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

  showSuccessMessage(message: string): void {
    this.resultMessage = message;
    this.isSuccess = true;
    this.showMessage = true;
  }

  showErrorMessage(message: string): void {
    this.resultMessage = message;
    this.isSuccess = false;
    this.showMessage = true;
  }

  dismissMessage(): void {
    this.showMessage = false;
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
    const origin = this.carOrigins.find(o => o.code === originCode);
    return origin?.flag || '🌍';
  }
}
