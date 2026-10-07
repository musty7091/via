"""Senaryo 1 — İlk kurulum: firma ayarları, kullanıcılar, ortaklar, kasa/banka hesapları."""

from playwright.sync_api import Page, expect

from ui import choose, dialog, field, fill, form_error, goto, save, submit, toast

PARTNER_PASSWORD = "Ortak-Gecici-2026!"
ACCOUNTING_PASSWORD = "Muhasebe-Gecici-2026!"
OPERATION_PASSWORD = "Operasyon-Gecici-2026!"


def test_company_settings(page: Page) -> None:
    goto(page, "/ayarlar", "Ayarlar")
    fill(
        page,
        {
            "Ticari unvan": "VIA EVENTS LTD",
            "Telefon": "+90 548 000 00 00",
            "Vergi dairesi": "Lefkoşa",
            "Vergi no": "MŞ-12345",
            "IBAN": "TR00 0000 0000 0000 0000 0000 00",
        },
    )
    choose(page, "Sezon başlangıç ayı", "Nisan")
    page.get_by_role("button", name="Kaydet").click()
    toast(page, "kaydedildi")
    page.reload()
    expect(field(page, "Vergi no")).to_have_value("MŞ-12345")
    expect(field(page, "Sezon başlangıç ayı")).to_have_value("4")


def _create_user(page: Page, name: str, email: str, role: str, password: str) -> None:
    page.get_by_role("button", name="Yeni Kullanıcı").click()
    d = dialog(page)
    fill(d, {"Ad soyad": name, "E-posta": email, "Geçici şifre": password})
    choose(d, "Rol", role)
    save(page)
    expect(page.get_by_role("row").filter(has_text=email)).to_be_visible()


def test_users(page: Page) -> None:
    goto(page, "/kullanicilar", "Kullanıcılar")
    for name, slug in (("Alper Aslan", "alper"), ("Volkan Demir", "volkan"), ("İbrahim Kaya", "ibrahim")):
        _create_user(page, name, f"{slug}@viaevents-e2e.com", "Ortak", PARTNER_PASSWORD)
    _create_user(page, "Ayşe Muhasebe", "muhasebe@viaevents-e2e.com", "Muhasebe", ACCOUNTING_PASSWORD)
    _create_user(page, "Okan Operasyon", "operasyon@viaevents-e2e.com", "Operasyon", OPERATION_PASSWORD)
    expect(page.get_by_role("row")).to_have_count(7)  # başlık + 6 kullanıcı


def test_duplicate_user_email_rejected(page: Page) -> None:
    goto(page, "/kullanicilar", "Kullanıcılar")
    page.get_by_role("button", name="Yeni Kullanıcı").click()
    d = dialog(page)
    fill(d, {"Ad soyad": "Tekrar", "E-posta": "alper@viaevents-e2e.com", "Geçici şifre": PARTNER_PASSWORD})
    choose(d, "Rol", "İzleyici")
    submit(page)
    expect(d).to_be_visible()
    expect(form_error(d)).to_be_visible()
    d.get_by_role("button", name="Vazgeç").click()


def test_partners(page: Page) -> None:
    goto(page, "/ortaklar", "Ortaklar")
    for order, name in enumerate(("Alper Aslan", "Volkan Demir", "İbrahim Kaya"), start=1):
        page.get_by_role("button", name="Yeni Ortak").click()
        d = dialog(page)
        fill(d, {"Ad soyad": name, "Kuruş sırası": str(order)})
        choose(d, "Kullanıcı hesabı", name)
        save(page)
        toast(page, "Ortak eklendi")
    for name in ("Alper Aslan", "Volkan Demir", "İbrahim Kaya"):
        expect(page.locator("main").get_by_text(name).first).to_be_visible()


def test_cash_accounts(page: Page) -> None:
    goto(page, "/finans/kasa")
    for name, kind, currency in (
        ("Merkez Kasa TL", "Kasa (nakit)", "TL"),
        ("İş Bankası TL", "Banka", "TL"),
        ("İş Bankası EUR", "Banka", "Euro"),
    ):
        page.get_by_role("button", name="Hesap", exact=True).click()
        d = dialog(page)
        fill(d, {"Hesap adı": name})
        choose(d, "Tür", kind)
        choose(d, "Para birimi", currency)
        save(page)
        expect(page.locator("main").get_by_text(name).first).to_be_visible()
