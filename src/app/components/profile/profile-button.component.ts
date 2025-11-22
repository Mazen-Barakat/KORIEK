import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ProfileService } from '../../services/profile.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-profile-button',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <button
      [routerLink]="profileRoute"
      class="profile-btn"
      title="View Profile"
      aria-label="View Profile"
    >
      <img
        *ngIf="profileImageUrl"
        [src]="profileImageUrl"
        alt="Profile"
        class="profile-image"
        (error)="onImageError()"
      />
      <svg
        *ngIf="!profileImageUrl"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>
    </button>
  `,
  styles: [
    `
      .profile-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--brand-primary) 0%, #dc2626 100%);
        border: 3px solid rgba(255,255,255,0.95);
        cursor: pointer;
        color: white;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 4px 12px rgba(239, 68, 68, 0.22);
        overflow: hidden;
      }

      .profile-btn:hover {
        transform: translateY(-3px) scale(1.05);
        box-shadow: 0 8px 20px rgba(239, 68, 68, 0.32);
        border-color: rgba(255,255,255,1);
      }

      .profile-btn:active {
        transform: translateY(-1px) scale(1.02);
      }

      .profile-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 50%;
      }

      svg {
        width: 22px;
        height: 22px;
      }
    `,
  ],
})
export class ProfileButtonComponent implements OnInit {
  profileImageUrl: string | null = null;
  profileRoute: string = '/profile';

  constructor(private profileService: ProfileService, private authService: AuthService) {}

  ngOnInit() {
    // Determine profile route based on user role
    const role = this.authService.getUserRole();
    const isWorkshopOwner = role?.toLowerCase() === 'workshop' || role?.toLowerCase() === 'workshopowner';
    
    if (isWorkshopOwner) {
      const userId = this.authService.getUserId() || this.authService.getUser()?.id;
      this.profileRoute = `/workshop-profile/${userId}`;
    } else {
      this.profileRoute = '/profile';
    }

    // Subscribe to profile data changes
    this.profileService.profileData$.subscribe((profile) => {
      if (profile?.profilePicture) {
        this.profileImageUrl = profile.profilePicture;
      }
    });
  }

  onImageError() {
    this.profileImageUrl = null;
  }
}
