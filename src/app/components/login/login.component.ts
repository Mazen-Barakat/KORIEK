import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, NgIf } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

declare const google: any;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, NgIf, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  selectedRole: string = '';
  showPassword = false;
  showSuccessPopup = false;
  rememberMe = false;
  focusedField: string = '';
  googleClientId = '27204507213-enqrb3ke4kalsgaifbhebtkfpdagmapv.apps.googleusercontent.com';

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      rememberMe: [false]
    });
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

      // Check for email confirmation success
      if (params['confirmed'] === 'true') {
        this.successMessage = 'Email confirmed successfully! You can now log in.';
      }
    });

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
    if (google && google.accounts && google.accounts.id) {
      google.accounts.id.initialize({
        client_id: this.googleClientId,
        callback: (response: any) => this.handleGoogleSignIn(response)
      });
    }
  }

  onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const loginData = {
      email: this.loginForm.value.email,
      password: this.loginForm.value.password
    };

    this.http.post('https://localhost:44316/api/Account/Login', loginData)
      .subscribe({
        next: (response: any) => {
          console.log('Login response:', response);
          this.isLoading = false;

          // Check if the response indicates success
          if (response.success === true || response.success === 'true') {
            // Store the token using AuthService
            if (response.data && response.data.token) {
              this.authService.saveToken(response.data.token);
            } else if (response.token) {
              this.authService.saveToken(response.token);
            }

            // Store user information using AuthService
            if (response.data) {
              this.authService.saveUser(response.data);
            } else if (response.user) {
              this.authService.saveUser(response.user);
            }

            // Handle Remember Me token storage
            this.handleRememberMe(response);

            this.successMessage = response.message || 'Login successful! Redirecting...';

            // Show success popup
            this.showSuccessPopup = true;
            this.cdr.detectChanges();

            // Redirect to my-vehicles page after 1.5 seconds
            setTimeout(() => {
              this.router.navigate(['/my-vehicles']);
            }, 1500);
          } else {
            // Handle unsuccessful response (success: false)
            this.isLoading = false;
            this.errorMessage = response.message || 'Login failed. Please try again.';
            this.cdr.detectChanges(); // Force UI update
          }
        },
        error: (error: any) => {
          console.log('Login error:', error);
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
            } else {
              this.errorMessage = 'Login failed. Please check your credentials.';
            }
          } else {
            this.errorMessage = `An error occurred during login. Please try again.`;
          }

          this.cdr.detectChanges(); // Force UI update
        }
      });
  }

  goBack() {
    this.router.navigate(['/select-role']);
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  onForgetPassword() {
    if (this.loginForm.get('email')?.invalid) {
      this.errorMessage = 'Please enter a valid email address.';
      this.cdr.detectChanges(); // Force UI update
      return;
    }

    const email = this.loginForm.get('email')?.value;
    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.http.post('https://localhost:44316/api/Account/ForgotPassword', { email })
      .subscribe({
        next: () => {
          this.isLoading = false;
          this.successMessage = 'A password reset link has been sent to your email.';
          this.cdr.detectChanges(); // Force UI update
        },
        error: (error: any) => {
          this.isLoading = false;
          if (error.error && error.error.message) {
            this.errorMessage = error.error.message;
          } else {
            this.errorMessage = 'Unable to process your request. Please try again later.';
          }
          this.cdr.detectChanges(); // Force UI update
        }
      });
  }

  // Helper method for template
  hasError(fieldName: string, errorType: string): boolean {
    const field = this.loginForm.get(fieldName);
    return !!(field && field.hasError(errorType) && (field.dirty || field.touched));
  }

  // Check if field is valid and touched
  isFieldValid(fieldName: string): boolean {
    const field = this.loginForm.get(fieldName);
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
    const field = this.loginForm.get(fieldName);
    return !!(field && field.value);
  }

  // Toggle Remember Me
  toggleRememberMe(): void {
    this.rememberMe = !this.rememberMe;
    this.loginForm.patchValue({ rememberMe: this.rememberMe });
  }

  // Handle Remember Me token storage
  private handleRememberMe(response: any): void {
    if (this.rememberMe && response.data) {
      // Store refresh token if Remember Me is enabled
      if (response.data.refreshToken) {
        localStorage.setItem('refreshToken', response.data.refreshToken);
      }
      if (response.data.userId || response.data.id) {
        localStorage.setItem('userId', response.data.userId || response.data.id);
      }
    }
  }

  // Login with Google
  loginWithGoogle() {
    // Validate that role is selected
    if (!this.selectedRole) {
      this.errorMessage = 'Please select a role first';
      this.cdr.detectChanges();
      return;
    }

    try {
      google.accounts.id.renderButton(
        document.createElement('div'),
        {}
      );

      // Trigger popup signin directly
      google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // If prompt unavailable, open popup manually
          this.triggerGooglePopup();
        }
      });
    } catch (error) {
      console.error('Error triggering Google sign-in:', error);
      this.errorMessage = 'Failed to open Google sign-in. Please try again.';
      this.cdr.detectChanges();
    }
  }

  // Trigger Google popup by creating and clicking a hidden button
  private triggerGooglePopup() {
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

            this.successMessage = res.message || 'Login successful! Redirecting...';
            this.cdr.detectChanges();

            // Redirect to my-vehicles page after short delay
            setTimeout(() => {
              this.router.navigate(['/my-vehicles']);
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
