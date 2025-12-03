import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';

interface WorkshopDetails {
  id: number;
  workshopProfileId: number;
  name: string;
  description: string;
  rating: number;
  reviewCount: number;
  address: string;
  city: string;
  phone: string;
  email: string;
  website?: string;
  logoImageUrl: string;
  coverImageUrl: string;
  isOpen: boolean;
  workShopType: string;
  services: string[];
  priceRange: string;
  latitude: number;
  longitude: number;
  verificationStatus: string;
  workingHours: WorkingHours[];
  gallery: string[];
  reviews: Review[];
  amenities: string[];
}

interface WorkingHours {
  day: string;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

interface Review {
  id: number;
  userName: string;
  userAvatar?: string;
  rating: number;
  comment: string;
  date: string;
  carModel?: string;
}

@Component({
  selector: 'app-workshop-details',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './workshop-details.component.html',
  styleUrl: './workshop-details.component.css'
})
export class WorkshopDetailsComponent implements OnInit, OnDestroy {
  workshop: WorkshopDetails | null = null;
  isLoading = true;
  errorMessage = '';
  activeTab: 'overview' | 'services' | 'reviews' | 'gallery' = 'overview';
  selectedImage: string | null = null;
  
  private destroy$ = new Subject<void>();
  private workshopId: number = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.workshopId = +params['id'];
      this.loadWorkshopDetails();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadWorkshopDetails(): void {
    this.isLoading = true;
    // For demo, load mock data directly
    this.loadMockWorkshopDetails();
  }

  private loadMockWorkshopDetails(): void {
    // Instant loading - no delay needed for demo
    const mockWorkshops: { [key: number]: WorkshopDetails } = {
      1: {
        id: 1,
        workshopProfileId: 1,
        name: 'KOREK AutoCare Center',
        description: 'Official KOREK certified workshop offering premium maintenance services. State-of-the-art equipment and factory-trained technicians ensure your vehicle receives the best care possible. We specialize in all types of vehicles from economy cars to luxury brands. Our commitment to quality and customer satisfaction has made us the most trusted name in automotive care in Baghdad.',
        rating: 4.9,
          reviewCount: 342,
          address: 'Al-Mansour, Street 14, Building 25',
          city: 'Baghdad',
          phone: '+964 770 123 4567',
          email: 'service@korek-autocare.iq',
          website: 'www.korek-autocare.iq',
          logoImageUrl: '',
          coverImageUrl: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=1200&h=600&fit=crop',
          isOpen: true,
          workShopType: 'Full Service',
          services: ['Periodic Maintenance', 'Oil Change', 'Brake Service', 'Engine Diagnostics', 'AC Service', 'Tire Service', 'Battery Service', 'Transmission Service'],
          priceRange: 'premium',
          latitude: 33.3152,
          longitude: 44.3661,
          verificationStatus: 'Verified',
          workingHours: [
            { day: 'Saturday', openTime: '08:00', closeTime: '20:00', isClosed: false },
            { day: 'Sunday', openTime: '08:00', closeTime: '20:00', isClosed: false },
            { day: 'Monday', openTime: '08:00', closeTime: '20:00', isClosed: false },
            { day: 'Tuesday', openTime: '08:00', closeTime: '20:00', isClosed: false },
            { day: 'Wednesday', openTime: '08:00', closeTime: '20:00', isClosed: false },
            { day: 'Thursday', openTime: '08:00', closeTime: '18:00', isClosed: false },
            { day: 'Friday', openTime: '00:00', closeTime: '00:00', isClosed: true }
          ],
          gallery: [
            'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1625047509168-a7026f36de04?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800&h=600&fit=crop'
          ],
          reviews: [
            { id: 1, userName: 'Ahmed M.', rating: 5, comment: 'Excellent service! Very professional team and great attention to detail. My car runs like new after their maintenance.', date: '2025-11-28', carModel: 'Toyota Camry 2022' },
            { id: 2, userName: 'Sara K.', rating: 5, comment: 'Best workshop in Baghdad. Fair prices and honest technicians. Highly recommended!', date: '2025-11-25', carModel: 'Honda Accord 2021' },
            { id: 3, userName: 'Omar H.', rating: 4, comment: 'Good service overall. Wait time was a bit long but the quality of work was excellent.', date: '2025-11-20', carModel: 'BMW 320i 2023' },
            { id: 4, userName: 'Fatima A.', rating: 5, comment: 'They diagnosed a problem that other workshops couldn\'t find. Very knowledgeable team!', date: '2025-11-15', carModel: 'Mercedes C200 2022' }
          ],
          amenities: ['Free WiFi', 'Waiting Lounge', 'Coffee & Refreshments', 'TV', 'Prayer Room', 'Parking', 'Card Payment', 'Pickup/Delivery']
        },
        2: {
          id: 2,
          workshopProfileId: 2,
          name: 'Quick Fix Express',
          description: 'Fast and affordable repairs without compromising quality. Specializing in quick turnaround services for busy professionals. Walk-ins welcome! We understand your time is valuable, so we focus on getting you back on the road as quickly as possible.',
          rating: 4.6,
          reviewCount: 189,
          address: 'Karrada, Commercial District, Shop 42',
          city: 'Baghdad',
          phone: '+964 770 234 5678',
          email: 'hello@quickfixexpress.iq',
          logoImageUrl: '',
          coverImageUrl: 'https://images.unsplash.com/photo-1625047509168-a7026f36de04?w=1200&h=600&fit=crop',
          isOpen: true,
          workShopType: 'Mechanical Repairs',
          services: ['Engine Repair', 'Transmission', 'Suspension', 'Steering', 'Exhaust System', 'Quick Oil Change'],
          priceRange: 'budget',
          latitude: 33.2981,
          longitude: 44.4011,
          verificationStatus: 'Verified',
          workingHours: [
            { day: 'Saturday', openTime: '07:00', closeTime: '22:00', isClosed: false },
            { day: 'Sunday', openTime: '07:00', closeTime: '22:00', isClosed: false },
            { day: 'Monday', openTime: '07:00', closeTime: '22:00', isClosed: false },
            { day: 'Tuesday', openTime: '07:00', closeTime: '22:00', isClosed: false },
            { day: 'Wednesday', openTime: '07:00', closeTime: '22:00', isClosed: false },
            { day: 'Thursday', openTime: '07:00', closeTime: '22:00', isClosed: false },
            { day: 'Friday', openTime: '14:00', closeTime: '22:00', isClosed: false }
          ],
          gallery: [
            'https://images.unsplash.com/photo-1625047509168-a7026f36de04?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1562141992-5e09e13b6834?w=800&h=600&fit=crop'
          ],
          reviews: [
            { id: 1, userName: 'Khalid S.', rating: 5, comment: 'Super fast service! I was in and out in 30 minutes for an oil change.', date: '2025-11-27', carModel: 'Kia Sportage 2020' },
            { id: 2, userName: 'Noor M.', rating: 4, comment: 'Great value for money. The team is friendly and efficient.', date: '2025-11-22' }
          ],
          amenities: ['Walk-ins Welcome', 'Quick Service', 'Affordable Prices', 'Card Payment']
        },
        3: {
          id: 3,
          workshopProfileId: 3,
          name: 'Elite Auto Spa & Body Works',
          description: 'Luxury body shop specializing in high-end vehicles. Expert paint correction, ceramic coating, and collision repair. Insurance claims handled. We treat every vehicle as if it were our own, ensuring perfection in every detail.',
          rating: 4.8,
          reviewCount: 127,
          address: 'Jadriya, University Street, Complex B',
          city: 'Baghdad',
          phone: '+964 770 345 6789',
          email: 'elite@autospa.iq',
          logoImageUrl: '',
          coverImageUrl: 'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=1200&h=600&fit=crop',
          isOpen: true,
          workShopType: 'Body & Paint',
          services: ['Collision Repair', 'Paint Services', 'Dent Removal', 'Ceramic Coating', 'Detailing', 'Window Tinting', 'PPF Installation'],
          priceRange: 'premium',
          latitude: 33.2754,
          longitude: 44.3891,
          verificationStatus: 'Verified',
          workingHours: [
            { day: 'Saturday', openTime: '09:00', closeTime: '18:00', isClosed: false },
            { day: 'Sunday', openTime: '09:00', closeTime: '18:00', isClosed: false },
            { day: 'Monday', openTime: '09:00', closeTime: '18:00', isClosed: false },
            { day: 'Tuesday', openTime: '09:00', closeTime: '18:00', isClosed: false },
            { day: 'Wednesday', openTime: '09:00', closeTime: '18:00', isClosed: false },
            { day: 'Thursday', openTime: '09:00', closeTime: '16:00', isClosed: false },
            { day: 'Friday', openTime: '00:00', closeTime: '00:00', isClosed: true }
          ],
          gallery: [
            'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1507136566006-cfc505b114fc?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&h=600&fit=crop'
          ],
          reviews: [
            { id: 1, userName: 'Mohammed R.', rating: 5, comment: 'Incredible work on my Mercedes! The paint looks better than factory new.', date: '2025-11-26', carModel: 'Mercedes S-Class 2023' },
            { id: 2, userName: 'Layla H.', rating: 5, comment: 'They fixed a major dent perfectly. You can\'t even tell it was there!', date: '2025-11-18', carModel: 'BMW X5 2022' }
          ],
          amenities: ['Premium Lounge', 'Free WiFi', 'Coffee Bar', 'Insurance Claims', 'Luxury Car Specialist']
        }
      };

      // Generate similar details for other workshop IDs
      for (let i = 4; i <= 12; i++) {
        if (!mockWorkshops[i]) {
          mockWorkshops[i] = this.generateMockWorkshop(i);
        }
      }

      this.workshop = mockWorkshops[this.workshopId] || mockWorkshops[1];
      this.isLoading = false;
  }

  private generateMockWorkshop(id: number): WorkshopDetails {
    const names: { [key: number]: string } = {
      4: 'Cool Zone AC Services',
      5: 'Spark Masters Electrical',
      6: 'TirePro Center',
      7: 'German Auto Specialists',
      8: 'Budget Auto Care',
      9: 'Pro Detailing Studio',
      10: '24/7 Emergency Auto',
      11: 'Classic Car Restoration',
      12: 'Hybrid & EV Center'
    };

    const covers: { [key: number]: string } = {
      4: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&h=600&fit=crop',
      5: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=1200&h=600&fit=crop',
      6: 'https://images.unsplash.com/photo-1578844251758-2f71da64c96f?w=1200&h=600&fit=crop',
      7: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=1200&h=600&fit=crop',
      8: 'https://images.unsplash.com/photo-1562141992-5e09e13b6834?w=1200&h=600&fit=crop',
      9: 'https://images.unsplash.com/photo-1507136566006-cfc505b114fc?w=1200&h=600&fit=crop',
      10: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=1200&h=600&fit=crop',
      11: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=1200&h=600&fit=crop',
      12: 'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=1200&h=600&fit=crop'
    };

    return {
      id: id,
      workshopProfileId: id,
      name: names[id] || `Workshop ${id}`,
      description: 'Professional automotive services with experienced technicians and quality parts.',
      rating: 4.5 + Math.random() * 0.5,
      reviewCount: 50 + Math.floor(Math.random() * 200),
      address: 'Baghdad, Iraq',
      city: 'Baghdad',
      phone: '+964 770 XXX XXXX',
      email: 'info@workshop.iq',
      logoImageUrl: '',
      coverImageUrl: covers[id] || '',
      isOpen: Math.random() > 0.3,
      workShopType: 'Full Service',
      services: ['Maintenance', 'Repairs', 'Diagnostics'],
      priceRange: 'moderate',
      latitude: 33.3,
      longitude: 44.4,
      verificationStatus: 'Verified',
      workingHours: [
        { day: 'Saturday', openTime: '08:00', closeTime: '18:00', isClosed: false },
        { day: 'Sunday', openTime: '08:00', closeTime: '18:00', isClosed: false },
        { day: 'Monday', openTime: '08:00', closeTime: '18:00', isClosed: false },
        { day: 'Tuesday', openTime: '08:00', closeTime: '18:00', isClosed: false },
        { day: 'Wednesday', openTime: '08:00', closeTime: '18:00', isClosed: false },
        { day: 'Thursday', openTime: '08:00', closeTime: '16:00', isClosed: false },
        { day: 'Friday', openTime: '00:00', closeTime: '00:00', isClosed: true }
      ],
      gallery: [covers[id] || ''],
      reviews: [
        { id: 1, userName: 'Customer', rating: 5, comment: 'Great service!', date: '2025-11-20' }
      ],
      amenities: ['Parking', 'Card Payment', 'WiFi']
    };
  }

  setActiveTab(tab: 'overview' | 'services' | 'reviews' | 'gallery'): void {
    this.activeTab = tab;
  }

  openImageModal(imageUrl: string): void {
    this.selectedImage = imageUrl;
  }

  closeImageModal(): void {
    this.selectedImage = null;
  }

  goBack(): void {
    this.router.navigate(['/workshops']);
  }

  bookService(): void {
    if (this.workshop) {
      this.router.navigate(['/booking'], { 
        queryParams: { workshopId: this.workshop.workshopProfileId }
      });
    }
  }

  callWorkshop(): void {
    if (this.workshop?.phone) {
      window.location.href = `tel:${this.workshop.phone}`;
    }
  }

  emailWorkshop(): void {
    if (this.workshop?.email) {
      window.location.href = `mailto:${this.workshop.email}`;
    }
  }

  openMaps(): void {
    if (this.workshop) {
      const url = `https://www.google.com/maps?q=${this.workshop.latitude},${this.workshop.longitude}`;
      window.open(url, '_blank');
    }
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }

  getStarArray(rating: number): number[] {
    return Array(5).fill(0).map((_, i) => i < Math.round(rating) ? 1 : 0);
  }

  getPriceLabel(priceRange: string): string {
    const labels: { [key: string]: string } = {
      'budget': '$ Budget Friendly',
      'moderate': '$$ Moderate',
      'premium': '$$$ Premium'
    };
    return labels[priceRange] || priceRange;
  }

  getTodayHours(): string {
    if (!this.workshop?.workingHours) return 'Hours not available';
    
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = days[new Date().getDay()];
    const todayHours = this.workshop.workingHours.find(h => h.day === today);
    
    if (!todayHours || todayHours.isClosed) return 'Closed today';
    return `${todayHours.openTime} - ${todayHours.closeTime}`;
  }
}
