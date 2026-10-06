import { useState } from "react";

import { useCatalogOptions, usePackage, type PackageListItem } from "@/features/catalog/api";
import { useOfferLines, type Offer } from "@/features/offers/api";
import { parseMoneyInput, parseRateInput } from "@/shared/lib/validation";
import { Button, Dialog, Field, FormError, Input, Money, Select, toast } from "@/shared/ui";

interface Props {
  offer: Offer;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PackageImportDialog({ offer, open, onOpenChange }: Props) {
  const packages = useCatalogOptions<PackageListItem>("packages", open);
  const [packageId, setPackageId] = useState(0);
  const [price, setPrice] = useState("");
  const [rates, setRates] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const detail = usePackage(packageId);
  const { importPackage } = useOfferLines(offer.id);

  const close = (next: boolean) => {
    if (!next) {
      setPackageId(0);
      setPrice("");
      setRates({});
      setError(null);
      importPackage.reset();
    }
    onOpenChange(next);
  };

  const pkg = packageId ? detail.data : undefined;
  const priceNeeded = Boolean(pkg && pkg.currency !== offer.currency);
  const rateCurrencies = [
    ...new Set(
      (pkg?.items ?? [])
        .map((item) => item.cost_currency)
        .filter((c): c is NonNullable<typeof c> => Boolean(c) && c !== "TRY" && c !== offer.currency),
    ),
  ];

  const submit = () => {
    setError(null);
    if (!pkg) return setError("Paket seçin.");
    const parsedPrice = price.trim() ? parseMoneyInput(price) : null;
    if (priceNeeded && !parsedPrice) return setError(`Paket fiyatını ${offer.currency} olarak girin.`);
    if (price.trim() && !parsedPrice) return setError("Geçerli bir fiyat girin.");
    const costRates: Record<string, string> = {};
    for (const currency of rateCurrencies) {
      const rate = parseRateInput(rates[currency] ?? "");
      if (!rate) return setError(`${currency} maliyetleri için geçerli bir TL kuru girin.`);
      costRates[currency] = rate;
    }
    importPackage.mutate(
      { package_id: pkg.id, price: parsedPrice, cost_rates: costRates },
      {
        onSuccess: () => {
          toast.success(`${pkg.name} teklife eklendi.`);
          close(false);
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title="Paket Ekle"
      description="Paket tek satış fiyatıyla eklenir; içeriği müşteriye 'Dahil' olarak görünür."
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Vazgeç
          </Button>
          <Button onClick={submit} loading={importPackage.isPending} disabled={!pkg}>
            Paketi Ekle
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Paket" required>
          {(p) => (
            <Select {...p} value={packageId || ""} onChange={(e) => setPackageId(Number(e.target.value))}>
              <option value="">Paket seçin</option>
              {packages.data?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.item_count} kalem
                </option>
              ))}
            </Select>
          )}
        </Field>

        {pkg && (
          <div className="rounded-md bg-surface-muted p-3 text-sm">
            <p className="font-medium">{pkg.name}</p>
            <p className="text-ink-muted">
              Katalog fiyatı: <Money amount={pkg.price} currency={pkg.currency} />
            </p>
            <ul className="mt-2 space-y-0.5 text-ink-soft">
              {pkg.items.map((item) => (
                <li key={item.id}>· {item.title}</li>
              ))}
            </ul>
          </div>
        )}

        {pkg && (
          <Field
            label={`Teklifteki paket fiyatı (${offer.currency})`}
            required={priceNeeded}
            hint={priceNeeded ? "Paket farklı para biriminde; teklif para biriminde fiyat girin." : "Boş bırakılırsa katalog fiyatı kullanılır."}
          >
            {(p) => <Input {...p} value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" />}
          </Field>
        )}

        {rateCurrencies.map((currency) => (
          <Field key={currency} label={`${currency} maliyet kuru (1 ${currency} = ? TL)`} required hint="Paket içinde bu para biriminde maliyet var.">
            {(p) => (
              <Input
                {...p}
                value={rates[currency] ?? ""}
                onChange={(e) => setRates((r) => ({ ...r, [currency]: e.target.value }))}
                inputMode="decimal"
                placeholder="36,45"
              />
            )}
          </Field>
        ))}

        {error && <p className="text-sm text-danger-600">{error}</p>}
        <FormError error={importPackage.error} />
      </div>
    </Dialog>
  );
}
