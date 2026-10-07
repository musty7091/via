"""Senaryo 11 — Etkinlik iptali: kapora geri verilmez, istisnai durumda iade edilir.

Ada Düğünü (12 Aralık, ₺100.000, Deniz Yıldız maliyeti ₺60.000):
  ₺25.000 kapora alınır, sanatçıya ₺10.000 avans ödenir, müşteri vazgeçer.
  Kapora şirkette kalır → gelir 25.000 − ödenen maliyet 10.000 = kâr ₺15.000 (ortak başına 5.000),
  sonuç iptal edildiği aya (Ekim) yazılır. Ödenmemiş ₺50.000 sanatçı borcu düşer.
Yılbaşı Partisi (31 Aralık, ₺20.000): ₺10.000 kapora, istisnai ₺4.000 iade → ₺6.000 kalır.
  Sonra iptal geri alınır (iade de geri alınır), tam iadeyle yeniden iptal edilir.
Merkez Kasa: 46.200 → +25.000 −10.000 → 61.200 → +10.000 −4.000 → 67.200 → iade geri: 71.200
  → tam iade −10.000 → 61.200
"""

import re
from decimal import Decimal

from playwright.sync_api import Page, expect

from conftest import personal_password
from test_01_setup import PARTNER_PASSWORD
from test_05_operations import open_event
from ui import amount_after, choose, dialog, fill, goto, money, save


def _event(page: Page, customer: str, title: str, day: str, kind: str, item: str) -> None:
    goto(page, "/teklifler", "Teklifler")
    page.get_by_role("button", name="Yeni Teklif").first.click()
    d = dialog(page)
    choose(d, "Müşteri", customer)
    fill(d, {"Teklif başlığı": title, "Etkinlik tarihi": day})
    choose(d, "İşi getiren ortak", "İbrahim Kaya")
    save(page)
    page.get_by_role("button", name="Satır", exact=True).click()
    d = dialog(page)
    choose(d, "Satır türü", kind)
    choose(d, kind, item)
    save(page)
    page.get_by_role("button", name="Gönderildi").click()
    dialog(page).get_by_role("button", name="Gönderildi İşaretle").click()
    page.get_by_role("button", name="Kabul Edildi").click()
    dialog(page).get_by_role("button", name="Kabul Edildi İşaretle").click()
    page.get_by_role("button", name="Anlaşmaya Çevir").click()
    dialog(page).get_by_role("button", name="Anlaşmaya Çevir").click()
    expect(page).to_have_url(re.compile(r"/etkinlikler/\d+"))


def _collect(page: Page, title: str, amount: str, day: str) -> None:
    open_event(page, "Ödemeler", title=title)
    page.get_by_role("tabpanel").get_by_role("button", name="Tahsilat Gir").click()
    d = dialog(page)
    choose(d, "Para nereye girdi?", "Merkez Kasa TL")
    fill(d, {"Tarih": day, "Tutar": amount})
    save(page)


def _kasa(page: Page) -> Decimal:
    goto(page, "/finans/kasa")
    row = (
        page.locator("main")
        .get_by_text("Merkez Kasa TL")
        .first.locator("xpath=ancestor::li[1]|ancestor::tr[1]")
    )
    return money(row.first.inner_text())


def _cancel(page: Page, title: str, refund: str | None = None) -> None:
    open_event(page, title=title)
    page.get_by_role("button", name="İptal Et").click()
    d = dialog(page)
    fill(d, {"İptal sebebi": "Müşteri vazgeçti"})
    expect(d).to_contain_text("Kapora geri verilmez")
    if refund is not None:
        d.get_by_label("İstisna: müşteriye iade yapılacak").check()
        fill(d, {"İade tutarı": refund})
        choose(d, "Ödenen hesap", "Merkez Kasa TL")
    d.get_by_role("button", name="Etkinliği İptal Et").click()
    expect(d).to_be_hidden()
    expect(page.get_by_role("heading", level=1)).to_contain_text("İptal")


def test_wedding_with_deposit_and_artist_advance(page: Page) -> None:
    _event(page, "Kaya Ailesi", "Ada Düğünü", "2026-12-12", "Sanatçı", "Deniz Yıldız")
    _collect(page, "Ada Düğünü", "25000", "2026-10-05")
    panel = page.get_by_role("tabpanel")
    item = (
        panel.get_by_role("listitem")
        .filter(has_text="Deniz Yıldız")
        .filter(has=page.get_by_role("button", name="Öde", exact=True))
    )
    item.get_by_role("button", name="Öde", exact=True).click()
    d = dialog(page)
    choose(d, "Ödeme kaynağı", "Merkez Kasa TL")
    fill(d, {"Tarih": "2026-10-06", "Tutar": "10000"})
    save(page)
    assert _kasa(page) == Decimal("61200.00")


def test_cancel_keeps_deposit(page: Page) -> None:
    open_event(page, title="Ada Düğünü")
    page.get_by_role("button", name="İptal Et").click()
    d = dialog(page)
    expect(d).to_contain_text("Müşteriden alınan: ₺25.000,00")
    expect(d).to_contain_text("Şirkette kalacak: ₺25.000,00")
    expect(d).to_contain_text("maliyet olarak kalır")
    d.get_by_role("button", name="Vazgeç").click()

    _cancel(page, "Ada Düğünü")
    page.get_by_role("tab", name="Ödemeler").click()
    panel = page.get_by_role("tabpanel")
    expect(panel).to_contain_text("Şirkette kalan kapora: ₺25.000,00")
    assert amount_after(panel, "Gelir (KDV hariç)") == Decimal("25000.00")
    assert amount_after(panel, "Kâr") == Decimal("15000.00")
    assert amount_after(panel, "Ödenecek borç") == Decimal("0.00")
    assert _kasa(page) == Decimal("61200.00")  # para şirkette kaldı


def test_cancelled_event_closure_shares_kept_deposit(page: Page) -> None:
    open_event(page, "Kapanış", title="Ada Düğünü")
    panel = page.get_by_role("tabpanel")
    expect(panel).to_contain_text("Etkinlik iptal edildi")
    for name in ("Alper Aslan", "Volkan Demir", "İbrahim Kaya"):
        expect(panel.get_by_role("listitem").filter(has_text=name)).to_contain_text("5.000,00")
    panel.get_by_role("button", name="Finans Kapanışı Yap").click()
    dialog(page).get_by_role("button", name="Kapanışı Yap").click()
    expect(panel).to_contain_text("Dağıtılan Sonuç")

    goto(page, "/kapanislar", "Dönem Kapanışları")
    page.get_by_role("button", name=re.compile(r"^Ekim 2026")).click()
    main = page.locator("main")
    assert amount_after(main, "Bu ayın etkinliklerinin kârı") == Decimal("15000.00")
    expect(main).to_contain_text("Ada Düğünü")


def test_partial_refund_is_exceptional(page: Page) -> None:
    _event(page, "Merit Park Hotel", "Yılbaşı Partisi", "2026-12-31", "Hizmet", "Ses Sistemi")
    _collect(page, "Yılbaşı Partisi", "10000", "2026-10-06")
    assert _kasa(page) == Decimal("71200.00")

    _cancel(page, "Yılbaşı Partisi", refund="4000")

    page.get_by_role("tab", name="Ödemeler").click()
    panel = page.get_by_role("tabpanel")
    expect(panel).to_contain_text("Şirkette kalan kapora: ₺6.000,00")
    expect(panel).to_contain_text("Müşteriye iade: ₺4.000,00")
    assert amount_after(panel, "Kâr") == Decimal("6000.00")
    assert _kasa(page) == Decimal("67200.00")


def test_refund_more_than_collected_is_rejected(page: Page) -> None:
    """İptal geri alınır; tekrar iptalde alınandan fazla iade reddedilir."""
    open_event(page, title="Yılbaşı Partisi")
    page.get_by_role("button", name="Yeniden Aç").click()
    dialog(page).get_by_role("button", name="Yeniden Aç").click()
    expect(page.get_by_role("heading", level=1)).to_contain_text("Planlandı")
    page.get_by_role("tab", name="Ödemeler").click()
    panel = page.get_by_role("tabpanel")
    assert amount_after(panel, "Kalan alacak") == Decimal("10000.00")
    expect(panel).not_to_contain_text("Şirkette kalan kapora")
    assert _kasa(page) == Decimal("71200.00")  # iade geri alındı

    open_event(page, title="Yılbaşı Partisi")
    page.get_by_role("button", name="İptal Et").click()
    d = dialog(page)
    fill(d, {"İptal sebebi": "Müşteri vazgeçti"})
    d.get_by_label("İstisna: müşteriye iade yapılacak").check()
    fill(d, {"İade tutarı": "15000"})
    choose(d, "Ödenen hesap", "Merkez Kasa TL")
    d.get_by_role("button", name="Etkinliği İptal Et").click()
    expect(d.locator("p.text-danger-600")).to_contain_text("fazla olamaz")
    d.get_by_role("button", name="Vazgeç").click()


def test_full_refund_needs_no_closure(page: Page) -> None:
    _cancel(page, "Yılbaşı Partisi", refund="10000")
    page.get_by_role("tab", name="Ödemeler").click()
    panel = page.get_by_role("tabpanel")
    expect(panel).to_contain_text("Müşteriye iade: ₺10.000,00")
    assert amount_after(panel, "Kâr") == Decimal("0.00")
    assert _kasa(page) == Decimal("61200.00")

    goto(page, "/kapanislar", "Dönem Kapanışları")
    page.get_by_role("button", name=re.compile(r"^Ekim 2026")).click()
    expect(page.locator("main")).not_to_contain_text("Yılbaşı Partisi")


def test_partner_cannot_refund(new_user_page) -> None:  # noqa: ANN001
    """İade para çıkışıdır: finans kayıt yetkisi olmayan ortak iade seçeneğini görmez,
    ama etkinliği iptal edebilir (para şirkette kalır)."""
    page: Page = new_user_page("alper@viaevents-e2e.com", personal_password(PARTNER_PASSWORD))
    open_event(page, title="Kaya Ailesi Nişanı")
    page.get_by_role("button", name="İptal Et").click()
    d = dialog(page)
    expect(d).to_contain_text("Kapora geri verilmez")
    expect(d.get_by_label("İstisna: müşteriye iade yapılacak")).to_have_count(0)
    d.get_by_role("button", name="Vazgeç").click()
