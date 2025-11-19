import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-role-selection',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './role-selection.component.html',
  styleUrls: ['./role-selection.component.css']
})
export class RoleSelectionComponent {
  constructor(private router: Router) {}

  selectRoleAndLogin(role: string) {
    this.router.navigate(['/login'], { queryParams: { role: role } });
  }

  selectRoleAndSignup(role: string) {
    this.router.navigate(['/signup'], { queryParams: { role: role } });
  }
}
