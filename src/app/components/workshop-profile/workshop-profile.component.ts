import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { WorkshopProfileService } from '../../services/workshop-profile.service';

interface Service {
  id: string;
  name: string; // Name
  description: string; // Description
  duration: number; // Duration in minutes
  minPrice: number; // MinPrice
  maxPrice: number; // MaxPrice
  imageUrl?: string; // ImageUrl
  selected?: boolean;
}

interface WorkshopData {
  id: string;
  name: string;
  initials: string;
  rating: number;
  reviewCount: number;
  type: string;
  location: string;
  verified: boolean;
  status: 'open' | 'closed';
  closingTime: string;
  phone: string;
  website: string;
  email: string;
  about: string;
  techCount: number;
  experience: string;
  workingHours: {
    [key: string]: { open: string; close: string } | 'closed';
  };
  services: Service[];
  gallery: string[];
  headerImage: string;
  logoUrl?: string;
}

@Component({
  selector: 'app-workshop-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './workshop-profile.component.html',
  styleUrls: ['./workshop-profile.component.css']
})
export class WorkshopProfileComponent implements OnInit {
  // Empty initial state: fields are intentionally blank so the page shows
  // empty sections until the workshop owner fills them from elsewhere.
  workshop: WorkshopData = {
    id: '',
    name: '',
    initials: '',
    rating: 0,
    reviewCount: 0,
    type: '',
    location: '',
    verified: false,
    status: 'closed',
    closingTime: '',
    phone: '',
    website: '',
    email: '',
    about: '',
    techCount: 0,
    experience: '',
    // no working hours set initially
    workingHours: {},
    // no services or gallery initially
    services: [],
    gallery: [],
    headerImage: '',
    logoUrl: ''
  };

  selectedTab: 'services' | 'reviews' = 'services';
  // Temporary owner flag. Keep false by default so owner-only controls
  // remain hidden until authenticated owner data is provided.
  isOwner: boolean = false;

  // Service form state for add/edit
  editingService: Service | null = null;
  serviceForm: Partial<Service> = {
    name: '',
    description: '',
    duration: 30,
    minPrice: 0,
    maxPrice: 0,
    imageUrl: ''
  };

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private workshopProfileService: WorkshopProfileService
  ) {}

  ngOnInit(): void {
    // Load workshop data from logged-in user
    this.loadWorkshopData();
  }

  private loadWorkshopData(): void {
    const user = this.authService.getUser();
    const workshopIdFromRoute = this.route.snapshot.paramMap.get('id');
    const currentUserId = this.authService.getUserId();
    
    // Use route param if available, otherwise use current user's ID
    const workshopId = workshopIdFromRoute || currentUserId;

    if (user) {
      // Set default workshop name as "My Workshop" (can be updated later via workshop profile form)
      this.workshop.name = 'My Workshop';
      this.workshop.id = workshopId || '';

      // Generate initials from workshop name
      this.workshop.initials = 'MW';

      // Set default email/phone if available (can be updated later)
      this.workshop.email = user.email || '';
      this.workshop.phone = user.phoneNumber || user.phone || '';

      // Check if current user is the owner
      // Always true if viewing without a specific ID in route, or if the ID matches current user
      this.isOwner = !workshopIdFromRoute || (currentUserId === workshopId);
      
      // basic user-based defaults applied above; we'll fetch profile below
    }

    // Always fetch the workshop profile from the backend so the page
    // displays numbersOfTechnicians, workShopType and description even
    // if `authService.getUser()` returned null.
    this.workshopProfileService.getMyWorkshopProfile().subscribe({
      next: (response) => {
        console.log('Workshop Profile API Response:', response);
        const profile = response?.data ?? response;
        if (!profile) return;

        this.applyProfileToState(profile, user);
      },
      error: (error) => {
        console.error('Error loading workshop profile:', error);
      }
    });
  }

  private buildAssetUrl(path: string): string {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    const baseUrl = 'https://localhost:44316';
    return `${baseUrl}${path.startsWith('/') ? path : '/' + path}`;
  }

  private generateInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  private applyProfileToState(profile: any, user: any): void {
    if (!profile) return;

    const logoUrl = profile.logoImageUrl ? this.buildAssetUrl(profile.logoImageUrl) : '';
    const locationParts = [profile.city, profile.governorate, profile.country].filter(Boolean);
    const locationText = locationParts.join(', ');

    this.workshop = {
      ...this.workshop,
      id: profile.id ? String(profile.id) : this.workshop.id,
      name: profile.name || this.workshop.name,
      initials: this.generateInitials(profile.name || this.workshop.name),
      rating: profile.rating ?? 0,
      reviewCount: this.workshop.reviewCount,
      type: profile.workShopType || this.workshop.type || 'Not specified',
      location: locationText || this.workshop.location,
      verified: profile.verificationStatus === 'Verified',
      status: this.workshop.status,
      closingTime: this.workshop.closingTime,
      phone: profile.phoneNumber || this.workshop.phone || 'Not provided',
      website: profile.website || this.workshop.website || 'Not provided',
      email: user?.email || profile.email || this.workshop.email || 'Not provided',
      about: profile.description || this.workshop.about || 'No description provided yet.',
      techCount: profile.numbersOfTechnicians ?? 0,
      experience: this.workshop.experience,
      workingHours: this.workshop.workingHours,
      services: this.workshop.services,
      gallery: this.workshop.gallery,
      headerImage: this.workshop.headerImage || 'assets/images/workshop-hero.jpg',
      logoUrl
    };

    console.log('Mapped workshop data:', this.workshop);
  }

  get selectedServices(): Service[] {
    return this.workshop.services.filter(s => s.selected);
  }

  get totalEstimate(): number {
    // Use minPrice as a conservative estimate when services have a price range
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
    this.serviceForm = { name: '', description: '', duration: 30, minPrice: 0, maxPrice: 0, imageUrl: '' };
  }

  startEditService(service: Service): void {
    this.editingService = service;
    this.serviceForm = { ...service };
  }

  saveService(): void {
    // Basic validation
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
      // update existing
      this.editingService.name = String(this.serviceForm.name);
      this.editingService.description = String(this.serviceForm.description);
      this.editingService.duration = Number(this.serviceForm.duration);
      this.editingService.minPrice = min;
      this.editingService.maxPrice = max;
      this.editingService.imageUrl = String(this.serviceForm.imageUrl || '');
    } else {
      // add new
      const newService: Service = {
        id: Date.now().toString(),
        name: String(this.serviceForm.name),
        description: String(this.serviceForm.description),
        duration: Number(this.serviceForm.duration),
        minPrice: min,
        maxPrice: max,
        imageUrl: String(this.serviceForm.imageUrl || ''),
        selected: false
      };
      this.workshop.services.push(newService);
    }
    this.editingService = null;
    this.serviceForm = { name: '', description: '', duration: 30, minPrice: 0, maxPrice: 0, imageUrl: '' };
  }

  deleteService(service: Service): void {
    if (!confirm('Delete this service?')) return;
    this.workshop.services = this.workshop.services.filter(s => s.id !== service.id);
  }

  cancelEdit(): void {
    this.editingService = null;
    this.serviceForm = { name: '', description: '', duration: 30, minPrice: 0, maxPrice: 0, imageUrl: '' };
  }

  makePhoneCall(): void {
    window.location.href = `tel:${this.workshop.phone}`;
  }

  getDirections(): void {
    // Open Google Maps with the workshop location
    const encodedLocation = encodeURIComponent(this.workshop.location);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedLocation}`, '_blank');
  }

  visitWebsite(): void {
    if (this.workshop.website) {
      window.open(`https://${this.workshop.website}`, '_blank');
    }
  }

  sendEmail(): void {
    // In a real app, open email compose or contact form
    console.log('Email workshop');
  }

  bookAppointment(): void {
    if (this.selectedServiceCount === 0) {
      alert('Please select at least one service to book an appointment.');
      return;
    }
    // Navigate to booking page with selected services
    this.router.navigate(['/booking'], {
      queryParams: {
        workshopId: this.workshop.id,
        services: this.selectedServices.map(s => s.id).join(',')
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/workshops']);
  }

  editProfile(): void {
    // Pass the current workshop id to the edit route so the edit component
    // can load the correct profile immediately.
    if (this.workshop && this.workshop.id) {
      this.router.navigate(['/workshop-profile-edit'], { queryParams: { id: this.workshop.id } });
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
    const hours = this.workshop.workingHours ? this.workshop.workingHours[day] : null;
    if (!hours) return '';
    if (hours === 'closed') {
      return 'Closed';
    }
    const open = (hours as any).open || '';
    const close = (hours as any).close || '';
    return open && close ? `${open} - ${close}` : '';
  }

  isWorkingHoursClosed(day: string): boolean {
    if (!this.workshop.workingHours) return true;
    return this.workshop.workingHours[day] === 'closed';
  }
}
