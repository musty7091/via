"""Senaryo 8 — Tüm ekranların taraması ve rapor rakamlarının çapraz kontrolü.

Önceki senaryoların bıraktığı gerçekçi veriyle her sayfa ve sekme açılır. Her sayfada:
JS hatası ya da 500 yanıtı olmamalı (conftest izler), ekranda "NaN", "undefined",
"Invalid Date", "null" gibi bozuk değerler görünmemeli.
"""

import re
from decimal import Decimal

import pytest
from playwright.sync_api import Page, expect

from ui import amount_after, goto, money

BROKEN = re.compile(
    r"NaN|undefined|Invalid Date|\bnull\b|\[object Object\]"
    r"|yapım aşamasında|\(Aşama \d\)|aşamasında (eklenecek|işlenecek)|aktif aktif"
    r"|\d+\.\d{2} (TRY|TL|EUR|USD|GBP)\b"  # biçimlendirilmemiş tutar (139200.00 TRY)
)

PAGES = [
    "/",
    "/teklifler",
    "/teklifler/1",
    "/teklifler/2",
    "/etkinlikler",
    "/etkinlikler/1",
    "/musteriler",
    "/musteriler/1",
    "/musteriler/2",
    "/mekanlar",
    "/katalog",
    "/katalog/sanatcilar",
    "/katalog/hizmetler",
    "/katalog/paketler",
    "/katalog/tedarikciler",
    "/katalog/sanatcilar/1",
    "/katalog/tedarikciler/1",
    "/operasyon",
    "/finans",
    "/finans/tahsilatlar",
    "/finans/borclar",
    "/finans/giderler",
    "/finans/kasa",
    "/genel-giderler",
    "/kapanislar",
    "/raporlar",
    "/kullanicilar",
    "/ortaklar",
    "/islem-gecmisi",
    "/ayarlar",
]

PRINTS = [
    "/teklifler/1/yazdir",
    "/yazdir/etkinlik/1",
    "/yazdir/ekstre/musteri/1",
    "/yazdir/ekstre/sanatci/1",
    "/yazdir/ekstre/tedarikci/1",
    "/yazdir/ekstre/ortak/1",
    "/yazdir/ekstre/ortak/2",
    "/yazdir/donem/2026-09",
    "/yazdir/donem/2026-10",
    "/yazdir/donem-ozeti/2026-09",
    "/yazdir/rapor/etkinlikler?donem=2026-10",
    "/yazdir/rapor/aylik?donem=2026-09",
    "/yazdir/rapor/sanatcilar?donem=2026-10",
    "/yazdir/rapor/musteriler?donem=2026-10",
]


def _check_clean(page: Page, where: str) -> None:
    page.wait_for_load_state("networkidle")
    text = page.locator("body").inner_text()
    assert "yetkiniz yok" not in text, f"{where}: yetki hatası"
    assert "Bir hata oluştu" not in text and "bulunamadı" not in text.split("\n")[0], f"{where}: hata ekranı"
    bad = BROKEN.search(text)
    assert not bad, (
        f"{where}: bozuk değer '{bad.group()}' → …{text[max(0, bad.start() - 80) : bad.end() + 40]}…"
    )


@pytest.mark.parametrize("path", PAGES)
def test_page(page: Page, path: str) -> None:
    page.goto(path)
    expect(page.locator("main")).to_be_visible()
    _check_clean(page, path)
    tabs = page.get_by_role("tab")
    for i in range(tabs.count()):
        name = tabs.nth(i).inner_text()
        tabs.nth(i).click()
        _check_clean(page, f"{path} › {name}")


@pytest.mark.parametrize("path", PRINTS)
def test_print(page: Page, path: str) -> None:
    page.goto(path)
    _check_clean(page, path)
    assert len(page.locator("body").inner_text()) > 200, f"{path}: boş çıktı"


def test_dashboard_numbers(page: Page) -> None:
    goto(page, "/")
    main = page.locator("main")
    assert amount_after(main, "Kasa + Banka") == Decimal("70200.00")
    assert amount_after(main, "Müşterilerden alacak") == Decimal("0.00")
    assert amount_after(main, "Sanatçı / tedarikçi borcu") == Decimal("0.00")
    assert amount_after(main, "Ortaklar üzerindeki para") == Decimal("0.00")


def test_event_profitability_report(page: Page) -> None:
    goto(page, "/raporlar?sekme=etkinlikler")
    page.get_by_role("tab", name="Etkinlik Kârlılığı").click()
    row = page.get_by_role("row").filter(has_text="Merit Yaz Gecesi")
    expect(row).to_be_visible()
    expect(row).to_contain_text("45.000,00")


def test_customer_statement(page: Page) -> None:
    """Merit Park Hotel cari: 139.200 borç, 139.200 tahsilat, bakiye sıfır."""
    page.goto("/yazdir/ekstre/musteri/1")
    body = page.locator("body")
    expect(body.get_by_role("row")).to_have_count(4)  # başlık + anlaşma + 2 tahsilat
    assert amount_after(body, "Müşterinin borcu") == Decimal("0.00")
    balances = [money(c) for c in body.get_by_role("row").locator("td:last-child").all_inner_texts()]
    assert balances[-1] == Decimal("0.00"), balances


def test_audit_log_records_actions(page: Page) -> None:
    goto(page, "/islem-gecmisi")
    main = page.locator("main")
    for fragment in ("gideri iptal edildi. Sebep: Yanlışlıkla girildi", "Eylül 2026 dönemi kapatıldı"):
        expect(main).to_contain_text(fragment)


def test_unknown_url_shows_not_found(page: Page) -> None:
    page.goto("/olmayan-bir-sayfa")
    expect(page.get_by_role("heading", name="Sayfa bulunamadı")).to_be_visible()
    page.get_by_role("link", name="Genel Bakış'a dön").click()
    expect(page.get_by_role("heading", level=1)).to_contain_text("Mustafa")
