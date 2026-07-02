import { describe, expect, it } from "vitest";
import {
  canAccessFinance,
  canManageUsers,
  isOperationsReadOnly,
} from "./permissions";

describe("permissions (RBAC arayüz yardımcıları)", () => {
  it("finans erişimi: super_admin/partner_manager/accounting", () => {
    expect(canAccessFinance("super_admin")).toBe(true);
    expect(canAccessFinance("partner_manager")).toBe(true);
    expect(canAccessFinance("accounting")).toBe(true);
    expect(canAccessFinance("operation")).toBe(false);
    expect(canAccessFinance("viewer")).toBe(false);
    expect(canAccessFinance(null)).toBe(false);
    expect(canAccessFinance(undefined)).toBe(false);
  });

  it("kullanıcı yönetimi: yalnızca super_admin", () => {
    expect(canManageUsers("super_admin")).toBe(true);
    expect(canManageUsers("partner_manager")).toBe(false);
    expect(canManageUsers("accounting")).toBe(false);
    expect(canManageUsers(null)).toBe(false);
  });

  it("operasyon salt-okur: accounting/viewer", () => {
    expect(isOperationsReadOnly("accounting")).toBe(true);
    expect(isOperationsReadOnly("viewer")).toBe(true);
    expect(isOperationsReadOnly("operation")).toBe(false);
    expect(isOperationsReadOnly("super_admin")).toBe(false);
  });
});
