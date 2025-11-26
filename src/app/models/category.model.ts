export interface Category {
  id: number;
  name: string;
  description: string;
  iconUrl: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CategoryResponse {
  success: boolean;
  message: string;
  data: Category[];
}
