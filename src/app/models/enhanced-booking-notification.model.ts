// Enhanced Booking Notification Model with Complete Details

export interface EnhancedBookingNotification {
  id: number;
  bookingId: number;
  bookingReference: string; // e.g., "BK-2025-001234"
  
  // Customer Information
  customerName: string;
  customerPhone: string;
  customerPhoto?: string;
  
  // Vehicle Information
  vehicleInfo: string; // e.g., "2023 Toyota Corolla - ABC 1234"
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  vehiclePlateNumber: string;
  
  // Service Information
  serviceType: string; // e.g., "Oil Change + Brake Inspection"
  serviceList: string[]; // ["Oil Change", "Brake Inspection"]
  estimatedDuration: number; // minutes
  estimatedCost: number;
  
  // Timing Information
  exactAppointmentTime: Date; // Precise to the second
  appointmentTimeSeconds: number; // Unix timestamp
  createdAt: Date;
  
  // Workshop Information (for customer notifications)
  workshopName?: string;
  workshopAddress?: string;
  workshopPhone?: string;
  
  // Response Status
  responseStatus: number | BookingResponseStatus; // Backend sends as number (0,1,2,3,4)
  canChangeResponse: boolean;
  lastResponseChangedAt?: Date;
  responseChangedBy?: string;
  
  // Job Status (to prevent showing dialog for in-progress bookings)
  jobStatus?: string; // 'new', 'upcoming', 'in-progress', 'ready', 'completed', 'cancelled'
  status?: string; // Backend booking status: 'Pending', 'Confirmed', 'InProgress', etc.
  
  // Confirmation Status (for appointment arrival)
  carOwnerConfirmed?: boolean | null;
  workshopConfirmed?: boolean | null;
  hasCurrentUserConfirmed?: boolean; // Whether the current logged-in user has confirmed
  bothConfirmed?: boolean;
  confirmationSentAt?: Date;
  confirmationDeadline?: Date;
  
  // Notification Metadata
  notificationType: NotificationType;
  priority: 'high' | 'medium' | 'low';
  isRead: boolean;
  
  // Time-based Logic
  timeUntilAppointment: number; // seconds
  hasAppointmentTimePassed: boolean;
  shouldShowConfirmationModal: boolean;
}

export enum BookingResponseStatus {
  Pending = 0,
  Accepted = 1,
  Declined = 2,
  Confirmed = 3, // Both parties confirmed arrival
  Expired = 4
}

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
  ResponseStatusChanged = 14 // New type for response changes
}

// Helper to generate booking reference
export function generateBookingReference(bookingId: number): string {
  const year = new Date().getFullYear();
  const paddedId = bookingId.toString().padStart(6, '0');
  return `BK-${year}-${paddedId}`;
}

// Helper to format vehicle info
export function formatVehicleInfo(make: string, model: string, year: number, plate: string): string {
  return `${year} ${make} ${model} - ${plate}`;
}

// Helper to check if response can be changed
export function canChangeBookingResponse(
  responseStatus: BookingResponseStatus,
  appointmentTime: Date,
  currentUserRole: 'workshop' | 'customer'
): boolean {
  const now = new Date();
  const hasTimeArrived = appointmentTime <= now;
  
  // Cannot change after appointment time
  if (hasTimeArrived) return false;
  
  // Cannot change if already confirmed by both parties
  if (responseStatus === BookingResponseStatus.Confirmed) return false;
  
  // Cannot change if expired
  if (responseStatus === BookingResponseStatus.Expired) return false;
  
  // Acceptance is final (cannot change from Accepted to Declined)
  if (responseStatus === BookingResponseStatus.Accepted) return false;
  
  // Can change from Pending to Accepted/Declined
  // Can change from Declined to Accepted
  return true;
}

// Helper to determine button text
export function getResponseButtonText(currentStatus: BookingResponseStatus): {
  acceptText: string;
  declineText: string;
} {
  switch (currentStatus) {
    case BookingResponseStatus.Pending:
      return { acceptText: 'Accept', declineText: 'Close' };
    case BookingResponseStatus.Declined:
      return { acceptText: 'Accept Instead', declineText: 'Keep Closed' };
    case BookingResponseStatus.Accepted:
      return { acceptText: 'Accepted ✓', declineText: '' };
    case BookingResponseStatus.Confirmed:
      return { acceptText: 'Confirmed ✓', declineText: '' };
    default:
      return { acceptText: 'Accept', declineText: 'Close' };
  }
}
