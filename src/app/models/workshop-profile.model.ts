export interface WorkingHours {
  day: string;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

export interface WorkshopLocation {
  governorate: string;
  city: string;
  latitude: number;
  longitude: number;
  address?: string;
}

export interface WorkshopProfileData {
  id?: string;
  workshopName: string;
  workshopType: string;
  phoneNumber: string;
  technicianCount: number;
  description: string;
  workingHours: WorkingHours[];
  location: WorkshopLocation;
  galleryImages: string[];
  businessLicense?: string;
  isVerified?: boolean;
  rating?: number;
  logoUrl?: string;
}

export const WORKSHOP_TYPES = [
  'Independent',
  'MaintainanceCenter',
  'Specialized',
  'Mobile'
];

export const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

export const GOVERNORATES = [
  'Cairo',
  'Giza',
  'Alexandria',
  'Dakahlia',
  'Red Sea',
  'Beheira',
  'Fayoum',
  'Gharbia',
  'Ismailia',
  'Menofia',
  'Minya',
  'Qaliubiya',
  'New Valley',
  'Suez',
  'Aswan',
  'Assiut',
  'Beni Suef',
  'Port Said',
  'Damietta',
  'Sharkia',
  'South Sinai',
  'Kafr El Sheikh',
  'Matrouh',
  'Luxor',
  'Qena',
  'North Sinai',
  'Sohag'
];
