import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.css'],
})
export class LandingComponent implements OnInit, OnDestroy {
  // Stats data
  stats = [
    {
      icon: 'users',
      value: '10,000+',
      label: 'Happy Customers'
    },
    {
      icon: 'certificate',
      value: '500+',
      label: 'Verified Workshops'
    },
    {
      icon: 'check-circle',
      value: '50,000+',
      label: 'Services Completed'
    },
    {
      icon: 'star',
      value: '4.8/5',
      label: 'Average Rating'
    }
  ];

  // Mission, Vision, Values
  aboutCards = [
    {
      icon: 'car',
      iconColor: '#ef4444',
      title: 'Our Mission',
      description: 'To build Egypt\'s largest trusted automotive service marketplace empowering workshops with digital tools for growth.'
    },
    {
      icon: 'shield',
      iconColor: '#1e3a5f',
      title: 'Our Vision',
      description: 'To become the go-to platform for all automotive services in Egypt, ensuring quality, transparency, and trust.'
    },
    {
      icon: 'check',
      iconColor: '#ef4444',
      title: 'Our Values',
      description: 'Transparency, reliability, and customer satisfaction are at the core of everything we do.'
    }
  ];

  // Why Choose Korek features - 4 main features
  features = [
    {
      icon: 'clock',
      title: 'Instant Booking',
      description: 'Book appointments in seconds. Choose your preferred time and workshop.',
      highlighted: false,
      iconType: 'image',
      imagePath: '/Assets/images/Instant Booking.png',
      color: '#3b82f6',
      bgColor: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)'
    },
    {
      icon: 'dollar',
      title: 'Transparent Pricing',
      description: 'No hidden fees. Get upfront quotes from multiple workshops before booking.',
      highlighted: false,
      iconType: 'image',
      imagePath: '/Assets/images/Transparent Pricing.png',
      color: '#f59e0b',
      bgColor: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)'
    },
    {
      icon: 'award',
      title: 'Quality Guarantee',
      description: 'Guaranteed workmanship on all services. Your satisfaction is our priority.',
      highlighted: true,
      iconType: 'image',
      imagePath: '/Assets/images/Quality Guarantee.png',
      color: '#10b981',
      bgColor: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)'
    },
    {
      icon: 'shield-check',
      title: 'Trusted Workshops',
      description: 'All workshops are verified and vetted. Read reviews from real customers.',
      highlighted: false,
      iconType: 'image',
      imagePath: '/Assets/images/Trusted Workshop.png',
      color: '#ef4444',
      bgColor: 'linear-gradient(135deg, #f87171 0%, #ef4444 100%)'
    }
  ];

  // Carousel state
  currentFeatureIndex = 0; // Start with first feature
  autoPlayInterval: any;
  isTransitioning = false;

  // Workshop owner benefits
  workshopBenefits = [
    'Expand your customer base with our digital platform',
    'Manage bookings and payments seamlessly',
    'Build your reputation with customer reviews',
    'Access analytics and insights to grow your business'
  ];

  // Testimonials
  testimonials = [
    {
      rating: 5,
      text: 'Korek made finding a trustworthy mechanic so easy! The transparent pricing and instant booking saved me so much time and hassle.',
      author: 'Ahmed Hassan',
      role: 'Car Owner',
      location: 'Cairo'
    },
    {
      rating: 5,
      text: 'As a workshop owner, Korek has helped me reach more customers and grow my business. The platform is easy to use and very professional.',
      author: 'Mohamed Kamal',
      role: 'Workshop Owner',
      location: 'Alexandria'
    },
    {
      rating: 5,
      text: 'Finally, a platform I can trust! The reviews helped me choose the right workshop, and the service was excellent. Highly recommended!',
      author: 'Sara El Masry',
      role: 'Car Owner',
      location: 'Giza'
    }
  ];

  // FAQ items
  faqItems = [
    {
      id: 1,
      question: 'How does Korek work?',
      answer: 'Korek connects car owners with verified workshops. Simply search for the service you need, compare prices, read reviews, and book instantly.',
      expanded: false
    },
    {
      id: 2,
      question: 'Are all workshops verified?',
      answer: 'Yes, all workshops on our platform go through a strict verification process to ensure quality and reliability.',
      expanded: false
    },
    {
      id: 3,
      question: 'How do I pay for services?',
      answer: 'You can pay securely through our platform using various payment methods including credit cards, debit cards, and mobile wallets.',
      expanded: false
    },
    {
      id: 4,
      question: 'What if I\'m not satisfied with the service?',
      answer: 'We offer a satisfaction guarantee. If you\'re not happy with the service, contact us and we\'ll work with the workshop to resolve the issue.',
      expanded: false
    },
    {
      id: 5,
      question: 'How can I register my workshop on Korek?',
      answer: 'Click the "Register Your Workshop" button, fill out the application form, and our team will review your submission within 24-48 hours.',
      expanded: false
    },
    {
      id: 6,
      question: 'Is there a mobile app available?',
      answer: 'Yes! Download the Korek app from the App Store or Google Play to book services, track appointments, and manage everything on the go.',
      expanded: false
    }
  ];

  // Toggle FAQ item
  toggleFaq(id: number): void {
    const item = this.faqItems.find(f => f.id === id);
    if (item) {
      item.expanded = !item.expanded;
    }
  }

  // Scroll to section
  scrollToSection(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // Feature carousel navigation
  nextFeature(): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this.currentFeatureIndex = (this.currentFeatureIndex + 1) % this.features.length;
    setTimeout(() => {
      this.isTransitioning = false;
    }, 500);
  }

  prevFeature(): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this.currentFeatureIndex = (this.currentFeatureIndex - 1 + this.features.length) % this.features.length;
    setTimeout(() => {
      this.isTransitioning = false;
    }, 500);
  }

  goToFeature(index: number): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this.currentFeatureIndex = index;
    
    // Animate car position based on feature index
    this.updateCarPosition();
    
    setTimeout(() => {
      this.isTransitioning = false;
    }, 500);
  }

  updateCarPosition(): void {
    const carElement = document.querySelector('.car-icon') as HTMLElement;
    if (carElement) {
      const positions = ['8%', '32%', '56%', '80%'];
      carElement.style.left = positions[this.currentFeatureIndex] || '8%';
    }
  }

  getVisibleFeatures(): any[] {
    const visible = [];
    const total = this.features.length;
    
    // Show 3 features at a time: previous, current, next
    for (let i = -1; i <= 1; i++) {
      const index = (this.currentFeatureIndex + i + total) % total;
      visible.push({
        ...this.features[index],
        position: i,
        index: index
      });
    }
    
    return visible;
  }

  getOrbitingFeatures(): any[] {
    const orbiting = [];
    const total = this.features.length;
    for (let i = 0; i < total; i++) {
      if (i !== this.currentFeatureIndex) {
        orbiting.push({...this.features[i], originalIndex: i});
      }
    }
    return orbiting;
  }

  ngOnInit(): void {
    // Start auto-play carousel
    this.startAutoPlay();
  }

  ngOnDestroy(): void {
    this.stopAutoPlay();
  }

  startAutoPlay(): void {
    this.autoPlayInterval = setInterval(() => {
      this.nextFeature();
    }, 4000); // Change every 4 seconds
  }

  stopAutoPlay(): void {
    if (this.autoPlayInterval) {
      clearInterval(this.autoPlayInterval);
    }
  }

  pauseAutoPlay(): void {
    this.stopAutoPlay();
  }

  resumeAutoPlay(): void {
    this.startAutoPlay();
  }
}
