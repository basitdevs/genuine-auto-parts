import type { ProductCondition, ProductStatus, SearchFacets } from "@/lib/supabase/database.types";

export type CardImage = { src: string; alt: string };

export type ProductCard = {
  id: string;
  slug: string;
  title: string;
  price: number;
  compareAtPrice: number | null;
  condition: ProductCondition;
  status: ProductStatus;
  quantity: number;
  oemPartNumber: string | null;
  placement: string | null;
  categoryIcon: string | null;
  image: CardImage | null;
};

export type MakeTile = { slug: string; name: string; count: number };

export type CategoryTile = {
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  count: number;
};

export type VehicleCard = {
  slug: string;
  stockNumber: string;
  year: number;
  make: string;
  makeSlug: string;
  model: string | null;
  modelSlug: string | null;
  trim: string | null;
  odometer: number | null;
  engine: string | null;
  transmission: string | null;
  driveType: string | null;
  color: string | null;
  image: CardImage | null;
  partsCount: number;
};

export type CatalogStats = { activeParts: number; makes: number; vehicles: number };

export type SearchResult = {
  products: ProductCard[];
  total: number;
  facets: SearchFacets;
  error: string | null;
};
