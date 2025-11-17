import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.css']
})
export class SignupComponent implements OnInit {
  signupForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  googleClientId = '27204507213-enqrb3ke4kalsgaifbhebtkfpdagmapv.apps.googleusercontent.com';
  
  roles = [
    { label: 'Carowner', value: 'CAROWNER' },
    { label: 'Workshop', value: 'WORKSHOP' }
  ];

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.signupForm = this.fb.group({
      userName: ['', [Validators.required, Validators.minLength(3), Validators.pattern(/^[a-zA-Z0-9]+$/)]],
      role: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [
        Validators.required,
        Validators.minLength(8),
        this.passwordStrengthValidator
      ]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit() {
    this.loadGoogleSdk();
  }

  // Load Google SDK
  loadGoogleSdk() {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      this.initializeGoogle();
    };
    document.head.appendChild(script);
  }

  // Initialize Google after SDK loads
  private initializeGoogle() {
    const google = (window as any).google;
    if (google && google.accounts && google.accounts.id) {
      google.accounts.id.initialize({
        client_id: this.googleClientId,
        callback: (response: any) => this.handleGoogleSignIn(response)
      });
    }
  }

  // Custom validator for password strength
  passwordStrengthValidator(control: AbstractControl): ValidationErrors | null {
    const value = control.value;
    if (!value) return null;

    const hasUpperCase = /[A-Z]/.test(value);
    const hasLowerCase = /[a-z]/.test(value);
    const hasNumber = /[0-9]/.test(value);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(value);

    const valid = hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar;

    return valid ? null : { passwordStrength: true };
  }

  // Custom validator to check if passwords match
  passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;

    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  onSubmit() {
    if (this.signupForm.invalid) {
      this.signupForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const registerData = {
      userName: this.signupForm.value.userName,
      role: this.signupForm.value.role,
      email: this.signupForm.value.email,
      password: this.signupForm.value.password,
      confirmPassword: this.signupForm.value.confirmPassword
    };

    this.http.post('https://localhost:44316/api/Account/Register', registerData)
      .subscribe({
        next: (response: any) => {
          console.log('Registration response:', response);
          this.isLoading = false;
          
          // Check if the response indicates success
          if (response.success === true || response.success === 'true') {
            this.successMessage = response.message || 'Registration successful! Please check your email to confirm your account.';
            this.signupForm.reset();
            this.cdr.detectChanges(); // Force UI update
            
            // Redirect to login after 3 seconds
            setTimeout(() => {
              this.router.navigate(['/login']);
            }, 3000);
          } else {
            // Handle unsuccessful response (success: false)
            this.isLoading = false;
            this.errorMessage = response.message || 'Registration failed. Please try again.';
            this.cdr.detectChanges(); // Force UI update
          }
        },
        error: (error: any) => {
          console.error('Registration error:', error);
          this.isLoading = false;
          
          // Check for CORS or network errors
          if (error.status === 0) {
            this.errorMessage = 'Unable to connect to server. Please check if the backend is running and CORS is configured properly.';
          } else if (error.error) {
            // Handle error response with the backend format
            if (error.error.message) {
              this.errorMessage = error.error.message;
            } else if (typeof error.error === 'string') {
              this.errorMessage = error.error;
            } else if (error.error.errors) {
              // Handle ASP.NET validation errors
              const errors = Object.values(error.error.errors).flat();
              this.errorMessage = (errors as string[]).join(' ');
            } else {
              this.errorMessage = 'Registration failed. Please check your input.';
            }
          } else {
            this.errorMessage = 'An error occurred during registration. Please try again.';
          }
          
          this.cdr.detectChanges(); // Force UI update
        }
      });
  }

  // Helper methods for template
  hasError(fieldName: string, errorType: string): boolean {
    const field = this.signupForm.get(fieldName);
    return !!(field && field.hasError(errorType) && (field.dirty || field.touched));
  }

  hasFormError(errorType: string): boolean {
    return !!(this.signupForm.hasError(errorType) && 
      (this.signupForm.get('confirmPassword')?.dirty || 
       this.signupForm.get('confirmPassword')?.touched));
  }

  // Google Sign-Up
  signUpWithGoogle() {
    // Check if role is selected
    const selectedRole = this.signupForm.get('role')?.value;
    if (!selectedRole) {
      this.errorMessage = 'Please select a role before signing up with Google';
      this.cdr.detectChanges();
      return;
    }

    // Clear previous messages
    this.errorMessage = '';
    this.successMessage = '';

    // Access Google SDK
    const google = (window as any).google;
    if (!google || !google.accounts || !google.accounts.id) {
      this.errorMessage = 'Google SDK not loaded. Please refresh the page.';
      this.cdr.detectChanges();
      return;
    }

    // Open Google Sign-In popup directly
    try {
      google.accounts.id.renderButton(
        document.createElement('div'),
        {}
      );

      // Trigger popup signin directly
      google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // If prompt unavailable, open popup manually
          this.triggerGooglePopup(google);
        }
      });
    } catch (error) {
      console.error('Error triggering Google sign-in:', error);
      this.errorMessage = 'Failed to open Google sign-in. Please try again.';
      this.cdr.detectChanges();
    }
  }

  // Trigger Google popup by creating and clicking a hidden button
  private triggerGooglePopup(google: any) {
    // Create a temporary container
    const container = document.createElement('div');
    container.id = 'google-popup-container';
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    document.body.appendChild(container);

    // Render the standard button
    google.accounts.id.renderButton(container, {
      type: 'standard',
      size: 'large',
      theme: 'outline',
      locale: 'en'
    });

    // Get the button and click it
    const button = container.querySelector('div[role="button"]') as HTMLElement;
    if (button) {
      setTimeout(() => {
        button.click();
      }, 100);
    }

    // Cleanup after a delay
    setTimeout(() => {
      const element = document.getElementById('google-popup-container');
      if (element) {
        element.remove();
      }
    }, 500);
  }

  // Handle Google Sign-In Response
  handleGoogleSignIn(response: any) {
    if (!response.credential) {
      this.errorMessage = 'Google sign-in failed. Please try again.';
      this.cdr.detectChanges();
      return;
    }

    const idToken = response.credential;
    const role = this.signupForm.get('role')?.value;

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const payload = {
      idToken: idToken,
      role: role
    };

    console.log('Sending Google login request with payload:', payload);

    this.http.post('https://localhost:44316/api/Account/Google-login', payload)
      .subscribe({
        next: (res: any) => {
          this.isLoading = false;
          console.log('Google sign-in response:', res);

          if (res.success === true || res.success === 'true') {
            this.successMessage = res.message || 'Registration successful! Redirecting to home...';
            this.cdr.detectChanges();

            // Redirect to home or dashboard after short delay
            setTimeout(() => {
              this.router.navigate(['/home']);
            }, 1600);
          } else {
            this.errorMessage = res.message || 'Google sign-in failed. Please try again.';
            this.cdr.detectChanges();
          }
        },
        error: (err: any) => {
          this.isLoading = false;
          console.error('Google sign-in error:', err);
          console.error('Error details:', err.error);

          if (err.status === 0) {
            this.errorMessage = 'Unable to connect to server. Please try again later.';
          } else if (err?.error?.message) {
            this.errorMessage = err.error.message;
          } else if (err?.error?.errors) {
            const errors = err.error.errors;
            const errorMessages = Object.keys(errors).map((key: string) => errors[key].join(', ')).join('; ');
            this.errorMessage = errorMessages || 'An error occurred during sign-in.';
          } else if (err?.error) {
            this.errorMessage = typeof err.error === 'string' ? err.error : JSON.stringify(err.error);
          } else {
            this.errorMessage = 'Google sign-in failed. Please try again.';
          }

          this.cdr.detectChanges();
        }
      });
  }
}
