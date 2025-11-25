import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { RoleHelper } from '../../models/user-roles';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './unauthorized.component.html',
  styleUrls: ['./unauthorized.component.css']
})
export class UnauthorizedComponent implements OnInit {
  message: string = 'You do not have permission to access this page.';
  requiredRole: string = '';
  userRole: string | null = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Get message and required role from query params
    this.route.queryParams.subscribe(params => {
      if (params['message']) {
        this.message = params['message'];
      }
      if (params['requiredRole']) {
        this.requiredRole = params['requiredRole'];
      }
    });

    // Get user's current role
    this.userRole = this.authService.getUserRole();
  }

  goBack(): void {
    // Navigate to appropriate dashboard based on user role
    const role = this.authService.getUserRole();

    if (RoleHelper.isAdmin(role)) {
      this.router.navigate(['/admin/dashboard']);
    } else if (RoleHelper.isWorkshop(role)) {
      this.router.navigate(['/workshop/dashboard']);
    } else if (RoleHelper.isCarOwner(role)) {
      this.router.navigate(['/my-vehicles']);
    } else {
      this.router.navigate(['/']);
    }
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}
