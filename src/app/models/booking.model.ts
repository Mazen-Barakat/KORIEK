// Workshop Booking & Job Management Models

export type JobStatus = 'new' | 'upcoming' | 'in-progress' | 'ready' | 'completed' | 'cancelled';
export type ServiceStage = 'received' | 'diagnosing' | 'repairing' | 'testing' | 'done';
export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'refunded';
export type UrgencyLevel = 'low' | 'normal' | 'high' | 'urgent';

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
}

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  plateNumber: string;
  vin: string;
  color?: string;
  mileage?: number;
  imageUrl?: string;
}

export interface ServiceItem {
  id: string;
  name: string;
  description: string;
  duration: number; // in minutes
  price: number;
  quantity: number;
  total: number;
}

export interface PartItem {
  id: string;
  name: string;
  partNumber?: string;
  price: number;
  quantity: number;
  total: number;
  supplier?: string;
}

export interface MediaItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnail?: string;
  uploadedAt: Date;
  caption?: string;
  uploadedBy?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderType: 'workshop' | 'customer';
  message: string;
  timestamp: Date;
  read: boolean;
}

export interface Quote {
  id: string;
  jobId: string;
  services: ServiceItem[];
  parts: PartItem[];
  laborCost: number;
  partsCost: number;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  status: 'draft' | 'sent' | 'approved' | 'rejected' | 'revised';
  sentAt?: Date;
  approvedAt?: Date;
  notes?: string;
  validUntil?: Date;
}

export interface AdditionalRepair {
  id: string;
  jobId: string;
  title: string;
  description: string;
  media: MediaItem[];
  estimatedCost: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  respondedAt?: Date;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  jobId: string;
  quote: Quote;
  issuedAt: Date;
  dueDate: Date;
  paymentStatus: PaymentStatus;
  paidAmount: number;
  paidAt?: Date;
  paymentMethod?: string;
}

export interface Job {
  id: string;
  bookingId: string;
  customer: Customer;
  vehicle: Vehicle;
  status: JobStatus;
  stage: ServiceStage;
  urgency: UrgencyLevel;
  
  // Booking Details
  customerComplaint: string;
  requestedServices: string[];
  scheduledDate: Date;
  dropoffDate?: Date;
  pickupDate?: Date;
  estimatedCompletionDate?: Date;
  
  // Service Progress
  assignedTechnicianId?: string;
  assignedTechnicianName?: string;
  diagnosisNotes?: string;
  repairNotes?: string;
  testingNotes?: string;
  completionNotes?: string;
  
  // Media & Communication
  media: MediaItem[];
  chatMessages: ChatMessage[];
  
  // Financial
  quote?: Quote;
  additionalRepairs: AdditionalRepair[];
  invoice?: Invoice;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
}

export interface DashboardMetrics {
  monthlyRevenue: number;
  revenueChange: number; // percentage
  pendingPayouts: number;
  payoutsChange: number; // percentage
  shopRating: number;
  totalReviews: number;
  newBookingRequests: number;
  quotesAwaitingApproval: number;
  carsReadyForPickup: number;
  activeJobs: number;
}

export interface DailySchedule {
  date: Date;
  appointments: {
    time: string;
    customer: string;
    vehicle: string;
    service: string;
  }[];
}

export interface Transaction {
  id: string;
  type: 'income' | 'expense' | 'payout';
  amount: number;
  description: string;
  date: Date;
  status: 'completed' | 'pending' | 'failed';
  fee?: number;
  invoiceId?: string;
}

export interface Payout {
  id: string;
  amount: number;
  fee: number;
  netAmount: number;
  scheduledDate: Date;
  status: 'scheduled' | 'processing' | 'completed' | 'failed';
  completedDate?: Date;
  method: string;
  transactions: Transaction[];
}
