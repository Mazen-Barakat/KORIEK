export interface Subcategory {
  id: number;
  categoryId: number;
  name: string;
  description?: string;
  imageUrl: string;
  icon?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SubcategoryResponse {
  success: boolean;
  message: string;
  data: Subcategory[];
}
