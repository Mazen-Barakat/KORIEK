import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-profile-button',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <button
      routerLink="/profile"
      class="profile-btn"
      title="View Profile"
      aria-label="View Profile"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>
    </button>
  `,
  styles: [
    `
      .profile-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background-color: #e74c3c;
        border: none;
        cursor: pointer;
        color: white;
        transition: all 0.3s ease;
        box-shadow: 0 2px 8px rgba(231, 76, 60, 0.3);
      }

      .profile-btn:hover {
        background-color: #c0392b;
        box-shadow: 0 4px 12px rgba(231, 76, 60, 0.4);
        transform: translateY(-2px);
      }

      .profile-btn:active {
        transform: translateY(0);
      }

      svg {
        width: 20px;
        height: 20px;
      }
    `,
  ],
})
export class ProfileButtonComponent {}
