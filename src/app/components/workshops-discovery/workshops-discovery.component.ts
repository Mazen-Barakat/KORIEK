import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { GeolocationService } from '../../services/geolocation.service';

interface Workshop {
  id: number;
  workshopProfileId: number;
  name: string;
  description: string;
  rating: number;
  reviewCount: number;
  distance: number;
  address: string;
  city: string;
  phone: string;
  email: string;
  logoImageUrl: string;
  coverImageUrl: string;
  isOpen: boolean;
  workShopType: string;
  services: string[];
  priceRange: string;
  latitude: number;
  longitude: number;
  verificationStatus: string;
}

interface FilterOptions {
  serviceType: string;
  rating: number;
  maxDistance: number;
  priceRange: string;
  isOpenNow: boolean;
  sortBy: string;
}

@Component({
  selector: 'app-workshops-discovery',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './workshops-discovery.component.html',
  styleUrls: ['./workshops-discovery.component.css']
})
export class WorkshopsDiscoveryComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();
  
  workshops: Workshop[] = [];
  filteredWorkshops: Workshop[] = [];
  isLoading = true;
  errorMessage = '';
  
  // User location
  userLatitude: number | null = null;
  userLongitude: number | null = null;
  locationError = '';
  
  // Search
  searchQuery = '';
  
  // Filters
  filters: FilterOptions = {
    serviceType: '',
    rating: 0,
    maxDistance: 50,
    priceRange: '',
    isOpenNow: false,
    sortBy: 'distance'
  };
  
  showFilters = false;
  
  // Available filter options
  serviceTypes = [
    { value: '', label: 'All Services' },
    { value: 'Periodic Maintenance', label: 'Periodic Maintenance' },
    { value: 'Mechanical Repairs', label: 'Mechanical Repairs' },
    { value: 'Electrical', label: 'Electrical' },
    { value: 'Body & Paint', label: 'Body & Paint' },
    { value: 'AC & Cooling', label: 'AC & Cooling' },
    { value: 'Tires', label: 'Tires' }
  ];
  
  priceRanges = [
    { value: '', label: 'Any Price' },
    { value: 'budget', label: 'Budget Friendly' },
    { value: 'moderate', label: 'Moderate' },
    { value: 'premium', label: 'Premium' }
  ];
  
  sortOptions = [
    { value: 'distance', label: 'Nearest First' },
    { value: 'rating', label: 'Highest Rated' },
    { value: 'reviewCount', label: 'Most Reviews' },
    { value: 'name', label: 'Name (A-Z)' }
  ];

  private apiUrl = 'https://localhost:44316/api';

  constructor(
    private http: HttpClient,
    private router: Router,
    private geolocationService: GeolocationService
  ) {}

  ngOnInit(): void {
    this.setupSearchDebounce();
    // Load workshops immediately without waiting for location
    this.loadWorkshops();
    // Try to get location in background (optional, for distance calculation)
    this.getUserLocationInBackground();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSearchDebounce(): void {
    this.searchSubject.pipe(
      debounceTime(150), // Fast response for better UX
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.applyFilters();
    });
  }

  onSearchInput(): void {
    this.searchSubject.next(this.searchQuery);
  }

  private getUserLocationInBackground(): void {
    // Try to get location silently in background - don't block page load
    this.geolocationService.requestLocation().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (position: any) => {
        this.userLatitude = position.latitude;
        this.userLongitude = position.longitude;
        // Recalculate distances if workshops are already loaded
        if (this.workshops.length > 0) {
          this.workshops = this.workshops.map(w => ({
            ...w,
            distance: this.calculateDistance(w.latitude, w.longitude)
          }));
          this.applyFilters();
        }
      },
      error: () => {
        // Silently ignore location errors - workshops are already shown
      }
    });
  }

  // Keep old method for manual refresh if needed
  getUserLocation(): void {
    this.getUserLocationInBackground();
  }

  loadWorkshops(): void {
    this.isLoading = true;
    this.errorMessage = '';

    // For demo purposes, use mock data directly for faster loading
    // In production, this would call the actual API
    this.loadMockWorkshops();
    
    /* Production API call - uncomment when backend is ready:
    let url = `${this.apiUrl}/Workshop/all`;
    const params: string[] = [];
    
    if (this.userLatitude && this.userLongitude) {
      params.push(`latitude=${this.userLatitude}`);
      params.push(`longitude=${this.userLongitude}`);
    }
    
    if (params.length > 0) {
      url += '?' + params.join('&');
    }

    this.http.get<any>(url).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        const workshopsData = response?.data || response || [];
        this.workshops = this.processWorkshops(workshopsData);
        this.applyFilters();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading workshops:', error);
        this.errorMessage = 'Failed to load workshops. Please try again.';
        this.isLoading = false;
        this.loadMockWorkshops();
      }
    });
    */
  }

  private processWorkshops(data: any[]): Workshop[] {
    return data.map((w: any) => ({
      id: w.id || w.workshopId,
      workshopProfileId: w.workshopProfileId || w.id,
      name: w.name || w.workshopName || 'Unknown Workshop',
      description: w.description || '',
      rating: w.rating || 0,
      reviewCount: w.reviewCount || 0,
      distance: this.calculateDistance(w.latitude, w.longitude),
      address: w.address || '',
      city: w.city || '',
      phone: w.phoneNumber || w.phone || '',
      email: w.email || '',
      logoImageUrl: w.logoImageUrl || '',
      coverImageUrl: w.coverImageUrl || w.photos?.[0] || '',
      isOpen: this.checkIsOpen(w),
      workShopType: w.workShopType || 'General',
      services: w.services || [],
      priceRange: w.priceRange || 'moderate',
      latitude: w.latitude || 0,
      longitude: w.longitude || 0,
      verificationStatus: w.verificationStatus || ''
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
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(this.userLatitude)) * Math.cos(this.deg2rad(lat)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c * 10) / 10;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }

  private checkIsOpen(workshop: any): boolean {
    // Simple check - can be enhanced with actual working hours
    const now = new Date();
    const hour = now.getHours();
    return hour >= 8 && hour < 20;
  }

  applyFilters(): void {
    let result = [...this.workshops];

    // Search filter
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      result = result.filter(w => 
        w.name.toLowerCase().includes(query) ||
        w.description.toLowerCase().includes(query) ||
        w.address.toLowerCase().includes(query) ||
        w.city.toLowerCase().includes(query) ||
        w.workShopType.toLowerCase().includes(query)
      );
    }

    // Service type filter
    if (this.filters.serviceType) {
      result = result.filter(w => 
        w.services.some(s => s.toLowerCase().includes(this.filters.serviceType.toLowerCase())) ||
        w.workShopType.toLowerCase().includes(this.filters.serviceType.toLowerCase())
      );
    }

    // Rating filter
    if (this.filters.rating > 0) {
      result = result.filter(w => w.rating >= this.filters.rating);
    }

    // Distance filter
    if (this.filters.maxDistance < 50) {
      result = result.filter(w => w.distance <= this.filters.maxDistance);
    }

    // Price range filter
    if (this.filters.priceRange) {
      result = result.filter(w => w.priceRange === this.filters.priceRange);
    }

    // Open now filter
    if (this.filters.isOpenNow) {
      result = result.filter(w => w.isOpen);
    }

    // Sort
    result.sort((a, b) => {
      switch (this.filters.sortBy) {
        case 'distance':
          return a.distance - b.distance;
        case 'rating':
          return b.rating - a.rating;
        case 'reviewCount':
          return b.reviewCount - a.reviewCount;
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    this.filteredWorkshops = result;
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  resetFilters(): void {
    this.filters = {
      serviceType: '',
      rating: 0,
      maxDistance: 50,
      priceRange: '',
      isOpenNow: false,
      sortBy: 'distance'
    };
    this.searchQuery = '';
    this.applyFilters();
  }

  viewWorkshop(workshop: Workshop): void {
    this.router.navigate(['/workshop-details', workshop.workshopProfileId]);
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

  getCoverUrl(workshop: Workshop): string {
    // Use placeholder images for demo
    const placeholderCovers: { [key: string]: string } = {
      'KOREK AutoCare Center': 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800&h=400&fit=crop',
      'Quick Fix Express': 'https://images.unsplash.com/photo-1625047509168-a7026f36de04?w=800&h=400&fit=crop',
      'Elite Auto Spa & Body Works': 'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=800&h=400&fit=crop',
      'Cool Zone AC Services': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=400&fit=crop',
      'Spark Masters Electrical': 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=800&h=400&fit=crop',
      'TirePro Center': 'https://images.unsplash.com/photo-1578844251758-2f71da64c96f?w=800&h=400&fit=crop',
      'German Auto Specialists': 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800&h=400&fit=crop',
      'Budget Auto Care': 'https://images.unsplash.com/photo-1562141992-5e09e13b6834?w=800&h=400&fit=crop',
      'Pro Detailing Studio': 'https://images.unsplash.com/photo-1507136566006-cfc505b114fc?w=800&h=400&fit=crop',
      '24/7 Emergency Auto': 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800&h=400&fit=crop',
      'Classic Car Restoration': 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&h=400&fit=crop',
      'Hybrid & EV Center': 'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=800&h=400&fit=crop'
    };

    if (placeholderCovers[workshop.name]) {
      return placeholderCovers[workshop.name];
    }

    if (workshop.coverImageUrl) {
      if (workshop.coverImageUrl.startsWith('http')) {
        return workshop.coverImageUrl;
      }
      return `https://localhost:44316${workshop.coverImageUrl}`;
    }
    return '';
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }

  formatDistance(distance: number): string {
    if (distance === 999) return 'N/A';
    if (distance < 1) return `${Math.round(distance * 1000)}m`;
    return `${distance}km`;
  }

  getStarArray(rating: number): number[] {
    return Array(5).fill(0).map((_, i) => i < Math.round(rating) ? 1 : 0);
  }

  private loadMockWorkshops(): void {
    // Instant loading - no delay for best UX
    this.workshops = [
      {
        id: 1,
        workshopProfileId: 1,
        name: 'KOREK AutoCare Center',
        description: 'Official KOREK certified workshop offering premium maintenance services. State-of-the-art equipment and factory-trained technicians ensure your vehicle receives the best care possible.',
        rating: 4.9,
        reviewCount: 342,
        distance: 1.2,
        address: 'Al-Mansour, Street 14, Building 25',
        city: 'Baghdad',
        phone: '+964 770 123 4567',
        email: 'service@korek-autocare.iq',
        logoImageUrl: '/Assets/images/workshop-logos/korek-logo.png',
        coverImageUrl: '/Assets/images/workshop-covers/korek-cover.jpg',
        isOpen: true,
        workShopType: 'Full Service',
        services: ['Periodic Maintenance', 'Oil Change', 'Brake Service', 'Engine Diagnostics', 'AC Service', 'Tire Service'],
          priceRange: 'premium',
          latitude: 33.3152,
          longitude: 44.3661,
          verificationStatus: 'Verified'
        },
        {
          id: 2,
          workshopProfileId: 2,
          name: 'Quick Fix Express',
          description: 'Fast and affordable repairs without compromising quality. Specializing in quick turnaround services for busy professionals. Walk-ins welcome!',
          rating: 4.6,
          reviewCount: 189,
          distance: 2.4,
          address: 'Karrada, Commercial District, Shop 42',
          city: 'Baghdad',
          phone: '+964 770 234 5678',
          email: 'hello@quickfixexpress.iq',
          logoImageUrl: '/Assets/images/workshop-logos/quickfix-logo.png',
          coverImageUrl: '/Assets/images/workshop-covers/quickfix-cover.jpg',
          isOpen: true,
          workShopType: 'Mechanical Repairs',
          services: ['Engine Repair', 'Transmission', 'Suspension', 'Steering', 'Exhaust System'],
          priceRange: 'budget',
          latitude: 33.2981,
          longitude: 44.4011,
          verificationStatus: 'Verified'
        },
        {
          id: 3,
          workshopProfileId: 3,
          name: 'Elite Auto Spa & Body Works',
          description: 'Luxury body shop specializing in high-end vehicles. Expert paint correction, ceramic coating, and collision repair. Insurance claims handled.',
          rating: 4.8,
          reviewCount: 127,
          distance: 3.7,
          address: 'Jadriya, University Street, Complex B',
          city: 'Baghdad',
          phone: '+964 770 345 6789',
          email: 'elite@autospa.iq',
          logoImageUrl: '/Assets/images/workshop-logos/elite-logo.png',
          coverImageUrl: '/Assets/images/workshop-covers/elite-cover.jpg',
          isOpen: true,
          workShopType: 'Body & Paint',
          services: ['Collision Repair', 'Paint Services', 'Dent Removal', 'Ceramic Coating', 'Detailing', 'Window Tinting'],
          priceRange: 'premium',
          latitude: 33.2754,
          longitude: 44.3891,
          verificationStatus: 'Verified'
        },
        {
          id: 4,
          workshopProfileId: 4,
          name: 'Cool Zone AC Services',
          description: 'Specialists in automotive air conditioning and cooling systems. We keep you cool in Baghdad\'s hot summers with expert AC repair and recharge services.',
          rating: 4.7,
          reviewCount: 98,
          distance: 4.1,
          address: 'Al-Kadhimiya, Main Road, Building 8',
          city: 'Baghdad',
          phone: '+964 770 456 7890',
          email: 'coolzone@ac-services.iq',
          logoImageUrl: '/Assets/images/workshop-logos/coolzone-logo.png',
          coverImageUrl: '/Assets/images/workshop-covers/coolzone-cover.jpg',
          isOpen: false,
          workShopType: 'AC & Cooling',
          services: ['AC Repair', 'AC Recharge', 'Radiator Service', 'Cooling System Flush', 'Heater Repair'],
          priceRange: 'moderate',
          latitude: 33.3654,
          longitude: 44.3398,
          verificationStatus: 'Verified'
        },
        {
          id: 5,
          workshopProfileId: 5,
          name: 'Spark Masters Electrical',
          description: 'Your trusted partner for all automotive electrical needs. From simple battery replacements to complex ECU diagnostics, we have you covered.',
          rating: 4.5,
          reviewCount: 156,
          distance: 2.8,
          address: 'Zayouna, Industrial Area, Unit 15',
          city: 'Baghdad',
          phone: '+964 770 567 8901',
          email: 'info@sparkmasters.iq',
          logoImageUrl: '/Assets/images/workshop-logos/spark-logo.png',
          coverImageUrl: '/Assets/images/workshop-covers/spark-cover.jpg',
          isOpen: true,
          workShopType: 'Electrical',
          services: ['Battery Service', 'Alternator Repair', 'Starter Motor', 'ECU Diagnostics', 'Wiring Repair', 'Light Installation'],
          priceRange: 'moderate',
          latitude: 33.3321,
          longitude: 44.4201,
          verificationStatus: 'Verified'
        },
        {
          id: 6,
          workshopProfileId: 6,
          name: 'TirePro Center',
          description: 'Complete tire solutions - sales, installation, balancing, and alignment. Wide selection of premium and budget tire brands available.',
          rating: 4.4,
          reviewCount: 234,
          distance: 1.8,
          address: 'Al-Dora, Highway Road, Station 3',
          city: 'Baghdad',
          phone: '+964 770 678 9012',
          email: 'sales@tirepro.iq',
          logoImageUrl: '/Assets/images/workshop-logos/tirepro-logo.png',
          coverImageUrl: '/Assets/images/workshop-covers/tirepro-cover.jpg',
          isOpen: true,
          workShopType: 'Tires',
          services: ['Tire Sales', 'Tire Installation', 'Wheel Balancing', 'Wheel Alignment', 'Flat Repair', 'Tire Rotation'],
          priceRange: 'budget',
          latitude: 33.2567,
          longitude: 44.3845,
          verificationStatus: 'Verified'
        },
        {
          id: 7,
          workshopProfileId: 7,
          name: 'German Auto Specialists',
          description: 'Exclusive service center for German vehicles - BMW, Mercedes, Audi, VW. Factory-trained technicians with genuine parts availability.',
          rating: 4.9,
          reviewCount: 87,
          distance: 6.3,
          address: 'Al-Harithiya, Premium Zone, Tower A',
          city: 'Baghdad',
          phone: '+964 770 789 0123',
          email: 'german@autospecialists.iq',
          logoImageUrl: '/Assets/images/workshop-logos/german-logo.png',
          coverImageUrl: '/Assets/images/workshop-covers/german-cover.jpg',
          isOpen: true,
          workShopType: 'Full Service',
          services: ['BMW Service', 'Mercedes Service', 'Audi Service', 'VW Service', 'Genuine Parts', 'Warranty Service'],
          priceRange: 'premium',
          latitude: 33.3087,
          longitude: 44.3512,
          verificationStatus: 'Verified'
        },
        {
          id: 8,
          workshopProfileId: 8,
          name: 'Budget Auto Care',
          description: 'Quality repairs at affordable prices. No hidden fees, transparent pricing, and honest service. Perfect for everyday maintenance needs.',
          rating: 4.2,
          reviewCount: 312,
          distance: 3.2,
          address: 'Al-Bayaa, Local Market, Shop 18',
          city: 'Baghdad',
          phone: '+964 770 890 1234',
          email: 'budget@autocare.iq',
          logoImageUrl: '/Assets/images/workshop-logos/budget-logo.png',
          coverImageUrl: '/Assets/images/workshop-covers/budget-cover.jpg',
          isOpen: true,
          workShopType: 'Mechanical Repairs',
          services: ['Basic Maintenance', 'Oil Change', 'Brake Pads', 'Filter Replacement', 'Fluid Top-up'],
          priceRange: 'budget',
          latitude: 33.2891,
          longitude: 44.4123,
          verificationStatus: 'Pending'
        },
        {
          id: 9,
          workshopProfileId: 9,
          name: 'Pro Detailing Studio',
          description: 'Professional car detailing and protection services. Interior deep cleaning, exterior polishing, and paint protection film installation.',
          rating: 4.8,
          reviewCount: 145,
          distance: 5.5,
          address: 'Mansour Mall, Parking Level B2',
          city: 'Baghdad',
          phone: '+964 770 901 2345',
          email: 'studio@prodetailing.iq',
          logoImageUrl: '/Assets/images/workshop-logos/pro-logo.png',
          coverImageUrl: '/Assets/images/workshop-covers/pro-cover.jpg',
          isOpen: false,
          workShopType: 'Body & Paint',
          services: ['Interior Detailing', 'Exterior Polishing', 'Ceramic Coating', 'PPF Installation', 'Steam Cleaning'],
          priceRange: 'premium',
          latitude: 33.3198,
          longitude: 44.3701,
          verificationStatus: 'Verified'
        },
        {
          id: 10,
          workshopProfileId: 10,
          name: '24/7 Emergency Auto',
          description: 'Round-the-clock emergency roadside assistance and towing. Available 24 hours, 7 days a week for all your urgent automotive needs.',
          rating: 4.6,
          reviewCount: 278,
          distance: 0.8,
          address: 'Palestine Street, Emergency Zone',
          city: 'Baghdad',
          phone: '+964 770 012 3456',
          email: 'emergency@247auto.iq',
          logoImageUrl: '/Assets/images/workshop-logos/247-logo.png',
          coverImageUrl: '/Assets/images/workshop-covers/247-cover.jpg',
          isOpen: true,
          workShopType: 'Full Service',
          services: ['Towing Service', 'Jump Start', 'Tire Change', 'Fuel Delivery', 'Lockout Service', 'Emergency Repair'],
          priceRange: 'moderate',
          latitude: 33.3401,
          longitude: 44.3956,
          verificationStatus: 'Verified'
        },
        {
          id: 11,
          workshopProfileId: 11,
          name: 'Classic Car Restoration',
          description: 'Specialized in vintage and classic car restoration. Bringing old beauties back to life with authentic parts and traditional craftsmanship.',
          rating: 5.0,
          reviewCount: 34,
          distance: 8.9,
          address: 'Al-Adamiya, Heritage District',
          city: 'Baghdad',
          phone: '+964 770 111 2222',
          email: 'classics@carrestoration.iq',
          logoImageUrl: '/Assets/images/workshop-logos/classic-logo.png',
          coverImageUrl: '/Assets/images/workshop-covers/classic-cover.jpg',
          isOpen: false,
          workShopType: 'Body & Paint',
          services: ['Full Restoration', 'Engine Rebuild', 'Upholstery', 'Chrome Work', 'Custom Paint'],
          priceRange: 'premium',
          latitude: 33.3756,
          longitude: 44.3421,
          verificationStatus: 'Verified'
        },
        {
          id: 12,
          workshopProfileId: 12,
          name: 'Hybrid & EV Center',
          description: 'Specialized service center for hybrid and electric vehicles. Certified technicians for Tesla, Toyota Hybrid, and other EVs.',
          rating: 4.7,
          reviewCount: 56,
          distance: 7.2,
          address: 'Green Zone, Tech Park',
          city: 'Baghdad',
          phone: '+964 770 333 4444',
          email: 'ev@hybridcenter.iq',
          logoImageUrl: '/Assets/images/workshop-logos/ev-logo.png',
          coverImageUrl: '/Assets/images/workshop-covers/ev-cover.jpg',
          isOpen: true,
          workShopType: 'Electrical',
          services: ['Battery Service', 'EV Diagnostics', 'Charging System', 'Hybrid Repair', 'Software Updates'],
          priceRange: 'premium',
          latitude: 33.2987,
          longitude: 44.3234,
          verificationStatus: 'Verified'
        }
      ];
    this.applyFilters();
    this.isLoading = false;
  }

  getActiveFilterCount(): number {
    let count = 0;
    if (this.filters.serviceType) count++;
    if (this.filters.rating > 0) count++;
    if (this.filters.maxDistance < 50) count++;
    if (this.filters.priceRange) count++;
    if (this.filters.isOpenNow) count++;
    return count;
  }
}
