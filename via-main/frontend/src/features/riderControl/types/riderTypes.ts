export type RiderCheckStatus = "pending" | "done" | "problem";

export type RiderCheck = {
  id: number;
  event_id: number;
  artist_id: number | null;
  artist_name: string | null;
  template_item_id: number | null;
  checked_by_user_id: number | null;
  checked_by_name: string | null;
  title: string;
  description: string | null;
  category: string | null;
  status: RiderCheckStatus;
  checked_at: string | null;
  problem_note: string | null;
  sort_order: number;
  is_required: boolean;
  created_at: string;
  updated_at: string | null;
};

export type RiderCheckSummary = {
  total: number;
  done: number;
  problem: number;
  pending: number;
  required_total: number;
  required_done: number;
  all_required_done: boolean;
};

export type EventRiderArtist = {
  artist_id: number;
  artist_name: string;
  template_item_count: number;
};

export type RiderCheckBoard = {
  event_id: number;
  event_title: string;
  event_date: string | null;
  summary: RiderCheckSummary;
  artists: EventRiderArtist[];
  items: RiderCheck[];
};

export type GenerateResult = {
  created_count: number;
  skipped_count: number;
  board: RiderCheckBoard;
};

export type RiderCheckCreatePayload = {
  title: string;
  description?: string | null;
  artist_id?: number | null;
  is_required?: boolean;
};

export type RiderCheckUpdatePayload = {
  status?: RiderCheckStatus;
  problem_note?: string | null;
  title?: string;
  description?: string | null;
  is_required?: boolean;
};

export type EventOption = {
  id: number;
  title: string;
  event_date: string;
  status: string;
};
