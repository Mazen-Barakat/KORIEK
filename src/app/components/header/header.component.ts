import { Component, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ProfileButtonComponent } from '../profile/profile-button.component';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, ProfileButtonComponent, FormsModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
})
export class HeaderComponent implements OnInit {
  currentLanguage = 'English';
  isAuthenticated = false;
  isLandingPage = false;
  isLogoSpinning = false;
  isContactModalOpen = false;
  
  // Contact form data
  contactForm = {
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  };

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    // Subscribe to authentication state changes
    this.authService.isAuthenticated$.subscribe((isAuth) => {
      this.isAuthenticated = isAuth;
    });

    // Check if on landing page
    this.checkLandingPage();

    // Listen to route changes
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.checkLandingPage();
        this.animateLogo();
      });
  }

  checkLandingPage() {
    this.isLandingPage = this.router.url === '/' || this.router.url === '/landing';
  }

  toggleLanguage() {
    // Placeholder for language toggle functionality
    this.currentLanguage = this.currentLanguage === 'English' ? 'Arabic' : 'English';
  }

  scrollToSection(sectionId: string) {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  scrollToApp() {
    this.scrollToSection('app-section');
  }

  logout() {
    this.authService.logout();
  }

  animateLogo() {
    this.isLogoSpinning = true;
    setTimeout(() => {
      this.isLogoSpinning = false;
    }, 400); // Match animation duration
  }

  openContactModal() {
    this.isContactModalOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closeContactModal() {
    this.isContactModalOpen = false;
    document.body.style.overflow = '';
    this.resetContactForm();
  }

  resetContactForm() {
    this.contactForm = {
      name: '',
      email: '',
      phone: '',
      subject: '',
      message: ''
    };
  }

  submitContactForm() {
    // TODO: Implement form submission logic
    console.log('Contact form submitted:', this.contactForm);
    
    // Show success message (placeholder)
    alert('Thank you for contacting us! We will get back to you soon.');
    
    // Close modal
    this.closeContactModal();
  }
}
