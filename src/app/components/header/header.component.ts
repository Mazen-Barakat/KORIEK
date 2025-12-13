import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ContactService } from '../../services/contact.service';
import { ProfileService } from '../../services/profile.service';
import { WorkshopProfileService } from '../../services/workshop-profile.service';
import { ProfileButtonComponent } from '../profile/profile-button.component';
import { NotificationPanelComponent } from '../notification-panel/notification-panel.component';
import { RoleHelper } from '../../models/user-roles';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    ProfileButtonComponent,
    NotificationPanelComponent,
    FormsModule,
  ],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
})
export class HeaderComponent implements OnInit, OnDestroy {
  currentLanguage = 'English';
  isAuthenticated = false;
  userName: string | null = null;
  isLandingPage = false;
  isLogoSpinning = false;
  isContactModalOpen = false;
  isWorkshopOwner = false;
  isCurrentWorkshopOwner = false;
  isAdmin = false;
  isRoleSelectionPage = false;
  isAuthFormPage = false;

  // Contact form data
  contactForm = {
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  };

  private routerSub: Subscription | null = null;
  private authSub: Subscription | null = null;
  private userSub: Subscription | null = null;
  private popStateHandler: ((ev?: PopStateEvent) => void) | null = null;
  private pageShowHandler: ((ev: PageTransitionEvent | Event) => void) | null = null;
  private _contactSub: import('rxjs').Subscription | null = null;
  // Mobile menu state
  isMobileMenuOpen = false;
  private bodyOverflowBackup: string | null = null;
  // Focus trapping for accessible mobile menu
  private keydownHandler: ((ev: KeyboardEvent) => void) | null = null;
  private mobilePanelFirstEl: HTMLElement | null = null;
  private mobilePanelLastEl: HTMLElement | null = null;
  private previouslyFocusedElement: HTMLElement | null = null;
  private mobileSetTabindex = false;

  constructor(
    private authService: AuthService,
    private profileService: ProfileService,
    private workshopProfileService: WorkshopProfileService,
    private router: Router,
    private contactService: ContactService
  ) {}

  getWorkshopProfileRoute(): string {
    const userId = this.authService.getUserId() || this.authService.getUser()?.id;
    return `/workshop-profile/${userId}`;
  }

  getLogoRoute(): string {
    // Always return the landing page route so the logo always navigates
    // to the home/landing page regardless of auth state or role.
    return '/';
  }

  ngOnInit() {
    // Subscribe to authentication state changes
    this.authSub = this.authService.isAuthenticated$.subscribe((isAuth) => {
      this.isAuthenticated = isAuth;
      // update userName when auth state changes
      if (isAuth) {
        this.userName = this.authService.getUserName();
        // Check user roles
        const role = this.authService.getUserRole();
        this.isWorkshopOwner = RoleHelper.isWorkshop(role);
        this.isAdmin = RoleHelper.isAdmin(role);
      } else {
        this.userName = null;
        this.isWorkshopOwner = false;
        this.isAdmin = false;
      }
      // When authenticated, proactively fetch the profile so the profile button
      // receives the profile image without requiring a user click.
      if (isAuth) {
        // Trigger a profile fetch. For workshop owners we also fetch the workshop profile
        // and use its LogoImageUrl if present. Otherwise fall back to the standard profile.
        if (RoleHelper.isWorkshop(this.authService.getUserRole())) {
          this.workshopProfileService.getMyWorkshopProfile().subscribe({
            next: (resp: any) => {
              const data = resp?.data ?? resp;
              const candidate = data?.LogoImageUrl || data?.logoImageUrl || data?.logoUrl || null;
              const full = this.profileService.getFullImageUrl(candidate) || null;
              this.profileService.setProfilePicture(full);
            },
            error: () => {
              // fallback to car owner profile
              this.profileService.getProfile().subscribe({ next: () => {}, error: () => {} });
            },
          });
        } else {
          // Non-workshop users: use the normal profile endpoint
          this.profileService.getProfile().subscribe({ next: () => {}, error: () => {} });
        }
      }
    });

    // Check if on landing page
    this.checkLandingPage();
    this.checkWorkshopOwnership();

    // If already authenticated on init (token persisted), fetch profile immediately
    if (this.authService.isAuthenticated()) {
      // ensure username is available on init
      this.userName = this.authService.getUserName();
      // Same logic as above when auth state is present on init
      if (RoleHelper.isWorkshop(this.authService.getUserRole())) {
        this.workshopProfileService.getMyWorkshopProfile().subscribe({
          next: (resp: any) => {
            const data = resp?.data ?? resp;
            const candidate = data?.LogoImageUrl || data?.logoImageUrl || data?.logoUrl || null;
            const full = this.profileService.getFullImageUrl(candidate) || null;
            this.profileService.setProfilePicture(full);
          },
          error: () => {
            this.profileService.getProfile().subscribe({ next: () => {}, error: () => {} });
          },
        });
      } else {
        this.profileService.getProfile().subscribe({ next: () => {}, error: () => {} });
      }
    }

    // Also subscribe to user data changes to update displayed name dynamically
    this.userSub = this.authService.currentUser$.subscribe((user) => {
      this.userName = user ? user.userName || user.name || user.fullName || user.email : null;
      // Recompute role when currentUser changes (e.g., after login/logout)
      this.checkLandingPage();
    });

    // Listen to route changes
    this.routerSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.checkLandingPage();
        // Close mobile menu on navigation
        this.closeMobileMenu();
        this.checkWorkshopOwnership();
        // Do NOT auto-animate logo on every navigation end — only animate on user click
      });

    // Fallback for browser back/forward cache and history navigation.
    // Some browsers may restore a cached page without triggering Angular
    // navigation events. Listen to popstate and pageshow to ensure header
    // recomputes visibility/role when the user navigates using browser
    // controls.
    this.popStateHandler = () => {
      // Allow router to update; schedule microtask
      setTimeout(() => this.checkLandingPage(), 0);
    };
    window.addEventListener('popstate', this.popStateHandler);

    this.pageShowHandler = (ev: any) => {
      // pageshow is fired on bfcache restore; always re-evaluate header state.
      setTimeout(() => this.checkLandingPage(), 0);
    };
    window.addEventListener('pageshow', this.pageShowHandler as EventListener);

    // Subscribe to global contact open/close events
    this._contactSub =
      this.contactService.open$?.subscribe?.((open) => {
        if (open) {
          this.openContactModal();
        }
      }) || null;

    // Keydown handler for Escape and Tab focus trap while mobile menu is open
    this.keydownHandler = (ev: KeyboardEvent) => {
      try {
        if (ev.key === 'Escape' || ev.key === 'Esc') {
          this.closeMobileMenu();
          return;
        }

        if (ev.key === 'Tab' && this.isMobileMenuOpen) {
          // simple focus trap: keep focus inside mobile panel
          const first = this.mobilePanelFirstEl;
          const last = this.mobilePanelLastEl;
          if (!first || !last) return;

          const active = document.activeElement as HTMLElement | null;
          const shift = ev.shiftKey;
          if (shift && active === first) {
            ev.preventDefault();
            last.focus();
          } else if (!shift && active === last) {
            ev.preventDefault();
            first.focus();
          }
        }
      } catch (e) {
        // ignore
      }
    };
    window.addEventListener('keydown', this.keydownHandler);
  }

  ngOnDestroy(): void {
    if (this.routerSub) {
      this.routerSub.unsubscribe();
      this.routerSub = null;
    }
    if (this.authSub) {
      this.authSub.unsubscribe();
      this.authSub = null;
    }
    if (this.userSub) {
      this.userSub.unsubscribe();
      this.userSub = null;
    }
    if (this.popStateHandler) {
      window.removeEventListener('popstate', this.popStateHandler);
      this.popStateHandler = null;
    }
    if (this.pageShowHandler) {
      window.removeEventListener('pageshow', this.pageShowHandler as EventListener);
      this.pageShowHandler = null;
    }
    if (this._contactSub) {
      this._contactSub.unsubscribe();
      this._contactSub = null;
    }
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
    // Ensure body scroll restored if left locked
    this.setBodyScrollLocked(false);
  }

  checkLandingPage() {
    this.isLandingPage = this.router.url === '/' || this.router.url === '/landing';
    this.isRoleSelectionPage = this.router.url.startsWith('/select-role');
    // Authentication-related pages where nav should hide landing-only links
    const path = this.router.url || '';
    this.isAuthFormPage =
      path.startsWith('/select-role') || path.startsWith('/signup') || path.startsWith('/login');
    // Recompute role flags on each navigation using latest stored user
    try {
      const storedUser = this.authService.getUser();
      const roleFromStored = storedUser?.roles?.length
        ? storedUser.roles[0]
        : storedUser?.role || storedUser?.roleName || '';
      this.isWorkshopOwner = !!storedUser && RoleHelper.isWorkshop(roleFromStored);
      this.isAdmin = !!storedUser && RoleHelper.isAdmin(roleFromStored);
    } catch (e) {
      // ignore and keep previous value
    }
  }

  checkWorkshopOwnership() {
    // Check if the current user is the owner of the workshop being viewed
    // This determines if "Wallet & Payments" link should be shown
    if (!this.isAuthenticated || !this.isWorkshopOwner) {
      this.isCurrentWorkshopOwner = false;
      return;
    }

    // For workshop dashboard route, always show wallet link (user viewing their own dashboard)
    const url = this.router.url;
    if (
      url.startsWith('/workshop/dashboard') ||
      url.startsWith('/workshop/job-board') ||
      url.startsWith('/workshop/wallet')
    ) {
      this.isCurrentWorkshopOwner = true;
      return;
    }

    // For workshop profile routes, check if the profile ID matches the current user ID
    const profileMatch = url.match(/\/workshop-profile\/(\d+)/);
    if (profileMatch) {
      const profileId = parseInt(profileMatch[1], 10);
      const currentUserIdStr = this.authService.getUserId();
      const currentUserId = currentUserIdStr ? parseInt(currentUserIdStr, 10) : null;
      this.isCurrentWorkshopOwner = currentUserId === profileId;
      return;
    }

    // Default: show wallet link for workshop owners on their own pages
    this.isCurrentWorkshopOwner = true;
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
      message: '',
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

  toggleMobileMenu() {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
    this.setBodyScrollLocked(this.isMobileMenuOpen);
    if (this.isMobileMenuOpen) {
      // remember focused element so we can restore focus on close
      this.previouslyFocusedElement = document.activeElement as HTMLElement | null;
      // Delay to allow panel to render
      setTimeout(() => {
        this.updateMobilePanelFocusable();
        const panel = document.querySelector('.mobile-panel') as HTMLElement | null;
        if (panel) {
          panel.focus();
        }
      }, 30);
    } else {
      this.mobilePanelFirstEl = null;
      this.mobilePanelLastEl = null;
    }
  }

  closeMobileMenu() {
    if (!this.isMobileMenuOpen) return;
    this.isMobileMenuOpen = false;
    this.setBodyScrollLocked(false);
    // restore focus to the element that had focus before opening (or hamburger)
    try {
      const hamburger = document.querySelector('.mobile-hamburger') as HTMLElement | null;
      const toFocus = this.previouslyFocusedElement || hamburger;
      if (toFocus) {
        toFocus.focus();
      }
    } catch (e) {
      // ignore
    }

    // Remove any tabindex we may have injected
    try {
      if (this.mobileSetTabindex) {
        if (this.mobilePanelFirstEl && this.mobilePanelFirstEl.getAttribute('tabindex') === '0') {
          this.mobilePanelFirstEl.removeAttribute('tabindex');
        }
        const panel = document.querySelector('.mobile-panel') as HTMLElement | null;
        if (panel && panel.getAttribute('tabindex') === '0') {
          panel.removeAttribute('tabindex');
        }
        this.mobileSetTabindex = false;
      }
    } catch (e) {
      // ignore
    }
  }

  private setBodyScrollLocked(locked: boolean) {
    try {
      const body = document && document.body;
      if (!body) return;
      if (locked) {
        // Backup current overflow so it can be restored
        this.bodyOverflowBackup = body.style.overflow || '';
        body.style.overflow = 'hidden';
      } else {
        if (this.bodyOverflowBackup !== null) {
          body.style.overflow = this.bodyOverflowBackup;
        } else {
          body.style.overflow = '';
        }
        this.bodyOverflowBackup = null;
      }
    } catch (e) {
      // ignore DOM errors in SSR or unusual hosts
    }
  }

  private updateMobilePanelFocusable() {
    try {
      const panel = document.querySelector('.mobile-panel') as HTMLElement | null;
      if (!panel) return;
      const selector =
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
      const nodes = Array.from(panel.querySelectorAll(selector)) as HTMLElement[];
      if (nodes.length) {
        this.mobilePanelFirstEl = nodes[0];
        this.mobilePanelLastEl = nodes[nodes.length - 1];
        // ensure first focusable is reachable
        // only set tabindex if not already focusable by default
        if (!this.mobilePanelFirstEl.hasAttribute('tabindex')) {
          this.mobilePanelFirstEl.setAttribute('tabindex', '0');
          this.mobileSetTabindex = true;
        }
      } else {
        this.mobilePanelFirstEl = panel;
        this.mobilePanelLastEl = panel;
        if (!panel.hasAttribute('tabindex')) {
          panel.setAttribute('tabindex', '0');
          this.mobileSetTabindex = true;
        }
      }
    } catch (e) {
      // ignore
    }
  }
}
