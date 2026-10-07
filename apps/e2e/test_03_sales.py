"""Senaryo 3 — Satış: teklif hazırlanır, gönderilir, kabul edilir, anlaşmaya çevrilir.

Merit Park Hotel, 20 Eylül 2026, TL, %16 KDV:
  Deniz Yıldız (sanatçı)  satış 100.000  maliyet 60.000
  Ses Sistemi (hizmet)    satış  20.000  maliyet 12.000
  KDV hariç 120.000 · KDV 19.200 · Genel toplam 139.200 · Maliyet 72.000 · Kâr 48.000
"""

import re
from decimal import Decimal

from playwright.sync_api import Page, expect

from ui import amount_after, choose, dialog, field, fill, goto, save

OFFER_TITLE = "Merit Yaz Gecesi"


def _open_offer(page: Page, title: str = OFFER_TITLE) -> None:
    goto(page, "/teklifler", "Teklifler")
    page.locator("main").get_by_text(title).first.click()
    expect(page.get_by_role("heading", level=1)).to_contain_text(title)


def test_create_offer(page: Page) -> None:
    goto(page, "/teklifler", "Teklifler")
    page.get_by_role("button", name="Yeni Teklif").first.click()
    d = dialog(page)
    choose(d, "Müşteri", "Merit Park Hotel")
    fill(d, {"Teklif başlığı": OFFER_TITLE, "Etkinlik tarihi": "2026-09-20", "Kişi sayısı": "400"})
    choose(d, "İşi getiren ortak", "Alper Aslan")
    choose(d, "Müşteri yetkilisi", "Selin Ak")
    choose(d, "Mekân", "Merit Park Balo Salonu")
    choose(d, "Fatura", "Faturalı")
    fill(d, {"KDV oranı (%)": "16"})
    fill(d, {"Başlangıç saati": "20:00", "Bitiş saati": "23:30"})
    save(page)
    expect(page.get_by_role("heading", level=1)).to_contain_text(OFFER_TITLE)


def _add_line(page: Page, kind: str, item_label: str, item: str) -> None:
    page.get_by_role("button", name="Satır", exact=True).click()
    d = dialog(page)
    choose(d, "Satır türü", kind)
    choose(d, item_label, item)
    save(page)


def test_offer_lines_and_totals(page: Page) -> None:
    _open_offer(page)
    _add_line(page, "Sanatçı", "Sanatçı", "Deniz Yıldız")
    _add_line(page, "Hizmet", "Hizmet", "Ses Sistemi")
    main = page.locator("main")
    expect(main.get_by_text("Deniz Yıldız").first).to_be_visible()
    expect(main.get_by_text("Ses Sistemi").first).to_be_visible()
    expect(main).to_contain_text("Faturalı")
    assert amount_after(main, "Genel toplam") == Decimal("139200.00")
    assert amount_after(main, "Gelir (KDV hariç)") == Decimal("120000.00")
    assert amount_after(main, "Maliyet") == Decimal("-72000.00")
    assert amount_after(main, "Tahmini kâr") == Decimal("48000.00")


def test_offer_print(page: Page) -> None:
    _open_offer(page)
    with page.context.expect_page() as popup:
        page.get_by_role("link", name="Yazdır / PDF").click()
    printed = popup.value
    printed.wait_for_load_state("networkidle")
    body = printed.locator("body")
    expect(body).to_contain_text(OFFER_TITLE)
    expect(body).to_contain_text("Merit Park Hotel")
    expect(body).to_contain_text("139.200,00")
    # İç maliyet ve kâr müşteri çıktısında görünmemeli
    expect(body).not_to_contain_text("60.000")
    expect(body).not_to_contain_text("Tahmini kâr")
    printed.close()


def test_send_accept_convert(page: Page) -> None:
    _open_offer(page)
    page.get_by_role("button", name="Gönderildi").click()
    dialog(page).get_by_role("button", name="Gönderildi İşaretle").click()
    expect(page.get_by_text("Teklif müşteriye gönderildi")).to_be_visible()
    expect(page.get_by_role("button", name="Düzenle", exact=True)).to_be_hidden()

    page.get_by_role("button", name="Kabul Edildi").click()
    dialog(page).get_by_role("button", name="Kabul Edildi İşaretle").click()
    expect(page.get_by_role("button", name="Anlaşmaya Çevir")).to_be_visible()

    page.get_by_role("button", name="Anlaşmaya Çevir").click()
    dialog(page).get_by_role("button", name="Anlaşmaya Çevir").click()
    expect(page).to_have_url(re.compile(r"/etkinlikler/\d+"))
    main = page.locator("main")
    expect(main).to_contain_text(OFFER_TITLE)
    expect(main).to_contain_text("139.200,00")


def test_converted_offer_locked(page: Page) -> None:
    _open_offer(page)
    expect(page.get_by_role("link", name="Etkinliğe Git")).to_be_visible()
    expect(page.get_by_role("button", name="Düzenle", exact=True)).to_be_hidden()
    expect(page.get_by_role("button", name="Satır", exact=True)).to_be_hidden()


def test_rejected_offer_flow(page: Page) -> None:
    """İkinci teklif: Kaya Ailesi, EUR, gönderilir ve reddedilir; sebep görünür."""
    goto(page, "/teklifler", "Teklifler")
    page.get_by_role("button", name="Yeni Teklif").first.click()
    d = dialog(page)
    choose(d, "Müşteri", "Kaya Ailesi")
    fill(d, {"Teklif başlığı": "Kaya Düğünü", "Etkinlik tarihi": "2026-11-14"})
    choose(d, "İşi getiren ortak", "İbrahim Kaya")
    choose(d, "Para birimi", "Euro")
    rate = field(d, "Teklif kuru")
    if not rate.input_value():
        rate.fill("40")
    save(page)
    page.get_by_role("button", name="Satır", exact=True).click()
    d = dialog(page)
    choose(d, "Satır türü", "Serbest satır")
    fill(d, {"Başlık": "Organizasyon hizmeti", "Birim satış fiyatı": "5000", "Birim maliyet": "3000"})
    save(page)
    page.get_by_role("button", name="Gönderildi").click()
    dialog(page).get_by_role("button", name="Gönderildi İşaretle").click()
    expect(page.get_by_text("Teklif müşteriye gönderildi")).to_be_visible()
    page.get_by_role("button", name="Diğer işlemler").click()
    page.get_by_role("menuitem", name="Reddedildi").click()
    d = dialog(page)
    d.get_by_role("button", name="Reddedildi İşaretle").click()
    expect(d).to_be_visible()  # sebep zorunlu
    fill(d, {"Sebep": "Bütçe uymadı"})
    d.get_by_role("button", name="Reddedildi İşaretle").click()
    expect(page.get_by_text("Bütçe uymadı")).to_be_visible()
