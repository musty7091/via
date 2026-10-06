/**
 * Excel'in Türkçe ayarlarıyla doğrudan açılan CSV: noktalı virgül ayraç, ondalıkta virgül,
 * UTF-8 BOM (Türkçe karakterler bozulmasın diye).
 */
export type CsvValue = string | number | null | undefined;

/** API'den gelen "12345.67" gibi tutarları Excel'in sayı olarak okuyacağı "12345,67" yapar. */
export function csvAmount(value: string | number | null | undefined) {
  return value == null || value === "" ? "" : String(value).replace(".", ",");
}

function cell(value: CsvValue) {
  const text = value == null ? "" : String(value);
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function downloadCsv(filename: string, headers: string[], rows: CsvValue[][]) {
  const body = [headers, ...rows].map((row) => row.map(cell).join(";")).join("\r\n");
  const blob = new Blob(["﻿", body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
