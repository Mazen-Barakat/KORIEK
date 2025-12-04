// Review Models for Post-Maintenance Feedback System

export interface Review {
  id?: number;
  rating: number; // 1-5 stars
  comment: string;
  paidAmount: number;
  createdAt: string; // ISO 8601 date string
  bookingId: number;
  carOwnerProfileId: number;
  workShopProfileId: number;
}

export interface ReviewSubmitDto {
  rating: number;
  comment: string;
  paidAmount: number;
  createdAt: string;
  bookingId: number;
  carOwnerProfileId: number;
  workShopProfileId: number;
}

export interface BookingDetails {
  id: number;
  status: string;
  appointmentDate: string;
  issueDescription: string;
  paymentMethod: string;
  paidAmount: number;
  paymentStatus: string;
  createdAt: string;
  carId: number;
  carOwnerProfileId: number;
  workShopProfileId: number;
  workshopServiceId: number;
}

export interface BookingApiResponse {
  success: boolean;
  message: string;
  data: BookingDetails;
}

export interface WorkshopDetails {
  id: number;
  workshopName: string;
  address: string;
  phoneNumber: string;
  email: string;
  description?: string;
  rating?: number;
  reviewCount?: number;
  logoUrl?: string;
}

export interface WorkshopApiResponse {
  success: boolean;
  message: string;
  data: WorkshopDetails;
}

export interface ReviewApiResponse {
  success: boolean;
  message: string;
  data?: Review;
}
