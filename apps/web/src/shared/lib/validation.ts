import { z } from "zod";

/** Form doğrulama kuralları backend ile aynıdır; burada sadece kullanıcıya erken uyarı içindir. */
export const MIN_PASSWORD_LENGTH = 10;

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır.`)
  .max(128, "Şifre en fazla 128 karakter olabilir.");

/** Boş metni null'a çevirir (opsiyonel alanlar için). */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `En fazla ${max} karakter.`)
    .transform((value) => (value === "" ? null : value));

export const requiredText = (min: number, max: number, label = "Bu alan") =>
  z
    .string()
    .trim()
    .min(min, min <= 1 ? `${label} zorunludur.` : `${label} en az ${min} karakter olmalıdır.`)
    .max(max, `En fazla ${max} karakter.`);

export const optionalEmail = z
  .union([z.literal(""), z.email("Geçerli bir e-posta adresi girin.")])
  .transform((value) => (value === "" ? null : value));

/**
 * Türkçe yazılmış tutarı API biçimine çevirir: "300.000,50" → "300000.50".
 * Nokta binlik ayırıcı, virgül ondalık ayırıcı kabul edilir. Sadece nokta varsa
 * ve son kısım 1-2 haneliyse ondalık sayılır ("1500.5").
 */
export function parseMoneyInput(raw: string): string | null {
  let text = raw.replace(/\s|₺|TL/gi, "");
  if (text === "") return null;
  if (text.includes(",")) {
    text = text.replace(/\./g, "").replace(",", ".");
  } else if (!/^\d+\.\d{1,2}$/.test(text)) {
    text = text.replace(/\./g, "");
  }
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  return Number(text).toFixed(2);
}

/** API tutarını ("300000.50") form alanına Türkçe yazar ("300.000,50"). */
export function formatMoneyInput(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  return new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(
    Number(value),
  );
}

const MONEY_ERROR = "Geçerli bir tutar girin (ör. 150.000 veya 1.250,50).";

export const moneyInput = z.string().refine((value) => parseMoneyInput(value) !== null, MONEY_ERROR).transform(
  (value) => parseMoneyInput(value) as string,
);

export const optionalMoneyInput = z
  .string()
  .refine((value) => value.trim() === "" || parseMoneyInput(value) !== null, MONEY_ERROR)
  .transform((value) => (value.trim() === "" ? null : parseMoneyInput(value)));

/** Seçim kutularında "seçilmedi" = boş metin; API'ye null gider. */
export const optionalId = z.string().transform((value) => (value === "" ? null : Number(value)));

/** Kur girişi: "36,45" veya "36.4521" → "36.4521" (6 haneye kadar). */
export function parseRateInput(raw: string): string | null {
  const text = raw.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,6})?$/.test(text) || Number(text) <= 0) return null;
  return text;
}

export const optionalRateInput = z
  .string()
  .refine((v) => v.trim() === "" || parseRateInput(v) !== null, "Geçerli bir kur girin (ör. 36,45).")
  .transform((v) => (v.trim() === "" ? null : parseRateInput(v)));

export const optionalDate = z.string().transform((v) => (v === "" ? null : v));
