import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  createManagedUser,
  fetchManagedUsers,
  resetManagedUserPassword,
  updateManagedUser,
} from "../api/userManagementApi";
import type { ManagedUser } from "../types/userManagementTypes";
import type { AuthUser } from "../../../types/auth";

type UserManagementPageProps = {
  currentUser: AuthUser;
  onBackToDashboard: () => void;
};

type UserFormState = {
  fullName: string;
  email: string;
  password: string;
  role: string;
  isActive: boolean;
};

type PasswordFormState = {
  newPassword: string;
};

const roleOptions = [
  {
    value: "super_admin",
    label: "Super Admin",
    description: "Tüm yetkilere sahip. Kullanıcı yönetebilir.",
  },
  {
    value: "partner_manager",
    label: "Ortak / Yönetici",
    description: "Yönetici seviyesinde takip için kullanılacak.",
  },
  {
    value: "accounting",
    label: "Muhasebe",
    description: "Tahsilat, ödeme, kasa/banka ve cari girişleri için.",
  },
  {
    value: "operation",
    label: "Operasyon",
    description: "Etkinlik, rider, görev ve operasyon notları için.",
  },
  {
    value: "viewer",
    label: "Görüntüleme",
    description: "Sadece izleme seviyesi.",
  },
];

const emptyForm: UserFormState = {
  fullName: "",
  email: "",
  password: "",
  role: "viewer",
  isActive: true,
};

const emptyPasswordForm: PasswordFormState = {
  newPassword: "",
};

function getRoleLabel(role: string) {
  return roleOptions.find((option) => option.value === role)?.label ?? role;
}

function getRoleDescription(role: string) {
  return roleOptions.find((option) => option.value === role)?.description ?? "";
}

export function UserManagementPage({
  currentUser,
  onBackToDashboard,
}: UserManagementPageProps) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [isActiveFilter, setIsActiveFilter] = useState<string>("");
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [passwordForm, setPasswordForm] =
    useState<PasswordFormState>(emptyPasswordForm);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [users, selectedUserId]
  );

  const activeUserCount = useMemo(
    () => users.filter((user) => user.is_active).length,
    [users]
  );

  const isSuperAdmin = currentUser.role === "super_admin";

  async function loadUsers(nextSelectedUserId?: number | null) {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const data = await fetchManagedUsers({
        search,
        isActive:
          isActiveFilter === ""
            ? null
            : isActiveFilter === "active"
              ? true
              : false,
      });

      setUsers(data);

      if (typeof nextSelectedUserId === "number") {
        setSelectedUserId(nextSelectedUserId);
      } else if (nextSelectedUserId === null) {
        setSelectedUserId(null);
      } else if (!selectedUserId && data.length > 0) {
        setSelectedUserId(data[0].id);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Kullanıcı listesi alınamadı."
      );
    } finally {
      setIsLoading(false);
    }
  }

  function fillForm(user: ManagedUser | null) {
    if (!user) {
      setForm(emptyForm);
      setPasswordForm(emptyPasswordForm);
      return;
    }

    setForm({
      fullName: user.full_name,
      email: user.email,
      password: "",
      role: user.role,
      isActive: user.is_active,
    });

    setPasswordForm(emptyPasswordForm);
  }

  function startCreateUser() {
    setSelectedUserId(null);
    fillForm(null);
    setSuccessMessage("");
    setErrorMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isSuperAdmin) {
      setErrorMessage("Bu ekran sadece super_admin kullanıcılar içindir.");
      return;
    }

    const fullName = form.fullName.trim();
    const email = form.email.trim().toLowerCase();

    if (!fullName || !email) {
      setErrorMessage("Ad soyad ve e-posta boş bırakılamaz.");
      return;
    }

    if (!selectedUser && form.password.length < 6) {
      setErrorMessage("Yeni kullanıcı için en az 6 karakterlik geçici şifre gir.");
      return;
    }

    setIsSavingUser(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      if (selectedUser) {
        const updated = await updateManagedUser(selectedUser.id, {
          full_name: fullName,
          email,
          role: form.role,
          is_active: form.isActive,
        });

        await loadUsers(updated.id);
        setSuccessMessage("Kullanıcı bilgileri güncellendi.");
      } else {
        const created = await createManagedUser({
          full_name: fullName,
          email,
          password: form.password,
          role: form.role,
          is_active: form.isActive,
        });

        await loadUsers(created.id);
        setSuccessMessage("Yeni kullanıcı oluşturuldu.");
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Kullanıcı kaydedilemedi."
      );
    } finally {
      setIsSavingUser(false);
    }
  }

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedUser) {
      setErrorMessage("Şifre sıfırlamak için önce kullanıcı seç.");
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setErrorMessage("Yeni şifre en az 6 karakter olmalı.");
      return;
    }

    setIsResettingPassword(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await resetManagedUserPassword(selectedUser.id, {
        new_password: passwordForm.newPassword,
      });

      setPasswordForm(emptyPasswordForm);
      setSuccessMessage("Kullanıcı şifresi sıfırlandı.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Şifre sıfırlanamadı."
      );
    } finally {
      setIsResettingPassword(false);
    }
  }

  useEffect(() => {
    if (isSuperAdmin) {
      void loadUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin]);

  useEffect(() => {
    fillForm(selectedUser);
  }, [selectedUser]);

  if (!isSuperAdmin) {
    return (
      <main className="min-h-screen bg-slate-100 text-slate-950">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-4 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.35em] text-teal-700">
                VIA EVENTS
              </p>
              <h1 className="mt-1 text-xl font-black sm:text-2xl">
                Kullanıcılar
              </h1>
            </div>

            <button
              onClick={onBackToDashboard}
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white"
            >
              Dashboard
            </button>
          </div>
        </header>

        <section className="mx-auto max-w-3xl px-4 py-8">
          <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6 text-amber-950">
            <p className="text-sm font-black">Yetki gerekli</p>
            <h2 className="mt-2 text-2xl font-black">
              Bu ekran sadece super_admin kullanıcılar içindir.
            </h2>
            <p className="mt-3 text-sm leading-6">
              Kullanıcı oluşturma, rol değiştirme, pasif yapma ve şifre sıfırlama
              işlemleri sistem güvenliği açısından sadece ana admin tarafından yapılır.
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-teal-700">
              VIA EVENTS
            </p>
            <h1 className="mt-1 truncate text-xl font-black sm:text-2xl">
              Kullanıcı ve Yetki Yönetimi
            </h1>
          </div>

          <button
            onClick={onBackToDashboard}
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white"
          >
            Dashboard
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl space-y-5 px-4 py-5">
        <section className="rounded-[2rem] bg-slate-950 p-5 text-white shadow-xl shadow-slate-300">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-teal-300">
            Sistem Yetkileri
          </p>
          <h2 className="mt-2 text-3xl font-black">
            Kullanıcıları ve rollerini buradan yönet.
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Muhasebe, operasyon, ortak yönetici ve görüntüleme kullanıcıları bu
            ekrandan oluşturulur. Şifreler düz metin saklanmaz.
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <Metric title="Toplam Kullanıcı" value={String(users.length)} />
            <Metric title="Aktif Kullanıcı" value={String(activeUserCount)} />
            <Metric
              title="Super Admin"
              value={String(users.filter((user) => user.role === "super_admin").length)}
            />
          </div>
        </section>

        {errorMessage ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-3xl border border-teal-200 bg-teal-50 p-4 text-sm font-semibold text-teal-800">
            {successMessage}
          </div>
        ) : null}

        <section className="grid gap-5 lg:grid-cols-[390px_1fr]">
          <aside className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-slate-950">Kullanıcılar</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Seçerek düzenleyebilirsin.
                </p>
              </div>

              <button
                onClick={startCreateUser}
                className="rounded-full bg-teal-300 px-4 py-2 text-sm font-black text-slate-950"
              >
                Yeni
              </button>
            </div>

            <div className="mt-4 grid gap-2">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void loadUsers(null);
                  }
                }}
                placeholder="Ad veya e-posta ara..."
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
              />

              <div className="grid grid-cols-[1fr_auto] gap-2">
                <select
                  value={isActiveFilter}
                  onChange={(event) => setIsActiveFilter(event.target.value)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none ring-teal-500 transition focus:ring-4"
                >
                  <option value="">Tüm kullanıcılar</option>
                  <option value="active">Aktif</option>
                  <option value="inactive">Pasif</option>
                </select>

                <button
                  onClick={() => void loadUsers(null)}
                  className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white"
                >
                  Ara
                </button>
              </div>
            </div>

            {isLoading ? (
              <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                Kullanıcılar yükleniyor...
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => {
                      setSelectedUserId(user.id);
                      setSuccessMessage("");
                      setErrorMessage("");
                    }}
                    className={`w-full rounded-3xl border p-4 text-left transition ${
                      selectedUserId === user.id
                        ? "border-teal-300 bg-teal-50"
                        : "border-slate-200 bg-slate-50 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-black text-slate-950">
                          {user.full_name}
                        </p>
                        <p className="mt-1 truncate text-sm text-slate-500">
                          {user.email}
                        </p>
                        <p className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-teal-700">
                          {getRoleLabel(user.role)}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${
                          user.is_active
                            ? "bg-teal-100 text-teal-800"
                            : "bg-slate-200 text-slate-500"
                        }`}
                      >
                        {user.is_active ? "Aktif" : "Pasif"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <section className="grid gap-5">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-teal-700">
                  {selectedUser ? "Düzenle" : "Yeni Kullanıcı"}
                </p>
                <h3 className="mt-2 text-2xl font-black text-slate-950">
                  {selectedUser ? selectedUser.full_name : "Yeni kullanıcı oluştur"}
                </h3>
                {selectedUser ? (
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Kullanıcı rolü, aktiflik durumu ve temel bilgileri güncellenebilir.
                  </p>
                ) : (
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Yeni kullanıcıya geçici şifre ver. Kullanıcı daha sonra bu şifreyle
                    giriş yapabilir.
                  </p>
                )}
              </div>

              <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">Ad soyad</span>
                  <input
                    value={form.fullName}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        fullName: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-teal-500 transition focus:ring-4"
                    placeholder="Ad Soyad"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-700">E-posta</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-teal-500 transition focus:ring-4"
                    placeholder="ornek@viaevents.com"
                  />
                </label>

                {!selectedUser ? (
                  <label className="block">
                    <span className="text-sm font-bold text-slate-700">
                      Geçici şifre
                    </span>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          password: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-teal-500 transition focus:ring-4"
                      placeholder="En az 6 karakter"
                    />
                  </label>
                ) : null}

                <label className="block">
                  <span className="text-sm font-bold text-slate-700">Rol</span>
                  <select
                    value={form.role}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        role: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-teal-500 transition focus:ring-4"
                  >
                    {roleOptions.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                  <span className="mt-2 block text-sm leading-6 text-slate-500">
                    {getRoleDescription(form.role)}
                  </span>
                </label>

                <label className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        isActive: event.target.checked,
                      }))
                    }
                  />
                  Aktif kullanıcı
                </label>

                {selectedUser?.id === currentUser.id ? (
                  <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                    Kendi hesabını pasif yapamazsın. Backend de bu işlemi engeller.
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={isSavingUser}
                  className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingUser
                    ? "Kaydediliyor..."
                    : selectedUser
                      ? "Kullanıcıyı Güncelle"
                      : "Kullanıcı Oluştur"}
                </button>
              </form>
            </section>

            {selectedUser ? (
              <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-red-700">
                  Şifre İşlemi
                </p>
                <h3 className="mt-2 text-xl font-black text-slate-950">
                  Şifre Sıfırla
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Yeni şifre düz metin saklanmaz. Veritabanına hashlenerek yazılır.
                </p>

                <form onSubmit={handleResetPassword} className="mt-5 grid gap-4">
                  <label className="block">
                    <span className="text-sm font-bold text-slate-700">
                      Yeni şifre
                    </span>
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(event) =>
                        setPasswordForm({
                          newPassword: event.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-red-500 transition focus:ring-4"
                      placeholder="En az 6 karakter"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={isResettingPassword}
                    className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isResettingPassword ? "Sıfırlanıyor..." : "Şifreyi Sıfırla"}
                  </button>
                </form>
              </section>
            ) : null}
          </section>
        </section>
      </section>
    </main>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <article className="rounded-3xl bg-white/10 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-300">
        {title}
      </p>
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
    </article>
  );
}
