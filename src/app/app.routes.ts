import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

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
    path: 'workshop-profile/:id',
    loadComponent: () => import('./components/workshop-profile/workshop-profile.component').then(m => m.WorkshopProfileComponent),
    canActivate: [authGuard]
  },
  {
    path: 'workshop-profile-edit',
    loadComponent: () => import('./components/workshop-profile-edit/workshop-profile-edit.component').then(m => m.WorkshopProfileEditComponent),
    canActivate: [authGuard]
  },
];
