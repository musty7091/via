import {
  BarChart3,
  Briefcase,
  CalendarDays,
  ClipboardList,
  FileText,
  Handshake,
  LayoutDashboard,
  MapPin,
  Library,
  Receipt,
  ReceiptText,
  Settings,
  Users,
  ScrollText,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import type { Permission } from "@/features/auth/auth";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Menüde görünmesi için gereken yetki */
  permission?: Permission;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

/** Uygulamanın tüm menüsü. Yeni ekran eklendiğinde sadece buraya eklenir. */
export const NAVIGATION: NavSection[] = [
  { items: [{ label: "Genel Bakış", to: "/", icon: LayoutDashboard }] },
  {
    title: "Satış",
    items: [
      { label: "Teklifler", to: "/teklifler", icon: FileText, permission: "offers.view" },
      { label: "Etkinlikler", to: "/etkinlikler", icon: CalendarDays, permission: "events.view" },
      { label: "Müşteriler", to: "/musteriler", icon: Briefcase, permission: "customers.view" },
      { label: "Mekânlar", to: "/mekanlar", icon: MapPin, permission: "customers.view" },
    ],
  },
  {
    title: "Katalog & Operasyon",
    items: [
      { label: "Sanatçı ve Hizmetler", to: "/katalog", icon: Library, permission: "catalog.view" },
      { label: "Operasyon", to: "/operasyon", icon: ClipboardList, permission: "operations.view" },
    ],
  },
  {
    title: "Finans",
    items: [
      { label: "Finans Merkezi", to: "/finans", icon: Wallet, permission: "finance.view" },
      { label: "Genel Giderler", to: "/genel-giderler", icon: ReceiptText, permission: "finance.view" },
      { label: "Ortaklar", to: "/ortaklar", icon: Handshake, permission: "partners.view" },
      { label: "Raporlar", to: "/raporlar", icon: BarChart3, permission: "reports.view" },
      { label: "Kapanışlar", to: "/kapanislar", icon: Receipt, permission: "finance.view" },
    ],
  },
  {
    title: "Yönetim",
    items: [
      { label: "Kullanıcılar", to: "/kullanicilar", icon: Users, permission: "users.manage" },
      { label: "İşlem Geçmişi", to: "/islem-gecmisi", icon: ScrollText, permission: "audit.view" },
      { label: "Ayarlar", to: "/ayarlar", icon: Settings, permission: "settings.manage" },
    ],
  },
];
