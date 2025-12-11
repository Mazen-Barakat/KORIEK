// Payment System Models

export enum StripePaymentStatus {
  Pending = 0,
  Succeeded = 1,
  Failed = 2,
  Refunded = 3
}

export enum PaymentMethod {
  Cash = 0,
  CreditCard = 1
}

export interface CreatePaymentDTO {
  bookingId: number;
  totalAmount: number;
}

export interface PaymentDTO {
  id: number;
  bookingId: number;
  totalAmount: number;
  commissionAmount: number;
  workshopAmount: number;
  commissionRate: number;
  stripePaymentStatus: string;
  stripePaymentIntentId: string;
  isPaidOut: boolean;
  payoutDate: string | null;
  payoutMethod: string | null;
  payoutReference: string | null;
  payoutNotes: string | null;
  createdAt: string;
  paidAt: string | null;
}

export interface PaymentIntentResponse {
  success: boolean;
  message: string;
  data: string; // clientSecret
}

export interface PaymentDetailsResponse {
  success: boolean;
  message: string;
  data: PaymentDTO;
}

export interface BookingWithPayment {
  id: number;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  paidAmount: number | null;
  appointmentDate: string;
  issueDescription: string;
  carId: number;
  workShopProfileId: number;
  workshopServiceId: number;
  payment?: PaymentDTO;
  serviceName?: string;
  workshopName?: string;
  totalAmount?: number;
}
