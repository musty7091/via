"""Senaryo 7 — Roller: ortak, muhasebe ve operasyon kullanıcıları sadece yetkili oldukları işi görür/yapar.

Hem ekran (menü, butonlar) hem de API (doğrudan istek) tarafı denetlenir: buton gizlemek yetmez,
sunucu da reddetmeli.
"""

import re

from playwright.sync_api import Page, expect

from conftest import FORCED_HEADING, personal_password
from test_01_setup import ACCOUNTING_PASSWORD, OPERATION_PASSWORD, PARTNER_PASSWORD
from test_05_operations import open_event

API = "/api/v1"
HEADERS = {"x-requested-with": "via"}
FORBIDDEN = "Bu sayfayı görüntüleme yetkiniz yok"


def _menu(page: Page) -> list[str]:
    return page.get_by_role("navigation", name="Ana menü").get_by_role("link").all_inner_texts()


def _post(page: Page, path: str, data: dict | None = None) -> int:
    return page.request.post(f"{API}{path}", data=data or {}, headers=HEADERS).status


def test_first_login_requires_own_password(browser) -> None:  # noqa: ANN001
    """Yöneticinin açtığı hesap: geçici şifreyle girilir, kendi şifresi belirlenmeden hiçbir
    ekran açılmaz ve sunucu da diğer istekleri reddeder."""
    context = browser.new_context(base_url="http://127.0.0.1:8001", locale="tr-TR")
    page = context.new_page()
    page.goto("/giris")
    page.get_by_label("E-posta").fill("alper@viaevents-e2e.com")
    page.get_by_label("Şifre").fill(PARTNER_PASSWORD)
    page.get_by_role("button", name="Giriş").click()
    expect(page.get_by_role("heading", name=FORCED_HEADING)).to_be_visible()
    expect(page.get_by_role("navigation", name="Ana menü")).to_have_count(0)
    blocked = page.request.get(f"{API}/customers")
    assert blocked.status == 403 and blocked.json()["error"]["code"] == "password_change_required"

    page.get_by_label("Geçici şifre").fill(PARTNER_PASSWORD)
    page.get_by_label("Yeni şifre", exact=True).fill(PARTNER_PASSWORD)
    page.get_by_label("Yeni şifre (tekrar)").fill(PARTNER_PASSWORD)
    page.get_by_role("button", name="Şifremi Kaydet").click()
    expect(page.get_by_text("Yeni şifre mevcut şifreden farklı olmalı.")).to_be_visible()

    new = personal_password(PARTNER_PASSWORD)
    page.get_by_label("Yeni şifre", exact=True).fill(new)
    page.get_by_label("Yeni şifre (tekrar)").fill(new)
    page.get_by_role("button", name="Şifremi Kaydet").click()
    expect(page.get_by_role("navigation", name="Ana menü")).to_be_visible()
    assert page.request.get(f"{API}/customers").status == 200
    context.close()


def test_users_list_shows_temporary_passwords(page: Page) -> None:
    page.goto("/kullanicilar")
    rows = page.get_by_role("row")
    expect(rows.filter(has_text="alper@")).to_contain_text("Aktif")
    expect(rows.filter(has_text="volkan@")).to_contain_text("Geçici şifre")


def test_partner(new_user_page) -> None:  # noqa: ANN001
    page: Page = new_user_page("alper@viaevents-e2e.com", personal_password(PARTNER_PASSWORD))
    menu = _menu(page)
    for allowed in ("Teklifler", "Etkinlikler", "Finans Merkezi", "Raporlar"):
        assert any(allowed in m for m in menu), (allowed, menu)
    for hidden in ("Kullanıcılar", "Ayarlar", "İşlem Geçmişi"):
        assert not any(hidden in m for m in menu), (hidden, menu)

    page.goto("/kullanicilar")
    expect(page.get_by_text(FORBIDDEN)).to_be_visible()

    # Finansı görür ama kayıt giremez
    page.goto("/finans")
    expect(page.get_by_role("heading", name="Finans Merkezi")).to_be_visible()
    expect(page.get_by_role("button", name="Tahsilat Gir")).to_have_count(0)
    expect(page.get_by_role("button", name="Gider Gir")).to_have_count(0)

    # Satış yapabilir
    page.goto("/teklifler")
    expect(page.get_by_role("button", name="Yeni Teklif").first).to_be_visible()

    # Sunucu da reddeder
    assert _post(page, "/finance/expenses", {"description": "x", "amount": "1"}) == 403
    assert _post(page, "/closing/periods/2026-10/close") == 403
    assert _post(page, "/users", {"full_name": "x", "email": "x@viaevents-e2e.com"}) == 403


def test_accounting(new_user_page) -> None:  # noqa: ANN001
    page: Page = new_user_page("muhasebe@viaevents-e2e.com", ACCOUNTING_PASSWORD, forced=True)
    page.goto("/finans")
    expect(page.get_by_role("button", name="Tahsilat Gir").first).to_be_visible()
    expect(page.get_by_role("button", name="Gider Gir").first).to_be_visible()

    # Teklif hazırlayamaz
    page.goto("/teklifler")
    expect(page.locator("main")).to_be_visible()
    expect(page.get_by_role("button", name="Yeni Teklif")).to_have_count(0)

    # Dönem kapatamaz, etkinlik kapanışını onaylayamaz
    page.goto("/kapanislar")
    expect(page.get_by_role("button", name="Dönemi Kapat")).to_have_count(0)
    assert _post(page, "/closing/periods/2026-10/close") == 403
    assert _post(page, "/closing/events/1/reopen") == 403


def test_operation(new_user_page) -> None:  # noqa: ANN001
    page: Page = new_user_page("operasyon@viaevents-e2e.com", OPERATION_PASSWORD, forced=True)
    menu = _menu(page)
    for hidden in ("Finans Merkezi", "Teklifler", "Raporlar", "Ortaklar"):
        assert not any(hidden in m for m in menu), (hidden, menu)
    open_event(page)
    tabs = page.get_by_role("tab").all_inner_texts()
    assert not any(t.startswith(("Ödemeler", "Kapanış")) for t in tabs), tabs
    # Para bilgisi görmez
    expect(page.locator("main")).not_to_contain_text("139.200")
    expect(page.locator("main")).not_to_contain_text("Tahmini kâr")
    # API de maliyeti vermez
    assert page.request.get(f"{API}/finance/events/1").status in (403, 404)
    page.goto("/finans")
    expect(page.get_by_text(FORBIDDEN)).to_be_visible()


def test_wrong_password_and_logout(browser) -> None:  # noqa: ANN001
    context = browser.new_context(base_url="http://127.0.0.1:8001")
    page = context.new_page()
    page.goto("/giris")
    page.get_by_label("E-posta").fill("alper@viaevents-e2e.com")
    page.get_by_label("Şifre").fill("yanlis-sifre")
    page.get_by_role("button", name="Giriş").click()
    expect(page.get_by_role("alert")).to_contain_text(re.compile("hatal|yanlış|geçersiz", re.IGNORECASE))
    expect(page).to_have_url("http://127.0.0.1:8001/giris")
    context.close()


def test_logout(new_user_page) -> None:  # noqa: ANN001
    page: Page = new_user_page("ibrahim@viaevents-e2e.com", PARTNER_PASSWORD, forced=True)
    page.get_by_role("button", name="İbrahim Kaya").or_(
        page.get_by_role("button", name="Hesap menüsü")
    ).first.click()
    page.get_by_role("menuitem", name="Çıkış yap").click()
    expect(page).to_have_url("http://127.0.0.1:8001/giris")
    page.goto("/finans")
    expect(page).to_have_url(re.compile(r"/giris\?next=%2Ffinans$"))
