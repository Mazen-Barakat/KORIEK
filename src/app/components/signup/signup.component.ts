import { Component, ChangeDetectorRef, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, NgIf } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { DotLottie } from '@lottiefiles/dotlottie-web';

declare const google: any;

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, NgIf, ReactiveFormsModule, RouterLink],
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.css']
})
export class SignupComponent implements OnInit, AfterViewInit {
  @ViewChild('lottieCanvas') lottieCanvas!: ElementRef<HTMLCanvasElement>;
  signupForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  selectedRole: string = '';
  showCelebrationModal = false;
  showPassword = false;
  showConfirmPassword = false;
  dotLottieInstance: DotLottie | null = null;
  googleClientId = '27204507213-enqrb3ke4kalsgaifbhebtkfpdagmapv.apps.googleusercontent.com';
  passwordStrength: number = 0;
  passwordStrengthLabel: string = '';
  focusedField: string = '';
  showConfetti = false;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
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
    // Read role from query params
    this.route.queryParams.subscribe(params => {
      this.selectedRole = params['role'] || '';

      // Redirect to role selection if no role provided
      if (!this.selectedRole) {
        this.router.navigate(['/select-role']);
        return;
      }

      // Set role in form
      this.signupForm.patchValue({ role: this.selectedRole });
    });

    this.loadGoogleSdk();
  }

  ngAfterViewInit() {
    // Lottie will be initialized when celebration modal is shown
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

            // Show celebration modal with Lottie animation
            this.showCelebrationModal = true;
            this.cdr.detectChanges();

            // Initialize Lottie after modal is rendered - give more time for DOM
            setTimeout(() => {
              this.initializeLottie();
            }, 300);

            // Redirect to login after 4.5 seconds with role query param
            setTimeout(() => {
              this.router.navigate(['/login'], { queryParams: { role: this.selectedRole } });
            }, 4500);
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

  // Check if field is valid and touched
  isFieldValid(fieldName: string): boolean {
    const field = this.signupForm.get(fieldName);
    return !!(field && field.valid && (field.dirty || field.touched));
  }

  // Track focused field
  onFieldFocus(fieldName: string): void {
    this.focusedField = fieldName;
  }

  onFieldBlur(): void {
    this.focusedField = '';
  }

  // Check if field has value
  hasValue(fieldName: string): boolean {
    const field = this.signupForm.get(fieldName);
    return !!(field && field.value);
  }

  // Calculate password strength (0-100)
  calculatePasswordStrength(password: string): void {
    if (!password) {
      this.passwordStrength = 0;
      this.passwordStrengthLabel = '';
      return;
    }

    let strength = 0;
    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };

    // Length bonus
    if (password.length >= 8) strength += 20;
    if (password.length >= 12) strength += 10;
    if (password.length >= 16) strength += 10;

    // Character type bonuses
    if (checks.uppercase) strength += 15;
    if (checks.lowercase) strength += 15;
    if (checks.number) strength += 15;
    if (checks.special) strength += 15;

    this.passwordStrength = Math.min(strength, 100);

    // Set label
    if (this.passwordStrength < 30) {
      this.passwordStrengthLabel = 'Weak';
    } else if (this.passwordStrength < 60) {
      this.passwordStrengthLabel = 'Fair';
    } else if (this.passwordStrength < 80) {
      this.passwordStrengthLabel = 'Good';
    } else {
      this.passwordStrengthLabel = 'Strong';
    }
  }

  // Listen to password changes
  onPasswordChange(): void {
    const password = this.signupForm.get('password')?.value || '';
    this.calculatePasswordStrength(password);
  }

  // Navigate back to role selection
  goBack() {
    this.router.navigate(['/select-role']);
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  // Google Sign-Up
  signUpWithGoogle() {
    // Validate that role is selected
    if (!this.selectedRole) {
      this.errorMessage = 'Please select a role first';
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

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const payload = {
      idToken: idToken,
      role: this.selectedRole
    };

    console.log('Sending Google login request with payload:', payload);

    this.http.post('https://localhost:44316/api/Account/Google-login', payload)
      .subscribe({
        next: (res: any) => {
          this.isLoading = false;
          console.log('Google sign-in response:', res);

          if (res.success === true || res.success === 'true') {
            // Store the JWT token using AuthService
            if (res.data && res.data.token) {
              this.authService.saveToken(res.data.token);
            } else if (res.token) {
              this.authService.saveToken(res.token);
            }

            // Store user information using AuthService
            if (res.data) {
              this.authService.saveUser(res.data);
            } else if (res.user) {
              this.authService.saveUser(res.user);
            }

            this.successMessage = res.message || 'Registration successful! Redirecting...';

            // Show celebration modal with Lottie animation
            this.showCelebrationModal = true;
            this.cdr.detectChanges();

            // Initialize Lottie after modal is rendered - give more time for DOM
            setTimeout(() => {
              this.initializeLottie();
            }, 300);

            // Redirect to my-vehicles after 4.5 seconds
            setTimeout(() => {
              this.router.navigate(['/my-vehicles']);
            }, 4500);
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

  // Initialize Lottie animation
  initializeLottie() {
    console.log('Initializing Lottie animation...');
    console.log('Canvas element:', this.lottieCanvas?.nativeElement);

    if (this.lottieCanvas && this.lottieCanvas.nativeElement) {
      try {
        // Destroy previous instance if exists
        if (this.dotLottieInstance) {
          this.dotLottieInstance.destroy();
        }

        // Use CDN hosted Lottie for better quality
        const canvas = this.lottieCanvas.nativeElement;

        this.dotLottieInstance = new DotLottie({
          autoplay: true,
          loop: true,
          canvas: canvas,
          src: 'https://lottie.host/f76a7c1f-7519-44a3-abd6-2bb30997a0a6/eZMmDji8BX.lottie'
        });

        console.log('Lottie instance created successfully:', this.dotLottieInstance);
      } catch (error) {
        console.error('Error initializing Lottie:', error);
      }
    } else {
      console.error('Canvas element not found! Modal may not be rendered yet.');
    }
  }
}
