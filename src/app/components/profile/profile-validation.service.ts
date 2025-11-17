// profile-validation.service.ts
import { Injectable } from '@angular/core';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

@Injectable({
  providedIn: 'root',
})
export class ProfileValidationService {
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  private readonly EGYPTIAN_PHONE_REGEX = /^(?:\+201|01)[0-2,5][0-9]{8}$/;

  validateProfile(profile: any, imageFile?: File | null): ValidationResult {
    const errors: ValidationError[] = [];

    // First Name Validation
    if (!profile.firstName || profile.firstName.trim() === '') {
      errors.push({ field: 'firstName', message: 'First name is required.' });
    } else if (profile.firstName.length > 100) {
      errors.push({ field: 'firstName', message: 'First name cannot exceed 100 characters.' });
    }

    // Last Name Validation
    if (!profile.lastName || profile.lastName.trim() === '') {
      errors.push({ field: 'lastName', message: 'Last name is required.' });
    } else if (profile.lastName.length > 100) {
      errors.push({ field: 'lastName', message: 'Last name cannot exceed 100 characters.' });
    }

    // Phone Number Validation
    if (!profile.phoneNumber || profile.phoneNumber.trim() === '') {
      errors.push({ field: 'phoneNumber', message: 'Phone number is required.' });
    } else if (!this.EGYPTIAN_PHONE_REGEX.test(profile.phoneNumber)) {
      errors.push({
        field: 'phoneNumber',
        message:
          'Phone number must be a valid Egyptian number (e.g., 01012345678 or +201012345678).',
      });
    }

    // Country Validation
    if (!profile.country || profile.country.trim() === '') {
      errors.push({ field: 'country', message: 'Country is required.' });
    } else if (profile.country.length > 100) {
      errors.push({ field: 'country', message: 'Country name cannot exceed 100 characters.' });
    }

    // Governorate Validation
    if (!profile.governorate || profile.governorate.trim() === '') {
      errors.push({ field: 'governorate', message: 'Governorate is required.' });
    } else if (profile.governorate.length > 100) {
      errors.push({
        field: 'governorate',
        message: 'Governorate name cannot exceed 100 characters.',
      });
    }

    // City Validation
    if (!profile.city || profile.city.trim() === '') {
      errors.push({ field: 'city', message: 'City is required.' });
    } else if (profile.city.length > 100) {
      errors.push({ field: 'city', message: 'City name cannot exceed 100 characters.' });
    }

    // Image File Validation (if provided)
    if (imageFile) {
      const imageValidation = this.validateImageFile(imageFile);
      if (!imageValidation.isValid) {
        errors.push(...imageValidation.errors);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  validateImageFile(file: File): ValidationResult {
    const errors: ValidationError[] = [];

    // File size validation
    if (file.size > this.MAX_FILE_SIZE) {
      errors.push({
        field: 'profileImage',
        message: `Image file size must not exceed ${this.MAX_FILE_SIZE / 1024 / 1024}MB.`,
      });
    }

    // File type validation
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!this.ALLOWED_EXTENSIONS.includes(extension)) {
      errors.push({
        field: 'profileImage',
        message: `Image file type must be one of: ${this.ALLOWED_EXTENSIONS.join(', ')}`,
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  getFieldError(errors: ValidationError[], fieldName: string): string | null {
    const error = errors.find((e) => e.field === fieldName);
    return error ? error.message : null;
  }
}
