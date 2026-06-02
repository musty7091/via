export type Partner = {
  id: number;
  user_id: number | null;
  full_name: string;
  ownership_percent: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
};

export type PartnerCreatePayload = {
  full_name: string;
  ownership_percent: number;
  is_active: boolean;
  notes?: string | null;
};

export type PartnerUpdatePayload = Partial<PartnerCreatePayload>;
