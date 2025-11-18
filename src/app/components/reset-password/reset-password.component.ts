import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.css']
})
export class ResetPasswordComponent implements OnInit {
  form: FormGroup;
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  email: string | null = null;
  token: string | null = null;
  passwordFocused = false;
  showPassword = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {
    this.form = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(8)]]
    });
  }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      console.log('=== URL QUERY PARAMS ===');
      console.log('All params:', params);

      this.email = params['email'] || null;
      this.token = params['token'] || null;

      console.log('Extracted Email:', this.email);
      console.log('Extracted Token:', this.token);
      console.log('Token length:', this.token?.length);

      if (!this.email || !this.token) {
        this.errorMessage = 'Invalid reset link. Missing email or token.';
        console.error('❌ Missing email or token in URL');
      } else {
        console.log('✅ Email and token successfully extracted from URL');
      }
      this.cdr.detectChanges();
    });
  }

  hasError(fieldName: string, errorType: string): boolean {
    const field = this.form.get(fieldName);
    return !!(field && field.hasError(errorType) && (field.dirty || field.touched));
  }

  onSubmit() {
    if (!this.email || !this.token) {
      this.errorMessage = 'Invalid reset link. Missing email or token.';
      this.cdr.detectChanges();
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const payload = {
      email: this.email,
      passwordResetToken: this.token,
      newPassword: this.form.value.newPassword
    };

    console.log('=== RESET PASSWORD DEBUG ===');
    console.log('Email from URL:', this.email);
    console.log('Token from URL:', this.token);
    console.log('New Password:', this.form.value.newPassword);
    console.log('Complete Payload:', JSON.stringify(payload, null, 2));
    console.log('Endpoint:', 'https://localhost:44316/api/Account/ResetPassword');

    this.http.post('https://localhost:44316/api/Account/ResetPassword', payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    }).subscribe({
        next: (res: any) => {
          this.isLoading = false;
          console.log('✅ SUCCESS Response:', res);
          this.successMessage = res?.message || 'Password changed successfully. You can now log in.';
          this.cdr.detectChanges();

          // After short delay, navigate to login and remove token/email from URL
          setTimeout(() => {
            // Navigate to login with a success flag
            this.router.navigate(['/login'], { queryParams: { reset: 'success' } });
          }, 1600);
        },
        error: (err: any) => {
          this.isLoading = false;
          console.error('❌ ERROR Response:', err);
          console.error('Status:', err.status);
          console.error('Status Text:', err.statusText);
          console.error('Error Body:', err.error);
          console.error('Full Error Object:', JSON.stringify(err, null, 2));

          if (err?.error?.message) {
            this.errorMessage = err.error.message;
          } else if (err?.error?.errors) {
            // Handle validation errors
            const errors = err.error.errors;
            const errorMessages = Object.keys(errors).map(key => errors[key].join(', ')).join('; ');
            this.errorMessage = errorMessages || 'Validation error occurred.';
          } else if (err?.error) {
            // Try to display any error text from the response
            this.errorMessage = typeof err.error === 'string' ? err.error : JSON.stringify(err.error);
          } else if (err.status === 0) {
            this.errorMessage = 'Unable to connect to server. Please check if the backend is running.';
          } else {
            this.errorMessage = `Unable to reset password. Status: ${err.status} - ${err.statusText || 'Unknown error'}`;
          }
          this.cdr.detectChanges();
        }
      });
  }
}
