export type ListingSourceType = "manual" | "firecrawl";

export interface ListingLocation {
  street: string;
  city: string;
  stateOrProvince: string;
  postalCode: string;
  country: string;
}

export interface ListingDetails {
  priceUsd: number;
  bedrooms: number;
  bathrooms: number;
  squareFeet?: number;
  lotSizeSqFt?: number;
  yearBuilt?: number;
  propertyType: "single_family" | "multi_family" | "condo" | "townhouse" | "land" | "commercial";
  description: string;
}

export interface ListingMediaAsset {
  url: string;
  type: "photo" | "video" | "floor_plan" | "virtual_tour" | "document";
  caption?: string;
  tags?: string[];
}

export interface ListingRecord {
  id: string;
  agentId: string;
  title: string;
  slug: string;
  status: "draft" | "active" | "sold" | "archived";
  sourceType: ListingSourceType;
  sourceUrl?: string;
  location: ListingLocation;
  details: ListingDetails;
  media: ListingMediaAsset[];
  createdAt: string;
  updatedAt: string;
}

export interface ListingCreateInput {
  title: string;
  slug?: string;
  sourceType: ListingSourceType;
  sourceUrl?: string;
  location: ListingLocation;
  details: ListingDetails;
  media: ListingMediaAsset[];
}

export type BrandSourceType = "firecrawl" | "manual";

export interface BrandProfile {
  id: string;
  userId: string;
  companyName: string;
  website?: string;
  tagline?: string;
  voice?: string;
  primaryColorHex?: string;
  secondaryColorHex?: string;
  logoUrl?: string;
  sourceType: BrandSourceType;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BrandCreateInput {
  companyName: string;
  website?: string;
  tagline?: string;
  voice?: string;
  primaryColorHex?: string;
  secondaryColorHex?: string;
  logoUrl?: string;
  sourceType: BrandSourceType;
  notes?: string;
}

export type MediaGenerationKind =
  | "social_graphic"
  | "flyer"
  | "short_form_video"
  | "property_description"
  | "email_copy"
  | "landing_page_section";

export interface MediaGenerationRequest {
  listingId: string;
  kind: MediaGenerationKind;
  promptOverrides?: Record<string, string>;
}

export interface MediaGenerationResult {
  id: string;
  listingId: string;
  kind: MediaGenerationKind;
  assetUrl: string;
  metadata: Record<string, string | number | boolean>;
  createdAt: string;
}

export type AIGenerationStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export type AIGenerationProvider = "fal" | "runway" | "internal" | "manual";

export interface AIGenerationRecord {
  id: string;
  userId: string;
  workspaceId: string;
  listingId?: string;
  requestId?: string;
  provider: AIGenerationProvider;
  status: AIGenerationStatus;
  statusMessage?: string | null;
  mediaKey: string;
  generationParams?: Record<string, unknown> | null;
  kind: MediaGenerationKind;
  resultAssetUrl?: string | null;
  generationMethodName?: string | null;
  favorite?: boolean | null;
  tags?: string[];
  parentGenerationId?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  deletedAt?: string | null;
}

export interface AIGenerationCreateInput {
  userId: string;
  workspaceId: string;
  listingId?: string;
  requestId?: string;
  provider: AIGenerationProvider;
  mediaKey: string;
  kind: MediaGenerationKind;
  generationParams?: Record<string, unknown> | null;
  generationMethodName?: string | null;
  tags?: string[];
  parentGenerationId?: string | null;
}
