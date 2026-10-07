"""Senaryo 6 — Kapanış: etkinlik finans kapanışı, Eylül dönem kapanışı, kapalı ay kilidi.

Etkinlik kârı 45.000 → her ortağa 15.000. Kâr, kapanışın yapıldığı ayın (Ekim) sonucuna girer.
Eylül genel giderleri: kira 6.000 + iptal edilen 500 (ters kaydı Ekim'e düşer) = 6.500
  → Eylül zararı ortaklara −2.166,67 / −2.166,67 / −2.166,66 (artan kuruş kuruş sırasına göre).
Ekim (açık): etkinlik kârı 45.000 + iptal ters kaydı 500 = 45.500.
"""

import re
from decimal import Decimal

from playwright.sync_api import Page, expect

from test_05_operations import open_event
from ui import amount_after, choose, dialog, fill, form_error, goto, money


def test_event_completed(page: Page) -> None:
    open_event(page)
    page.get_by_role("button", name="Gerçekleşti").click()
    dialog(page).get_by_role("button", name="Gerçekleşti İşaretle").click()
    expect(page.get_by_role("heading", level=1)).to_contain_text("Gerçekleşti")


def test_event_financial_closure(page: Page) -> None:
    open_event(page, "Kapanış")
    panel = page.get_by_role("tabpanel")
    button = panel.get_by_role("button", name="Finans Kapanışı Yap")
    expect(button).to_be_enabled()
    assert amount_after(panel, "Kâr") == Decimal("45000.00")
    for name in ("Alper Aslan", "Volkan Demir", "İbrahim Kaya"):
        expect(panel.get_by_role("listitem").filter(has_text=name)).to_contain_text("15.000,00")
    button.click()
    dialog(page).get_by_role("button", name="Kapanışı Yap").click()
    expect(panel).to_contain_text("Dağıtılan Sonuç")


def test_closed_event_locks_finance(page: Page) -> None:
    """Kapanmış etkinliğe gider girilemez."""
    open_event(page, "Ödemeler")
    page.get_by_role("tabpanel").get_by_role("button", name="Gider Gir").click()
    d = dialog(page)
    fill(d, {"Açıklama": "Geç gelen fatura", "Tarih": "2026-09-29", "Tutar": "100"})
    choose(d, "Kim ödedi?", "Şirket ödedi")
    choose(d, "Hesap", "Merkez Kasa TL")
    d.locator("button[type=submit]").click()
    expect(form_error(d)).to_be_visible()
    d.get_by_role("button", name="Vazgeç").click()


def _select_period(page: Page, label: str) -> None:
    goto(page, "/kapanislar", "Dönem Kapanışları")
    page.get_by_role("button", name=re.compile(rf"^{label}")).click()
    expect(page.get_by_role("heading", name=label, level=2)).to_be_visible()


def test_close_september(page: Page) -> None:
    _select_period(page, "Eylül 2026")
    main = page.locator("main")
    assert amount_after(main, "Bu ay kapanan etkinliklerin kârı") == Decimal("0.00")
    assert amount_after(main, "Genel giderler") == Decimal("-6500.00")
    assert amount_after(main, "Ay sonucu") == Decimal("-6500.00")
    main.get_by_role("button", name="Dönemi Kapat").click()
    dialog(page).get_by_role("button", name="Dönemi Kapat").click()
    expect(page.get_by_role("button", name=re.compile(r"^Eylül 2026 Kapalı"))).to_be_visible()


def test_closed_period_rejects_entries(page: Page) -> None:
    goto(page, "/finans")
    page.get_by_role("button", name="Gider Gir").first.click()
    d = dialog(page)
    fill(d, {"Açıklama": "Eylül'e geç gider", "Tarih": "2026-09-15", "Tutar": "100"})
    choose(d, "Kim ödedi?", "Şirket ödedi")
    choose(d, "Hesap", "Merkez Kasa TL")
    d.locator("button[type=submit]").click()
    error = form_error(d)
    expect(error).to_be_visible()
    expect(error).to_contain_text(re.compile("kapal", re.IGNORECASE))
    d.get_by_role("button", name="Vazgeç").click()


def test_september_shares(page: Page) -> None:
    _select_period(page, "Eylül 2026")
    rows = page.get_by_role("row")
    shares = {
        name: money(rows.filter(has_text=name).get_by_role("cell").nth(1).inner_text())
        for name in ("Alper Aslan", "Volkan Demir", "İbrahim Kaya")
    }
    assert shares == {
        "Alper Aslan": Decimal("-2166.67"),
        "Volkan Demir": Decimal("-2166.67"),
        "İbrahim Kaya": Decimal("-2166.66"),
    }, shares


def test_october_preview(page: Page) -> None:
    _select_period(page, "Ekim 2026")
    main = page.locator("main")
    assert amount_after(main, "Bu ay kapanan etkinliklerin kârı") == Decimal("45000.00")
    assert amount_after(main, "Ay sonucu") == Decimal("45500.00")
    expect(main.get_by_role("button", name="Dönemi Kapat")).to_be_disabled()  # ay bitmedi


def test_partner_accounts(page: Page) -> None:
    """Ortak hesapları: etkinlik payı 15.000 − Eylül zarar payı; Volkan'a ayrıca 12.000 borç."""
    goto(page, "/ortaklar", "Ortaklar")
    text = page.locator("main").inner_text()
    for name, owed in (
        ("Alper Aslan", "12.833,33"),
        ("Volkan Demir", "24.833,33"),
        ("İbrahim Kaya", "12.833,34"),
    ):
        item = page.get_by_role("listitem").filter(has_text=name).last
        expect(item).to_contain_text(owed), text
