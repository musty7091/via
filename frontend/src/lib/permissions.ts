/**
 * Rol bazlı erişim (RBAC) yardımcıları.
 *
 * Gerçek güvenlik backend'de uygulanır (yetkisiz roller API'den 403 alır).
 * Buradaki kontroller arayüzü düzenlemek (yetkisiz alanları gizlemek ve
 * yönlendirmek) içindir. Backend matrisiyle aynı mantığı taşır.
 *
 * Alan yetkileri:
 *   Operasyon: super_admin/partner_manager/operation = yaz, accounting/viewer = oku
 *   Finans   : super_admin/partner_manager/accounting = yaz, diğerleri = yok
 *   Kullanıcı: super_admin = yaz, diğerleri = yok
 */

const FINANCE_ROLES = ["super_admin", "partner_manager", "accounting"];
const USER_ADMIN_ROLES = ["super_admin"];
// Operasyonu görebilen ama değiştiremeyen roller
const OPERATIONS_READONLY_ROLES = ["accounting", "viewer"];

export function canAccessFinance(role: string | undefined | null): boolean {
  return role ? FINANCE_ROLES.includes(role) : false;
}

export function canManageUsers(role: string | undefined | null): boolean {
  return role ? USER_ADMIN_ROLES.includes(role) : false;
}

/** Operasyon alanını yalnızca görüntüleyebilen (değiştiremeyen) rol mü? */
export function isOperationsReadOnly(role: string | undefined | null): boolean {
  return role ? OPERATIONS_READONLY_ROLES.includes(role) : false;
}
