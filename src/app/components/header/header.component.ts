import { Component, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ProfileService } from '../../services/profile.service';
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
    private profileService: ProfileService,
    private router: Router
  ) {}

  ngOnInit() {
    // Subscribe to authentication state changes
    this.authService.isAuthenticated$.subscribe((isAuth) => {
      this.isAuthenticated = isAuth;
      // When authenticated, proactively fetch the profile so the profile button
      // receives the profile image without requiring a user click.
      if (isAuth) {
        // Trigger a profile fetch. The ProfileService tap operator will push
        // the image URL into the BehaviorSubject used by ProfileButtonComponent.
        this.profileService.getProfile().subscribe({
          next: () => {},
          error: () => {
            // Ignore profile fetch errors here; ProfileButton will show placeholder.
          }
        });
      }
    });

    // Check if on landing page
    this.checkLandingPage();

    // If already authenticated on init (token persisted), fetch profile immediately
    if (this.authService.isAuthenticated()) {
      this.profileService.getProfile().subscribe({ next: () => {}, error: () => {} });
    }

    // Listen to route changes
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.checkLandingPage();
        // Do NOT auto-animate logo on every navigation end — only animate on user click
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
    // Disabled: Prevent logo from spinning even if called.
    this.isLogoSpinning = false;
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
