import * as RadixDialog from "@radix-ui/react-dialog";
import { ChevronsUpDown, KeyRound, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";

import { NAVIGATION } from "@/app/navigation";
import { useCan, useCurrentUser, useLogout } from "@/features/auth/auth";
import { ChangePasswordDialog } from "@/features/auth/ChangePasswordDialog";
import { HeaderRates } from "@/features/rates/Rates";
import { cn } from "@/shared/lib/cn";
import { formatPeriod, todayISO } from "@/shared/lib/format";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Logo,
} from "@/shared/ui";

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const can = useCan();
  const sections = NAVIGATION.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.permission || can(item.permission)),
  })).filter((section) => section.items.length > 0);

  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Ana menü">
      {sections.map((section, index) => (
        <div key={section.title ?? index}>
          {section.title && (
            <p className="mb-1.5 px-3 text-[11px] font-medium tracking-[0.16em] text-brand-300 uppercase">
              {section.title}
            </p>
          )}
          <ul className="space-y-0.5">
            {section.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === "/"}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-white/10 font-medium text-white"
                        : "text-brand-100 hover:bg-white/5 hover:text-white",
                    )
                  }
                >
                  <item.icon className="size-4 shrink-0" aria-hidden />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function UserMenu({ onChangePassword }: { onChangePassword: () => void }) {
  const user = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();

  return (
    <div className="border-t border-white/10 p-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-white/5"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-500 text-sm font-medium text-white">
              {user.full_name.charAt(0).toLocaleUpperCase("tr")}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-white">{user.full_name}</span>
              <span className="block truncate text-xs text-brand-300">{user.role_label}</span>
            </span>
            <ChevronsUpDown className="size-4 text-brand-300" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-56">
          <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem icon={<KeyRound />} onSelect={onChangePassword}>
            Şifremi değiştir
          </DropdownMenuItem>
          <DropdownMenuItem
            icon={<LogOut />}
            tone="danger"
            onSelect={() =>
              logout.mutate(undefined, { onSettled: () => navigate("/giris", { replace: true }) })
            }
          >
            Çıkış yap
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function SidebarContent({
  onNavigate,
  onChangePassword,
}: {
  onNavigate?: () => void;
  onChangePassword: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-brand-900 text-white">
      <div className="flex h-16 items-center px-6">
        <Logo />
      </div>
      <SidebarNav onNavigate={onNavigate} />
      <UserMenu onChangePassword={onChangePassword} />
    </div>
  );
}

export function AppShell() {
  const can = useCan();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const location = useLocation();
  const currentPeriod = todayISO().slice(0, 7);

  const openPassword = () => {
    setMobileOpen(false);
    setPasswordOpen(true);
  };

  return (
    <div className="min-h-dvh lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">
        <SidebarContent onChangePassword={openPassword} />
      </aside>

      <RadixDialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <RadixDialog.Portal>
          <RadixDialog.Overlay className="fixed inset-0 z-40 bg-brand-950/50 lg:hidden" />
          <RadixDialog.Content className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] lg:hidden">
            <RadixDialog.Title className="sr-only">Menü</RadixDialog.Title>
            <RadixDialog.Description className="sr-only">Uygulama menüsü</RadixDialog.Description>
            <RadixDialog.Close
              className="absolute top-4 right-3 z-10 rounded-md p-1.5 text-brand-100 hover:bg-white/10"
              aria-label="Menüyü kapat"
            >
              <X className="size-5" />
            </RadixDialog.Close>
            <SidebarContent onNavigate={() => setMobileOpen(false)} onChangePassword={openPassword} />
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>

      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur sm:px-6">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="-ml-1 rounded-md p-2 text-ink-soft hover:bg-canvas lg:hidden"
          aria-label="Menüyü aç"
        >
          <Menu className="size-5" />
        </button>
        <span className="text-brand-900 lg:hidden">
          <Logo compact />
        </span>
        <div className="ml-auto flex items-center gap-2">
          {(can("finance.view") || can("offers.view")) && <HeaderRates />}
          <span className="hidden rounded-md border border-line px-3 py-1.5 text-sm text-ink-soft sm:inline-flex">
            Aktif dönem:{" "}
            <strong className="ml-1 font-medium text-ink">{formatPeriod(currentPeriod)}</strong>
          </span>
        </div>
      </header>

      <main key={location.pathname} className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Outlet />
      </main>

      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </div>
  );
}
