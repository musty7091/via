"""Senaryo 10 — Düzeltmeler: kapanışı geri alma, dönemi yeniden açma, şifre sıfırlama, teklif kopyalama.

Geri alınıp yeniden yapılan her işlem sonunda bakiyeler aynı kalmalı.
"""

import re
from decimal import Decimal

from playwright.sync_api import Page, expect

from test_05_operations import open_event
from ui import amount_after, dialog, field, fill, goto, money


def _partner_owed(page: Page) -> dict[str, str]:
    goto(page, "/ortaklar", "Ortaklar")
    expect(page.locator("main")).to_contain_text("Şirketin ona borcu")
    return {
        name: page.get_by_role("listitem").filter(has_text=name).last.inner_text()
        for name in ("Alper Aslan", "Volkan Demir", "İbrahim Kaya")
    }


def test_event_closure_undo_redo(page: Page) -> None:
    before = _partner_owed(page)
    open_event(page, "Kapanış")
    panel = page.get_by_role("tabpanel")
    panel.get_by_role("button", name="Kapanışı Geri Al").or_(
        panel.get_by_role("button", name="Geri Al")
    ).first.click()
    d = dialog(page)
    if field(d, "Sebep").count():
        field(d, "Sebep").fill("Kontrol için geri alındı")
    d.get_by_role("button", name="Geri Al").click()
    expect(panel.get_by_role("button", name="Finans Kapanışı Yap")).to_be_enabled()
    panel.get_by_role("button", name="Finans Kapanışı Yap").click()
    dialog(page).get_by_role("button", name="Kapanışı Yap").click()
    expect(panel).to_contain_text("Dağıtılan Sonuç")
    assert _partner_owed(page) == before


def test_period_reopen_and_close_again(page: Page) -> None:
    before = _partner_owed(page)
    goto(page, "/kapanislar", "Dönem Kapanışları")
    page.get_by_role("button", name=re.compile(r"^Eylül 2026")).click()
    page.get_by_role("button", name="Dönemi Aç").or_(
        page.get_by_role("button", name="Yeniden Aç")
    ).first.click()
    d = dialog(page)
    if field(d, "Sebep").count():
        field(d, "Sebep").fill("Kontrol")
    d.get_by_role("button", name="Dönemi Aç").click()
    expect(page.get_by_role("button", name=re.compile(r"^Eylül 2026 Açık"))).to_be_visible()
    page.locator("main").get_by_role("button", name="Dönemi Kapat").click()
    dialog(page).get_by_role("button", name="Dönemi Kapat").click()
    expect(page.get_by_role("button", name=re.compile(r"^Eylül 2026 Kapalı"))).to_be_visible()
    assert _partner_owed(page) == before


def test_admin_resets_password(page: Page, new_user_page) -> None:  # noqa: ANN001
    goto(page, "/kullanicilar", "Kullanıcılar")
    page.get_by_role("button", name="Volkan Demir işlemleri").click()
    page.get_by_role("menuitem", name="Şifre sıfırla").click()
    d = dialog(page)
    fill(d, {"Yeni şifre": "Volkan-Yeni-2026!"})
    d.locator("button[type=submit]").click()
    expect(d).to_be_hidden()
    other: Page = new_user_page("volkan@viaevents-e2e.com", "Volkan-Yeni-2026!")
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


def test_cancel_event_with_deposit_is_blocked(page: Page) -> None:
    """Tahsilatı olan etkinlik iptal edilemez; mesaj ne yapılacağını söyler.
    Not: kapora iadesi / yanan kapora için ayrı bir akış henüz yok."""
    open_event(page, title="Kaya Ailesi Nişanı")
    page.get_by_role("button", name="İptal Et").click()
    d = dialog(page)
    fill(d, {"İptal sebebi": "Müşteri vazgeçti"})
    d.get_by_role("button", name="Etkinliği İptal Et").click()
    expect(d).to_contain_text("aktif tahsilat")
    d.get_by_role("button", name="Vazgeç").click()
    expect(page.get_by_role("heading", level=1)).to_contain_text("Planlandı")
