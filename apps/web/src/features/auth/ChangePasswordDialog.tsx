import { PasswordChangeFields } from "@/features/auth/PasswordChangeForm";
import { usePasswordChangeForm } from "@/features/auth/usePasswordChangeForm";
import { Button, Dialog, toast } from "@/shared/ui";

export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const state = usePasswordChangeForm(() => {
    toast.success("Şifreniz değiştirildi. Diğer cihazlardaki oturumlar kapatıldı.");
    close(false);
  });

  function close(next: boolean) {
    if (!next) state.reset();
    onOpenChange(next);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title="Şifremi Değiştir"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Vazgeç
          </Button>
          <Button type="submit" form="change-password" loading={state.mutation.isPending}>
            Şifreyi Değiştir
          </Button>
        </>
      }
    >
      <PasswordChangeFields formId="change-password" state={state} />
    </Dialog>
  );
}
