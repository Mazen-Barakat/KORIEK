// notification.model.ts - Backend notification DTO matching SignalR hub messages

export enum NotificationType {
  BookingCreated = 0,
  BookingAccepted = 1,
  BookingRejected = 2,
  BookingCancelled = 3,
  BookingCompleted = 4,
  PaymentReceived = 5,
  QuoteSent = 6,
  QuoteApproved = 7,
  QuoteRejected = 8,
  JobStatusChanged = 9,
  ReviewReceived = 10,
  BookingReadyForPickup = 11,
  BookingInProgress = 12,
  AppointmentConfirmationRequest = 13,
}

export interface NotificationDto {
  id: number;
  senderId: string; // GUID string - user who triggered the notification
  receiverId: string; // GUID string - user who receives the notification
  message: string; // Notification message text
  type: NotificationType; // Enum value for notification type
  isRead: boolean; // Read status
  createdAt: string; // ISO 8601 date string
  bookingId?: number; // Optional - related booking ID
  workshopId?: number; // Optional - related workshop ID
  title?: string; // Optional - notification title
  actionUrl?: string; // Optional - URL for navigation
  actionLabel?: string; // Optional - action button text
  priority?: 'high' | 'medium' | 'low'; // Optional - priority level
  confirmationDeadline?: string; // Optional - ISO 8601 date string for confirmation deadline
}

// Appointment confirmation notification structure
export interface AppointmentConfirmationNotification {
  notificationId: number;
  bookingId: number;
  message: string;
  title: string;
  confirmationDeadline: Date;
  createdAt: Date;
  bookingDetails?: {
    customerName?: string;
    workshopName?: string;
    serviceName?: string;
    appointmentDate?: Date;
    issueDescription?: string;
  };
}
