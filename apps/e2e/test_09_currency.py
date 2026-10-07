"""Senaryo 9 — Dövizli iş: EUR teklif, EUR tahsilat, kur farkı.

Kaya Ailesi Nişanı, 3 Ekim 2026, EUR, teklif kuru 40, faturasız:
  Organizasyon hizmeti  satış €5.000 (₺200.000)  maliyet €3.000 (kur 40 → ₺120.000)
Tahsilat: €5.000, günün kuru 41 → ₺205.000 girer; ₺5.000 kur farkı geliri.
Beklenen kâr: 200.000 − 120.000 + 5.000 = ₺85.000
"""

from decimal import Decimal

from playwright.sync_api import Page, expect

from test_05_operations import open_event
from ui import amount_after, choose, dialog, field, fill, goto, save

TITLE = "Kaya Ailesi Nişanı"


def test_eur_offer_to_event(page: Page) -> None:
    goto(page, "/teklifler", "Teklifler")
    page.get_by_role("button", name="Yeni Teklif").first.click()
    d = dialog(page)
    choose(d, "Müşteri", "Kaya Ailesi")
    fill(d, {"Teklif başlığı": TITLE, "Etkinlik tarihi": "2026-10-03"})
    choose(d, "İşi getiren ortak", "İbrahim Kaya")
    choose(d, "Para birimi", "Euro")
    field(d, "Teklif kuru").fill("40")
    save(page)

    page.get_by_role("button", name="Satır", exact=True).click()
    d = dialog(page)
    choose(d, "Satır türü", "Serbest satır")
    fill(d, {"Başlık": "Organizasyon hizmeti", "Birim satış fiyatı": "5000", "Birim maliyet": "3000"})
    choose(d, "Maliyet para birimi", "Euro")
    rate = field(d, "Maliyet kuru")
    if rate.count():
        rate.fill("40")
    save(page)

    main = page.locator("main")
    assert amount_after(main, "Genel toplam") == Decimal("5000.00")
    assert amount_after(main, "Gelir (KDV hariç)") == Decimal("200000.00")  # TL karşılığı
    assert amount_after(main, "Tahmini kâr") == Decimal("80000.00")

    page.get_by_role("button", name="Gönderildi").click()
    dialog(page).get_by_role("button", name="Gönderildi İşaretle").click()
    page.get_by_role("button", name="Kabul Edildi").click()
    dialog(page).get_by_role("button", name="Kabul Edildi İşaretle").click()
    page.get_by_role("button", name="Anlaşmaya Çevir").click()
    dialog(page).get_by_role("button", name="Anlaşmaya Çevir").click()
    expect(page.get_by_role("heading", level=1)).to_contain_text(TITLE)
    expect(page.locator("main")).to_contain_text("€5.000,00")


def test_eur_collection_with_fx_gain(page: Page) -> None:
    open_event(page, "Ödemeler", title=TITLE)
    panel = page.get_by_role("tabpanel")
    panel.get_by_role("button", name="Tahsilat Gir").click()
    d = dialog(page)
    choose(d, "Para nereye girdi?", "İş Bankası EUR")
    fill(d, {"Tarih": "2026-10-04", "Tutar": "5000"})
    field(d, "Günün kuru").fill("41")
    save(page)
    assert amount_after(panel, "Kalan alacak") == Decimal("0.00")
    fx = amount_after(panel, "Kur farkı")
    profit = amount_after(panel, "Kâr")
    assert profit == Decimal("85000.00"), (fx, profit)
    assert fx == Decimal("5000.00"), f"Kur farkı geliri pozitif görünmeli, ekranda {fx}"


def test_eur_cash_account(page: Page) -> None:
    goto(page, "/finans/kasa")
    item = (
        page.locator("main")
        .get_by_text("İş Bankası EUR")
        .first.locator("xpath=ancestor::li[1]|ancestor::tr[1]")
        .first
    )
    text = item.inner_text()
    assert "€5.000,00" in text, text


def test_dashboard_total_includes_eur(page: Page) -> None:
    """Kasa + Banka toplamı EUR hesabı TL karşılığıyla içerir: 70.200 + 5.000 × 41 = 275.200."""
    goto(page, "/")
    assert amount_after(page.locator("main"), "Kasa + Banka") == Decimal("275200.00")
