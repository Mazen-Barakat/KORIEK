import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserProfile, ProfileService } from '../../services/profile.service';
import { ProfileValidationService, ValidationError } from '../profile/profile-validation.service';

@Component({
  selector: 'app-profile-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile-form.component.html',
  styleUrls: ['./profile-form.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileFormComponent implements OnInit, OnChanges {
  @Input() profile: UserProfile | null = null;
  @Input() isLoading = false;
  @Input() isSaving = false;
  @Output() onSubmit = new EventEmitter<UserProfile>();
  @Output() onImageChange = new EventEmitter<File>();

  isEditMode = false;
  validationErrors: ValidationError[] = [];
  showValidationSummary = false;

  formData: UserProfile = {
    id: 0,
    firstName: '',
    lastName: '',
    phoneNumber: '',
    country: '',
    governorate: '',
    city: '',
    profileImageUrl: null,
    preferredLanguage: 'English',
  };

  previewImage: string | null = null;
  selectedImageFile: File | null = null;
  languages = ['English', 'Arabic'];

  constructor(
    private cdr: ChangeDetectorRef,
    private profileService: ProfileService,
    private validationService: ProfileValidationService
  ) {}

  ngOnInit() {
    if (this.profile) {
      this.updateFormData(this.profile);
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['profile']) {
      console.log('Profile changed:', this.profile);
      if (this.profile) {
        this.updateFormData(this.profile);
      }
    }
  }

  /**
   * Update form data from profile, handling null and empty string values
   */
  private updateFormData(profile: UserProfile) {
    this.formData = {
      id: profile.id || 0,
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      phoneNumber: profile.phoneNumber || '',
      country: profile.country || '',
      governorate: profile.governorate || '',
      city: profile.city || '',
      profileImageUrl: profile.profileImageUrl || null,
      preferredLanguage: profile.preferredLanguage || 'English',
    };

    // Handle profile image
    if (profile.profileImageUrl && profile.profileImageUrl.trim() !== '') {
      const fullUrl = this.profileService.getFullImageUrl(profile.profileImageUrl);
      this.previewImage = fullUrl;
    } else {
      this.previewImage = null;
    }

    // Clear validation errors when loading new profile
    this.validationErrors = [];
    this.showValidationSummary = false;

    console.log('Form data updated:', this.formData);
    this.cdr.markForCheck();
  }

  onImageSelected(event: any) {
    const file: File = event.target.files[0];
    if (file) {
      // Validate image before accepting it
      const imageValidation = this.validationService.validateImageFile(file);

      if (!imageValidation.isValid) {
        // Show image validation errors
        this.validationErrors = imageValidation.errors;
        this.showValidationSummary = true;
        this.cdr.markForCheck();
        // Reset file input
        event.target.value = '';
        return;
      }

      // Clear any previous image errors
      this.clearFieldError('profileImage');

      this.selectedImageFile = file;
      this.onImageChange.emit(file);

      // Preview the image immediately
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.previewImage = e.target.result;
        console.log('Image preview loaded');
        this.cdr.markForCheck();
      };
      reader.readAsDataURL(file);
    }
  }

  /**
   * Validate a specific field on blur
   */
  validateField(fieldName: string) {
    if (!this.isEditMode) return;

    // Create a temporary object with just this field to validate
    const tempProfile = { ...this.formData };
    const validation = this.validationService.validateProfile(tempProfile, this.selectedImageFile);

    // Remove old error for this field
    this.validationErrors = this.validationErrors.filter((e) => e.field !== fieldName);

    // Add new error if exists
    const fieldError = validation.errors.find((e) => e.field === fieldName);
    if (fieldError) {
      this.validationErrors.push(fieldError);
    }

    this.cdr.markForCheck();
  }

  /**
   * Clear error for a specific field
   */
  clearFieldError(fieldName: string) {
    this.validationErrors = this.validationErrors.filter((e) => e.field !== fieldName);
    if (this.validationErrors.length === 0) {
      this.showValidationSummary = false;
    }
    this.cdr.markForCheck();
  }

  /**
   * Get error message for a specific field
   */
  getFieldError(fieldName: string): string | null {
    return this.validationService.getFieldError(this.validationErrors, fieldName);
  }

  /**
   * Submit form with validation
   */
  submitForm() {
    // Validate entire form
    const validation = this.validationService.validateProfile(
      this.formData,
      this.selectedImageFile
    );

    if (!validation.isValid) {
      this.validationErrors = validation.errors;
      this.showValidationSummary = true;
      this.cdr.markForCheck();

      // Scroll to validation summary
      setTimeout(() => {
        const summaryElement = document.querySelector('.validation-summary');
        if (summaryElement) {
          summaryElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);

      return;
    }

    // Clear validation errors and submit
    this.validationErrors = [];
    this.showValidationSummary = false;
    this.onSubmit.emit(this.formData);
    this.cdr.markForCheck();
  }

  /**
   * Toggle edit mode
   */
  toggleEditMode() {
    if (this.isEditMode) {
      // Canceling - reset form and clear errors
      if (this.profile) {
        this.updateFormData(this.profile);
      }
      this.validationErrors = [];
      this.showValidationSummary = false;
      this.selectedImageFile = null;
    }

    this.isEditMode = !this.isEditMode;
    this.cdr.markForCheck();
  }

  /**
   * Get the selected image file
   */
  getSelectedImageFile(): File | null {
    return this.selectedImageFile;
  }

  /**
   * Get the image to display
   */
  getDisplayImage(): string {
    if (this.previewImage && this.previewImage.trim() !== '') {
      return this.previewImage;
    }
    if (this.formData.profileImageUrl) {
      const fullUrl = this.profileService.getFullImageUrl(this.formData.profileImageUrl);
      if (fullUrl) {
        return fullUrl;
      }
    }
    return this.getPlaceholderImage();
  }

  /**
   * Get placeholder image URL
   */
  getPlaceholderImage(): string {
    return 'https://via.placeholder.com/180/E7F1FF/3498db?text=Profile';
  }
}
