import { Component, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { ProfileButtonComponent } from '../profile/profile-button.component';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-header',
  imports: [CommonModule, RouterLink, RouterLinkActive, ProfileButtonComponent],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
})
export class HeaderComponent implements OnInit {
  currentLanguage = 'English';
  isAuthenticated = false;
  isLandingPage = false;
  isLogoSpinning = false;

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
    }, 300); // Match animation duration
  }
}
