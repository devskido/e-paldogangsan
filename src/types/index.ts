export interface Mall {
  id: string;
  name: string;
  url: string;
  region: string;
  tags: string[];
  featured: boolean;
  isNew: boolean;
  lastVerified: string;
  logo?: string;
}

export interface Region {
  id: string;
  name_ko: string;
  name_en: string;
  description_ko: string;
  mall_count: number;
  highlight_text: string;
}

export interface Category {
  id: string;
  name_ko: string;
  name_en: string;
  color_theme: string;
}

export interface Product {
  id: string;
  name: string;
  price: number | string;
  originalPrice?: number | string;
  image?: string;
  imageUrl?: string;
  category: string;
  // Hierarchical categories
  categoryMajor?: string;
  categoryMid?: string;
  categoryMinor?: string;
  categoryOriginal?: string;
  region: string;
  url?: string;
  productUrl?: string;
  description?: string;
  tags?: string[];
  isFeatured?: boolean;
  isNew?: boolean;
  featured?: boolean;
  // Current data structure (flat)
  mallId?: string;
  mallName?: string;
  mallUrl?: string;
  // Future structure (nested) - for compatibility
  mall?: {
    mallId: string;
    mallName: string;
    mallUrl: string;
    region: string;
  };
}

export interface ProductSyncStatus {
  mallId: string;
  mallName: string;
  lastSyncTime: string;
  productCount: number;
  status: 'success' | 'failed' | 'pending';
  errorMessage?: string;
}