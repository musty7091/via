import { AlertCircle } from "lucide-react";

import { errorMessage } from "@/shared/api/client";

export function LoadingState({ label = "Yükleniyor…" }: { label?: string }) {
  return <p className="px-5 py-10 text-center text-sm text-ink-muted">{label}</p>;
}

export function ErrorState({ error }: { error: unknown }) {
  return (
    <p className="flex items-center justify-center gap-2 px-5 py-10 text-center text-sm text-danger-600">
      <AlertCircle className="size-4 shrink-0" aria-hidden />
      {errorMessage(error)}
    </p>
  );
}

/** Form altındaki API hata mesajı. */
export function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-md bg-danger-50 px-3 py-2.5 text-sm text-danger-700 sm:col-span-2">
      {errorMessage(error)}
    </p>
  );
}
