"""Senaryo 10 — Düzeltmeler: kapanışı geri alma, dönemi yeniden açma, şifre sıfırlama, teklif kopyalama.

Geri alınıp yeniden yapılan her işlem sonunda bakiyeler aynı kalmalı.
"""

import re
from decimal import Decimal

from playwright.sync_api import Page, expect

from test_05_operations import open_event
from ui import amount_after, dialog, field, fill, form_error, goto, money


def _partner_owed(page: Page) -> dict[str, str]:
    goto(page, "/ortaklar", "Ortaklar")
    expect(page.locator("main")).to_contain_text("Şirketin ona borcu")
    return {
        name: page.get_by_role("listitem").filter(has_text=name).last.inner_text()
        for name in ("Alper Aslan", "Volkan Demir", "İbrahim Kaya")
    }


def _undo_closure(page: Page) -> None:
    open_event(page, "Kapanış")
    page.get_by_role("tabpanel").get_by_role("button", name="Kapanışı geri al").click()
    d = dialog(page)
    field(d, "Sebep").fill("Kontrol için geri alındı")
    d.get_by_role("button", name="Geri Al").click()


def _set_september(page: Page, action: str) -> None:
    goto(page, "/kapanislar", "Dönem Kapanışları")
    page.get_by_role("button", name=re.compile(r"^Eylül 2026")).click()
    page.locator("main").get_by_role("button", name=action).click()
    d = dialog(page)
    if field(d, "Sebep").count():
        field(d, "Sebep").fill("Kontrol")
    d.get_by_role("button", name=action).click()
    state = "Açık" if action == "Dönemi Aç" else "Kapalı"
    expect(page.get_by_role("button", name=re.compile(rf"^Eylül 2026 {state}"))).to_be_visible()


def test_closure_of_closed_month_needs_period_reopen(page: Page) -> None:
    """Kâr Eylül'e yazıldı ve Eylül kapalı: kapanış geri alınamaz, önce dönem açılmalı."""
    _undo_closure(page)
    d = dialog(page)
    expect(form_error(d)).to_contain_text("yeniden açın")
    d.get_by_role("button", name="Vazgeç").click()


def test_reopen_period_undo_and_redo_closure(page: Page) -> None:
    before = _partner_owed(page)
    _set_september(page, "Dönemi Aç")
    _undo_closure(page)
    panel = page.get_by_role("tabpanel")
    expect(panel.get_by_role("button", name="Finans Kapanışı Yap")).to_be_enabled()
    panel.get_by_role("button", name="Finans Kapanışı Yap").click()
    dialog(page).get_by_role("button", name="Kapanışı Yap").click()
    expect(panel).to_contain_text("Dağıtılan Sonuç")
    _set_september(page, "Dönemi Kapat")
    assert _partner_owed(page) == before


def test_admin_resets_password(page: Page, new_user_page) -> None:  # noqa: ANN001
    goto(page, "/kullanicilar", "Kullanıcılar")
    page.get_by_role("button", name="Volkan Demir işlemleri").click()
    page.get_by_role("menuitem", name="Şifre sıfırla").click()
    d = dialog(page)
    fill(d, {"Yeni şifre": "Volkan-Yeni-2026!"})
    d.locator("button[type=submit]").click()
    expect(d).to_be_hidden()
    other: Page = new_user_page("volkan@viaevents-e2e.com", "Volkan-Yeni-2026!", forced=True)
    expect(other.get_by_role("navigation", name="Ana menü")).to_be_visible()


def test_short_password_rejected(page: Page) -> None:
    goto(page, "/kullanicilar", "Kullanıcılar")
    page.get_by_role("button", name="Volkan Demir işlemleri").click()
    page.get_by_role("menuitem", name="Şifre sıfırla").click()
    d = dialog(page)
    fill(d, {"Yeni şifre": "kisa"})
    d.locator("button[type=submit]").click()
    expect(d).to_be_visible()
    expect(d).to_contain_text("10")
    d.get_by_role("button", name="Vazgeç").click()


def test_duplicate_offer(page: Page) -> None:
    goto(page, "/teklifler", "Teklifler")
    page.locator("main").get_by_text("Merit Yaz Gecesi").first.click()
    page.get_by_role("button", name="Diğer işlemler").click()
    page.get_by_role("menuitem", name="Kopyasını oluştur").click()
    expect(page.get_by_role("heading", level=1)).to_contain_text("Taslak")
    main = page.locator("main")
    expect(main).to_contain_text("Deniz Yıldız")
    assert amount_after(main, "Genel toplam") == Decimal("139200.00")
    expect(page.get_by_role("button", name="Düzenle", exact=True)).to_be_visible()


def test_cash_unchanged_after_corrections(page: Page) -> None:
    goto(page, "/finans/kasa")
    main = page.locator("main")

    def balance(name: str) -> Decimal:
        return money(
            main.get_by_text(name).first.locator("xpath=ancestor::li[1]|ancestor::tr[1]").first.inner_text()
        )

    assert balance("İş Bankası TL") == Decimal("24000.00")
    assert balance("Merkez Kasa TL") == Decimal("46200.00")
