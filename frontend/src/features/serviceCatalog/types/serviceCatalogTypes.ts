export type Currency = "TRY" | "EUR" | "GBP" | "USD";

export type ArtistService = {
  id: number;
  artist_type: string;
  name: string;
  manager_partner_id: number | null;
  default_cost_amount: number;
  default_cost_currency: Currency;
  default_sale_amount: number;
  default_sale_currency: Currency;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
};

export type ArtistCreatePayload = {
  artist_type: string;
  name: string;
  manager_partner_id?: number | null;
  default_cost_amount: number;
  default_cost_currency: Currency;
  default_sale_amount: number;
  default_sale_currency: Currency;
  notes?: string | null;
  is_active?: boolean;
};

export type ArtistUpdatePayload = Partial<ArtistCreatePayload>;

export type RiderItem = {
  id: number;
  artist_id: number;
  title: string;
  description: string | null;
  category: string | null;
  sort_order: number;
  is_required: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
};

export type RiderCreatePayload = {
  title: string;
  description?: string | null;
  category?: string | null;
  sort_order: number;
  is_required: boolean;
  is_active?: boolean;
};

export type TechnicalService = {
  id: number;
  service_type: string;
  name: string;
  default_cost_amount: number;
  default_cost_currency: Currency;
  default_sale_amount: number;
  default_sale_currency: Currency;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
};

export type TechnicalServiceCreatePayload = {
  service_type: string;
  name: string;
  default_cost_amount: number;
  default_cost_currency: Currency;
  default_sale_amount: number;
  default_sale_currency: Currency;
  notes?: string | null;
  is_active?: boolean;
};

export type TechnicalServiceUpdatePayload =
  Partial<TechnicalServiceCreatePayload>;

export type ServicePackage = {
  id: number;
  package_type: string;
  name: string;
  description: string | null;
  default_sale_amount: number;
  default_sale_currency: Currency;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
};

export type ServicePackageCreatePayload = {
  package_type: string;
  name: string;
  description?: string | null;
  default_sale_amount: number;
  default_sale_currency: Currency;
  notes?: string | null;
  is_active?: boolean;
};

export type ServicePackageUpdatePayload = Partial<ServicePackageCreatePayload>;

export type PackageItem = {
  id: number;
  package_id: number;
  component_type: string;
  artist_id: number | null;
  artist_name: string | null;
  service_item_id: number | null;
  service_item_name: string | null;
  title: string;
  program_section: string | null;
  sort_order: number;
  start_time: string | null;
  end_time: string | null;
  quantity: number;
  unit_cost_amount: number;
  unit_cost_currency: Currency;
  unit_sale_amount: number;
  unit_sale_currency: Currency;
  total_cost_amount: number;
  total_sale_amount: number;
  gross_profit_amount: number;
  is_optional: boolean;
  is_visible_on_offer: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
};

export type PackageItemCreatePayload = {
  component_type: string;
  artist_id?: number | null;
  service_item_id?: number | null;
  title?: string | null;
  program_section?: string | null;
  sort_order: number;
  start_time?: string | null;
  end_time?: string | null;
  quantity: number;
  unit_cost_amount: number;
  unit_cost_currency: Currency;
  unit_sale_amount: number;
  unit_sale_currency: Currency;
  is_optional: boolean;
  is_visible_on_offer: boolean;
  is_active?: boolean;
  notes?: string | null;
};

export type ServicePackageSummary = {
  package_id: number;
  item_count: number;
  total_cost_amount: number;
  total_sale_amount: number;
  gross_profit_amount: number;
};

export type ServicePackageDetail = {
  package: ServicePackage;
  items: PackageItem[];
  summary: ServicePackageSummary;
};