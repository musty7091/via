import { KeyRound, MoreHorizontal, Pencil, Plus, Power, Users } from "lucide-react";
import { useState } from "react";

import { useCurrentUser } from "@/features/auth/auth";
import {
  PAGE_SIZE,
  useUpdateUser,
  useUsers,
  type User,
  type UserFilters,
} from "@/features/users/api";
import { ResetPasswordDialog } from "@/features/users/ResetPasswordDialog";
import { UserFormDialog } from "@/features/users/UserFormDialog";
import { errorMessage } from "@/shared/api/client";
import { formatDate } from "@/shared/lib/format";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  PageHeader,
  Pager,
  SearchInput,
  Select,
  Toolbar,
  toast,
  type Column,
} from "@/shared/ui";

function StatusBadge({ user }: { user: User }) {
  if (!user.is_active) return <Badge tone="neutral">Pasif</Badge>;
  if (user.is_locked) return <Badge tone="danger">Kilitli</Badge>;
  if (user.must_change_password) return <Badge tone="warning">Geçici şifre</Badge>;
  return <Badge tone="success">Aktif</Badge>;
}

export function UsersPage() {
  const me = useCurrentUser();
  const [filters, setFilters] = useState<UserFilters>({ search: "", status: "all", offset: 0 });
  const [formUser, setFormUser] = useState<User | null | undefined>(undefined);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [toggleUser, setToggleUser] = useState<User | null>(null);

  const users = useUsers(filters);
  const update = useUpdateUser();

  const confirmToggle = () => {
    if (!toggleUser) return;
    const activate = !toggleUser.is_active;
    update.mutate(
      { id: toggleUser.id, body: { is_active: activate } },
      {
        onSuccess: () => {
          toast.success(activate ? "Kullanıcı aktifleştirildi." : "Kullanıcı pasife alındı.");
          setToggleUser(null);
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  };

  const columns: Column<User>[] = [
    {
      key: "name",
      header: "Kullanıcı",
      cell: (user) => (
        <div className="min-w-0">
          <p className="font-medium text-ink">
            {user.full_name}
            {user.id === me.id && <span className="ml-2 text-xs font-normal text-ink-muted">(siz)</span>}
          </p>
          <p className="truncate text-xs text-ink-muted">{user.email}</p>
        </div>
      ),
    },
    { key: "role", header: "Rol", cell: (user) => <Badge tone="brand" dot={false}>{user.role_label}</Badge> },
    { key: "partner", header: "Bağlı ortak", cell: (user) => user.partner_name ?? <span className="text-ink-faint">—</span> },
    { key: "status", header: "Durum", cell: (user) => <StatusBadge user={user} /> },
    {
      key: "last_login",
      header: "Son giriş",
      hideOnMobile: true,
      cell: (user) =>
        user.last_login_at ? formatDate(user.last_login_at, "short") : <span className="text-ink-faint">Hiç</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      interactive: true,
      cell: (user) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" aria-label={`${user.full_name} işlemleri`} onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem icon={<Pencil />} onSelect={() => setFormUser(user)}>
              Düzenle
            </DropdownMenuItem>
            <DropdownMenuItem icon={<KeyRound />} onSelect={() => setResetUser(user)}>
              Şifre sıfırla
            </DropdownMenuItem>
            {user.id !== me.id && (
              <DropdownMenuItem
                icon={<Power />}
                tone={user.is_active ? "danger" : "default"}
                onSelect={() => setToggleUser(user)}
              >
                {user.is_active ? "Pasife al" : "Aktifleştir"}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Yönetim"
        title="Kullanıcılar"
        description="Sisteme giriş yapabilen kişiler ve yetkileri."
        actions={
          <Button onClick={() => setFormUser(null)}>
            <Plus /> Yeni Kullanıcı
          </Button>
        }
      />

      <Card>
        <Toolbar>
          <SearchInput
            value={filters.search}
            onChange={(search) => setFilters((f) => ({ ...f, search, offset: 0 }))}
            placeholder="Ad veya e-posta ara"
            className="sm:max-w-xs sm:flex-1"
          />
          <Select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as UserFilters["status"], offset: 0 }))}
            className="sm:w-40"
            aria-label="Durum filtresi"
          >
            <option value="all">Tüm durumlar</option>
            <option value="active">Aktif</option>
            <option value="inactive">Pasif</option>
          </Select>
        </Toolbar>

        {users.isError ? (
          <p className="px-5 py-8 text-center text-sm text-danger-600">{errorMessage(users.error)}</p>
        ) : (
          <DataTable
            columns={columns}
            rows={users.data?.items ?? []}
            rowKey={(user) => user.id}
            onRowClick={(user) => setFormUser(user)}
            empty={
              users.isPending ? (
                <p className="px-5 py-10 text-center text-sm text-ink-muted">Yükleniyor…</p>
              ) : (
                <EmptyState icon={Users} title="Kullanıcı bulunamadı" description="Filtreleri değiştirmeyi deneyin." />
              )
            }
          />
        )}
        <Pager
          offset={filters.offset}
          limit={PAGE_SIZE}
          total={users.data?.total ?? 0}
          onChange={(offset) => setFilters((f) => ({ ...f, offset }))}
        />
      </Card>

      <UserFormDialog
        open={formUser !== undefined}
        onOpenChange={(open) => !open && setFormUser(undefined)}
        user={formUser}
      />
      <ResetPasswordDialog user={resetUser} onClose={() => setResetUser(null)} />
      <ConfirmDialog
        open={toggleUser !== null}
        onOpenChange={(open) => !open && setToggleUser(null)}
        title={toggleUser?.is_active ? "Kullanıcı Pasife Alınacak" : "Kullanıcı Aktifleştirilecek"}
        description={
          toggleUser?.is_active
            ? `${toggleUser.full_name} artık giriş yapamayacak.`
            : `${toggleUser?.full_name} tekrar giriş yapabilecek.`
        }
        effects={toggleUser?.is_active ? ["Açık oturumları hemen kapanır.", "Geçmiş kayıtları silinmez."] : undefined}
        confirmLabel={toggleUser?.is_active ? "Pasife Al" : "Aktifleştir"}
        tone={toggleUser?.is_active ? "danger" : "primary"}
        loading={update.isPending}
        onConfirm={confirmToggle}
      />
    </>
  );
}
