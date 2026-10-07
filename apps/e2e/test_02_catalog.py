"""Senaryo 2 — Katalog ve müşteriler: tedarikçi, sanatçı, hizmet, paket, müşteri, yetkili, mekân."""

from playwright.sync_api import Page, expect

from ui import choose, dialog, fill, goto, save


def _new(page: Page, button: str) -> None:
    page.get_by_role("button", name=button).first.click()


def test_supplier(page: Page) -> None:
    goto(page, "/katalog/tedarikciler")
    _new(page, "Yeni Tedarikçi")
    d = dialog(page)
    fill(d, {"Firma adı": "Ses Işık Ltd", "Yetkili": "Kemal Usta", "Telefon": "+90 533 111 11 11"})
    save(page)
    expect(page.locator("main").get_by_text("Ses Işık Ltd").first).to_be_visible()


def test_artist(page: Page) -> None:
    goto(page, "/katalog/sanatcilar")
    _new(page, "Yeni Sanatçı")
    d = dialog(page)
    fill(
        d,
        {
            "Ad / sahne adı": "Deniz Yıldız",
            "Satış fiyatı (müşteriye)": "100000",
            "Maliyet (sanatçıya ödenen)": "60000",
        },
    )
    choose(d, "Satış para birimi", "TL")
    choose(d, "Maliyet para birimi", "TL")
    choose(d, "Menajer ortak", "Volkan Demir")
    save(page)
    expect(page.locator("main").get_by_text("Deniz Yıldız").first).to_be_visible()


def test_service(page: Page) -> None:
    goto(page, "/katalog/hizmetler")
    _new(page, "Yeni Hizmet")
    d = dialog(page)
    fill(d, {"Hizmet adı": "Ses Sistemi", "Satış fiyatı": "20000", "Maliyet": "12000"})
    choose(d, "Tedarikçi", "Ses Işık Ltd")
    choose(d, "Satış para birimi", "TL")
    choose(d, "Maliyet para birimi", "TL")
    save(page)
    expect(page.locator("main").get_by_text("Ses Sistemi").first).to_be_visible()


def test_customer_with_contact(page: Page) -> None:
    goto(page, "/musteriler", "Müşteriler")
    _new(page, "Yeni Müşteri")
    d = dialog(page)
    fill(d, {"Müşteri adı": "Merit Park Hotel", "Kısa ad": "Merit", "Telefon": "+90 392 650 00 00"})
    save(page)
    page.locator("main").get_by_text("Merit Park Hotel").first.click()
    expect(page.get_by_role("heading", name="Merit Park Hotel", level=1)).to_be_visible()
    page.get_by_role("tab", name="Yetkililer").click()
    page.get_by_role("button", name="Yetkili Ekle").or_(
        page.get_by_role("button", name="Yeni Yetkili")
    ).first.click()
    d = dialog(page)
    fill(d, {"Ad soyad": "Selin Ak", "Unvan": "Etkinlik Müdürü", "Telefon": "+90 533 222 22 22"})
    save(page)
    expect(page.locator("main").get_by_text("Selin Ak").first).to_be_visible()


def test_second_customer(page: Page) -> None:
    goto(page, "/musteriler", "Müşteriler")
    _new(page, "Yeni Müşteri")
    fill(dialog(page), {"Müşteri adı": "Kaya Ailesi"})
    save(page)
    expect(page.locator("main").get_by_text("Kaya Ailesi").first).to_be_visible()


def test_venue(page: Page) -> None:
    goto(page, "/mekanlar")
    _new(page, "Yeni Mekân")
    d = dialog(page)
    fill(d, {"Mekân adı": "Merit Park Balo Salonu", "Kapasite (kişi)": "800", "Şehir": "Girne"})
    choose(d, "Bağlı müşteri", "Merit Park Hotel")
    save(page)
    expect(page.locator("main").get_by_text("Merit Park Balo Salonu").first).to_be_visible()
