import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'booking';
  title: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    callback: () => void;
  };
}

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private toastsSubject = new BehaviorSubject<Toast[]>([]);
  public toasts$: Observable<Toast[]> = this.toastsSubject.asObservable();

  constructor() {}

  /**
   * Show a toast notification
   */
  show(toast: Omit<Toast, 'id'>): void {
    const newToast: Toast = {
      ...toast,
      id: `toast-${Date.now()}-${Math.random()}`,
      duration: toast.duration || 5000,
    };

    const currentToasts = this.toastsSubject.value;
    this.toastsSubject.next([...currentToasts, newToast]);

    // Auto-dismiss after duration
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        this.dismiss(newToast.id);
      }, newToast.duration);
    }
  }

  /**
   * Show success toast
   */
  success(title: string, message: string, duration?: number): void {
    this.show({ type: 'success', title, message, duration });
  }

  /**
   * Show error toast
   */
  error(title: string, message: string, duration?: number): void {
    this.show({ type: 'error', title, message, duration });
  }

  /**
   * Show warning toast
   */
  warning(title: string, message: string, duration?: number): void {
    this.show({ type: 'warning', title, message, duration });
  }

  /**
   * Show info toast
   */
  info(title: string, message: string, duration?: number): void {
    this.show({ type: 'info', title, message, duration });
  }

  /**
   * Show booking notification toast (special styling)
   */
  booking(title: string, message: string, action?: { label: string; callback: () => void }): void {
    this.show({
      type: 'booking',
      title,
      message,
      duration: 8000, // Longer duration for booking notifications
      action,
    });
  }

  /**
   * Dismiss a specific toast
   */
  dismiss(toastId: string): void {
    const currentToasts = this.toastsSubject.value.filter((t) => t.id !== toastId);
    this.toastsSubject.next(currentToasts);
  }

  /**
   * Dismiss all toasts
   */
  dismissAll(): void {
    this.toastsSubject.next([]);
  }
}
