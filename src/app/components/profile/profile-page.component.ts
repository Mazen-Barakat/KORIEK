import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProfileService, UserProfile } from '../../services/profile.service';
import { ProfileFormComponent } from './profile-form.component';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [CommonModule, ProfileFormComponent],
  templateUrl: './profile-page.component.html',
  styleUrls: ['./profile-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePageComponent implements OnInit {
  @ViewChild('formRef') formComponent!: ProfileFormComponent;

  profile: UserProfile | null = null;
  isLoading = true;
  isSaving = false;
  error: string | null = null;
  successMessage: string | null = null;
  
  // Quick Stats
  vehicleCount: number = 0;
  bookingCount: number = 0; // Placeholder for future implementation
  loyaltyPoints: number = 0; // Placeholder for future implementation

  constructor(private profileService: ProfileService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.loadProfile();
  }

  /**
   * Load user profile from API
   */
  loadProfile() {
    this.isLoading = true;
    this.error = null;

    this.profileService.getProfile().subscribe({
      next: (response) => {
        console.log('Profile response:', response);
        if (response.success && response.data) {
          this.profile = response.data;
          console.log('Profile loaded:', this.profile);
          this.loadQuickStats();
        } else {
          this.error = response.message || 'Failed to load profile';
        }
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error loading profile:', err);
        this.error = 'Failed to load profile. Please try again.';
        this.isLoading = false;
        this.cdr.markForCheck();
      },
    });
  }
  
  /**
   * Load quick stats for profile dashboard
   */
  loadQuickStats() {
    // Import CarsService dynamically to avoid circular dependencies
    import('../../services/cars.service').then(({ CarsService }) => {
      const carsService = new (CarsService as any)(this.profileService['http']);
      
      carsService.getProfileWithCars().subscribe({
        next: (response: any) => {
          if (response.success && response.data) {
            this.vehicleCount = response.data.cars?.length || 0;
            // Future: fetch actual booking and loyalty data
            this.bookingCount = 0; // Placeholder
            this.loyaltyPoints = 150; // Placeholder
            this.cdr.markForCheck();
          }
        },
        error: (err: any) => {
          console.error('Error loading quick stats:', err);
          // Gracefully fallback to 0
          this.vehicleCount = 0;
          this.bookingCount = 0;
          this.loyaltyPoints = 0;
          this.cdr.markForCheck();
        },
      });
    });
  }

  /**
   * Handle profile update
   */
  updateProfile(updatedProfile: UserProfile) {
    this.isSaving = true;
    this.error = null;
    this.successMessage = null;

    // Get the selected image file from form component
    const imageFile = this.formComponent?.getSelectedImageFile() || undefined;

    this.profileService.updateProfile(updatedProfile, imageFile).subscribe({
      next: (response) => {
        if (response.success) {
          this.profile = response.data;
          this.successMessage = 'Profile updated successfully!';
          this.cdr.markForCheck();

          // Clear success message after 3 seconds
          setTimeout(() => {
            this.successMessage = null;
            this.cdr.markForCheck();
          }, 3000);
        } else {
          this.error = response.message || 'Failed to update profile';
          this.cdr.markForCheck();
        }
        this.isSaving = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error updating profile:', err);
        this.error = 'Failed to update profile. Please try again.';
        this.isSaving = false;
        this.cdr.markForCheck();
      },
    });
  }

  /**
   * Handle image change
   */
  handleImageChange(file: File) {
    // You can implement image upload logic here
    console.log('Image selected:', file.name);
    // For now, create a local URL for preview
    const reader = new FileReader();
    reader.onload = (e: any) => {
      if (this.profile) {
        this.profile.profileImageUrl = e.target.result;
      }
    };
    reader.readAsDataURL(file);
  }

  /**
   * Retry loading profile
   */
  retryLoadProfile() {
    this.loadProfile();
  }
}
