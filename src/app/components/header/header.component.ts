import { Component, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ProfileService } from '../../services/profile.service';
import { ProfileButtonComponent } from '../profile/profile-button.component';
import { NotificationPanelComponent } from '../notification-panel/notification-panel.component';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    ProfileButtonComponent,
    NotificationPanelComponent,
    FormsModule
  ],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
})
export class HeaderComponent implements OnInit {
  currentLanguage = 'English';
  isAuthenticated = false;
  userName: string | null = null;
  isLandingPage = false;
  isLogoSpinning = false;
  isContactModalOpen = false;
  isWorkshopOwner = false;
  
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

  getWorkshopProfileRoute(): string {
    const userId = this.authService.getUserId() || this.authService.getUser()?.id;
    return `/workshop-profile/${userId}`;
  }

  getLogoRoute(): string {
    if (!this.isAuthenticated) {
      return '/';
    }
    return this.isWorkshopOwner ? '/workshop/dashboard' : '/my-vehicles';
  }

  ngOnInit() {
    // Subscribe to authentication state changes
    this.authService.isAuthenticated$.subscribe((isAuth) => {
      this.isAuthenticated = isAuth;
      // update userName when auth state changes
      if (isAuth) {
        this.userName = this.authService.getUserName();
        // Check if user is workshop owner
        const role = this.authService.getUserRole();
        this.isWorkshopOwner = role?.toLowerCase() === 'workshop' || role?.toLowerCase() === 'workshopowner';
      } else {
        this.userName = null;
        this.isWorkshopOwner = false;
      }
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
      // ensure username is available on init
      this.userName = this.authService.getUserName();
      this.profileService.getProfile().subscribe({ next: () => {}, error: () => {} });
    }

    // Also subscribe to user data changes to update displayed name dynamically
    this.authService.currentUser$.subscribe(user => {
      this.userName = user ? (user.userName || user.name || user.fullName || user.email) : null;
    });

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
