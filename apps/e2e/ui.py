"""Ekran işlemleri için kısa yardımcılar (dialog doldurma, para okuma, bildirim bekleme)."""

import re
import time
from decimal import Decimal

from playwright.sync_api import Locator, Page, expect


def dialog(page: Page) -> Locator:
    d = page.get_by_role("dialog")
    expect(d).to_be_visible()
    return d


def field(scope: Locator | Page, label: str) -> Locator:
    """Etikete göre alan. Zorunlu alanların adı sonuna '*' alır; para birimli etiketler
    '(TRY)' gibi bir ek taşır ("Birim satış fiyatı (TRY)")."""
    return scope.get_by_label(re.compile(rf"^{re.escape(label)}( \([^)]*\))?\*?$"))


def amount_after(scope: Locator | Page, label: str) -> Decimal:
    """Metinde etiketten hemen sonra gelen tutarı okur ("Genel toplam ₺139.200,00")."""
    pattern = re.compile(rf"{re.escape(label)}\s*(-?\s*[₺€£$]?\s*-?[\d.]+,\d{{2}})")
    deadline = time.monotonic() + 10
    while True:  # veriler yüklenene kadar bekle
        text = scope.inner_text().replace("−", "-")
        m = pattern.search(text)
        if m or time.monotonic() > deadline:
            break
        time.sleep(0.25)
    assert m, f"'{label}' tutarı bulunamadı:\n{text[:2000]}"
    return money(m.group(1))


def term(scope: Locator | Page, name: str) -> str:
    """Tanım listesinde (dt/dd) bir başlığın değerini döndürür."""
    dt = scope.locator("dt").filter(has_text=re.compile(rf"^\s*{re.escape(name)}\s*$")).first
    return dt.locator("xpath=following-sibling::dd[1]").inner_text()


def fill(scope: Locator | Page, values: dict[str, str]) -> None:
    for label, value in values.items():
        field(scope, label).fill(value)


def choose(scope: Locator | Page, label: str, option: str) -> None:
    """Yerel <select>: seçeneği görünen metnin başlangıcına göre seçer."""
    select = field(scope, label)
    deadline = time.monotonic() + 10
    while True:  # seçenekler API'den geç gelebilir
        options = select.locator("option").all_inner_texts()
        match = next((o for o in options if o.strip() == option), None) or next(
            (o for o in options if o.strip().startswith(option)), None
        )
        if match is not None or time.monotonic() > deadline:
            break
        time.sleep(0.2)
    assert match is not None, f"'{label}' alanında '{option}' seçeneği yok: {options}"
    select.select_option(label=match)


def submit(page: Page) -> Locator:
    """Dialogun gönder (submit) butonuna basar ve dialogu döndürür."""
    d = page.get_by_role("dialog")
    submit_button = d.locator("button[type=submit]")
    if submit_button.count():
        submit_button.click()
    else:  # form dışı onay butonu: alt çubuktaki son buton (Vazgeç/Kapat hariç)
        d.get_by_role("button").filter(has_not_text="Vazgeç").filter(has_not_text="Kapat").last.click()
    return d


def save(page: Page) -> None:
    """Dialogu kaydeder ve kapanmasını bekler; kapanmazsa ekrandaki hatayı gösterir."""
    d = submit(page)
    try:
        expect(d).to_be_hidden()
    except AssertionError:
        raise AssertionError("Dialog kapanmadı. Ekrandaki metin:\n" + d.inner_text()) from None


def toast(page: Page, text: str | re.Pattern) -> None:
    expect(page.get_by_text(text).first).to_be_visible()


def money(text: str) -> Decimal:
    """'₺12.345,67' / '-€1.000,00' gibi metni Decimal'e çevirir."""
    cleaned = text.replace("−", "-").replace(" ", "").replace("\xa0", "")
    m = re.search(r"-?[^\d-]*?(-?[\d.]+,\d{2})", cleaned)
    assert m, f"Tutar okunamadı: {text!r}"
    negative = cleaned.strip().startswith("-") or "(-" in cleaned
    value = Decimal(m.group(1).replace(".", "").replace(",", ".").lstrip("-"))
    return -value if negative or m.group(1).startswith("-") else value


def goto(page: Page, path: str, heading: str | None = None) -> None:
    page.goto(path)
    if heading:
        expect(page.get_by_role("heading", name=heading, level=1)).to_be_visible()


def form_error(scope: Locator) -> Locator:
    """Dialogdaki sunucu hata mesajı (FormError veya kırmızı paragraf; alan yıldızı değil)."""
    return scope.locator("[role=alert], p.text-danger-600, p.text-danger-700").first
