import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.component.html',
  styleUrls: ['./toast.component.css']
})
export class ToastComponent {
  message: string = '';
  type: ToastType = 'info';
  visible: boolean = false;
  private timeoutId: any;

  show(message: string, type: ToastType = 'info', duration: number = 4000): void {
    this.message = message;
    this.type = type;
    this.visible = true;

    // Clear existing timeout
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    // Auto-dismiss after duration
    this.timeoutId = setTimeout(() => {
      this.hide();
    }, duration);
  }

  hide(): void {
    this.visible = false;
    this.message = '';
  }

  getIcon(): string {
    switch (this.type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return 'ℹ';
    }
  }
}
