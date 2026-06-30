export type ManagedUser = {
  id: number;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
};

export type ManagedUserCreatePayload = {
  full_name: string;
  email: string;
  password: string;
  role: string;
  is_active: boolean;
};

export type ManagedUserUpdatePayload = {
  full_name?: string;
  email?: string;
  role?: string;
  is_active?: boolean;
};

export type ManagedUserPasswordResetPayload = {
  new_password: string;
};
