import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';
import { UnsavedChangesGuard } from './guards/unsaved-changes.guard';

export const routes: Routes = [
  // {
  //   path: '',
  //   redirectTo: '/select-role',
  //   pathMatch: 'full'
  // },
  {
    path: '',
    loadComponent: () => import('./components/landing/landing.component').then(m => m.LandingComponent)
  },
  {
    path: 'select-role',
    loadComponent: () => import('./components/role-selection/role-selection.component').then(m => m.RoleSelectionComponent)
  },
  {
    path: 'home',
    loadComponent: () => import('./components/home/home.component').then(m => m.HomeComponent),
    canActivate: [authGuard]
  },
  {
    path: 'signup',
    loadComponent: () => import('./components/signup/signup.component').then(m => m.SignupComponent)
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./components/reset-password/reset-password.component').then(m => m.ResetPasswordComponent)
  },
  {
    path: 'login',
    loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'my-vehicles',
    loadComponent: () => import('./components/my-vehicles/my-vehicles.component').then(m => m.MyVehiclesComponent),
    canActivate: [authGuard]
  },
  {
    path: 'add-vehicle',
    loadComponent: () => import('./components/add-vehicle-form/add-vehicle-form.component').then(m => m.AddVehicleFormComponent),
    canActivate: [authGuard]
  },
  {
    path: 'profile',
    loadComponent: () => import('./components/profile/profile-page.component').then((m) => m.ProfilePageComponent),
    canActivate: [authGuard],
  },
  {
    path: 'car-details/:id',
    loadComponent: () => import('./components/car-details/car-details.component').then(m => m.CarDetailsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'edit-car/:id',
    loadComponent: () => import('./components/edit-car/edit-car.component').then(m => m.EditCarComponent),
    canActivate: [authGuard]
  },
  {
    path: 'booking',
    loadComponent: () => import('./components/booking/booking.component').then(m => m.BookingComponent),
    canActivate: [authGuard]
  },
  {
    path: 'workshops',
    loadComponent: () => import('./components/workshops-discovery/workshops-discovery.component').then(m => m.WorkshopsDiscoveryComponent),
    canActivate: [authGuard]
  },
  {
    path: 'workshop-details/:id',
    loadComponent: () => import('./components/workshop-details/workshop-details.component').then(m => m.WorkshopDetailsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'workshop-profile/:id',
    loadComponent: () => import('./components/workshop-profile/workshop-profile.component').then(m => m.WorkshopProfileComponent),
    canActivate: [authGuard]
  },
  {
    path: 'workshop-profile-edit',
    loadComponent: () => import('./components/workshop-profile-edit/workshop-profile-edit.component').then(m => m.WorkshopProfileEditComponent),
    canActivate: [authGuard],
    canDeactivate: [UnsavedChangesGuard]
  },
  {
    path: 'workshop/dashboard',
    loadComponent: () => import('./components/workshop-dashboard/workshop-dashboard.component').then(m => m.WorkshopDashboardComponent),
    canActivate: [authGuard]
  },
  {
    path: 'workshop/job-board',
    loadComponent: () => import('./components/job-board/job-board.component').then(m => m.JobBoardComponent),
    canActivate: [authGuard]
  },
  {
    path: 'workshop/wallet',
    loadComponent: () => import('./components/wallet/wallet.component').then(m => m.WalletComponent),
    canActivate: [authGuard]
  },
  {

    path: 'admin/dashboard',
    loadComponent: () => import('./components/admin-dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent),
    canActivate: [authGuard, adminGuard]
  },
  {
    path: 'unauthorized',
    loadComponent: () => import('./components/unauthorized/unauthorized.component').then(m => m.UnauthorizedComponent)
  },
];
