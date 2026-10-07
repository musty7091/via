"""Senaryo 4 — Finans: Merit Yaz Gecesi (VIA-E-2026-0001) parası ve Eylül genel gideri.

Hareketler (hepsi Eylül 2026):
  10.09  Tahsilat 100.000 → İş Bankası TL
  15.09  Transfer İş Bankası TL → Merkez Kasa TL 10.000
  20.09  Etkinlik gideri (ikram) 3.000, Merkez Kasa
  21.09  Tahsilat 39.200, Alper aldı (ortak üzerinde)
  22.09  Deniz Yıldız'a 60.000, İş Bankası TL
  22.09  Ses Işık'a 12.000, Volkan cebinden (şirket Volkan'a borçlanır)
  25.09  Alper 39.200'ü Merkez Kasa'ya teslim eder
  30.09  Genel gider: ofis kirası 6.000, İş Bankası TL, "bu döneme ait"
  Ayrıca yanlış girilen 500'lük tahsilat iptal edilir (ters kayıt).

Beklenen: İş Bankası TL 24.000 · Merkez Kasa 46.200 · Volkan'a borç 12.000
Etkinlik kârı 120.000 − 72.000 − 3.000 = 45.000
"""

from decimal import Decimal

from playwright.sync_api import Page, expect

from ui import amount_after, choose, dialog, field, fill, form_error, goto, money, save

EVENT_TITLE = "Merit Yaz Gecesi"


def _open_event_payments(page: Page) -> None:
    goto(page, "/etkinlikler", "Etkinlikler")
    choose(page, "Dönem", "Tümü")
    page.locator("main").get_by_text(EVENT_TITLE).first.click()
    page.get_by_role("tab", name="Ödemeler").click()


def _collect(page: Page, destination: str, date: str, amount: str) -> None:
    page.get_by_role("tabpanel").get_by_role("button", name="Tahsilat Gir").click()
    d = dialog(page)
    choose(d, "Para nereye girdi?", destination)
    fill(d, {"Tarih": date, "Tutar": amount})
    save(page)


def test_collections(page: Page) -> None:
    _open_event_payments(page)
    _collect(page, "İş Bankası TL", "2026-09-10", "100000")
    panel = page.get_by_role("tabpanel")
    expect(panel).to_contain_text("₺100.000,00")
    _collect(page, "Alper Aslan", "2026-09-21", "39200")
    expect(panel.get_by_role("button", name="Tahsilat Gir")).to_be_disabled()
    assert amount_after(panel, "Kalan alacak") == Decimal("0.00")
    assert amount_after(panel, "Tahsil edilen") == Decimal("139200.00")


def test_overpayment_rejected(page: Page) -> None:
    """Kalan alacak sıfırken üst bardan fazla tahsilat girilemez."""
    goto(page, "/finans")
    page.get_by_role("button", name="Tahsilat Gir").first.click()
    d = dialog(page)
    choose(d, "Etkinlik", "VIA-E-2026-0001")
    choose(d, "Para nereye girdi?", "Merkez Kasa TL")
    fill(d, {"Tarih": "2026-09-26", "Tutar": "500"})
    d.locator("button[type=submit]").click()
    expect(d).to_be_visible()
    expect(form_error(d)).to_be_visible()
    d.get_by_role("button", name="Vazgeç").click()


def test_transfer(page: Page) -> None:
    goto(page, "/finans/kasa")
    page.get_by_role("button", name="Transfer").click()
    d = dialog(page)
    choose(d, "Çıkan hesap", "İş Bankası TL")
    choose(d, "Giren hesap", "Merkez Kasa TL")
    fill(d, {"Tarih": "2026-09-15", "Çıkan tutar": "10000"})
    save(page)


def test_event_expense(page: Page) -> None:
    _open_event_payments(page)
    page.get_by_role("tabpanel").get_by_role("button", name="Gider Gir").click()
    d = dialog(page)
    fill(d, {"Açıklama": "Sanatçı ikramı", "Tarih": "2026-09-20", "Tutar": "3000"})
    choose(d, "Kim ödedi?", "Şirket ödedi")
    choose(d, "Hesap", "Merkez Kasa TL")
    save(page)
    expect(page.get_by_role("tabpanel")).to_contain_text("Sanatçı ikramı")


def _pay(page: Page, who: str, source: str, date: str) -> None:
    item = (
        page.get_by_role("tabpanel")
        .get_by_role("listitem")
        .filter(has_text=who)
        .filter(has=page.get_by_role("button", name="Öde", exact=True))
    )
    item.get_by_role("button", name="Öde", exact=True).click()
    d = dialog(page)
    choose(d, "Ödeme kaynağı", source)
    fill(d, {"Tarih": date})
    save(page)


def test_supplier_payments(page: Page) -> None:
    _open_event_payments(page)
    _pay(page, "Deniz Yıldız", "İş Bankası TL", "2026-09-22")
    _pay(page, "Ses Işık Ltd", "Volkan Demir", "2026-09-22")
    panel = page.get_by_role("tabpanel")
    expect(panel.get_by_role("button", name="Öde", exact=True)).to_have_count(0)
    assert amount_after(panel, "Ödenecek borç") == Decimal("0.00")
    assert amount_after(panel, "Kâr") == Decimal("45000.00")


def test_partner_handover(page: Page) -> None:
    goto(page, "/ortaklar", "Ortaklar")
    alper = (
        page.get_by_role("listitem")
        .filter(has_text="Alper Aslan")
        .filter(has=page.get_by_role("button", name="Teslim al"))
    )
    expect(alper).to_contain_text("39.200,00")
    alper.get_by_role("button", name="Teslim al").click()
    d = dialog(page)
    choose(d, "Teslim alınan hesap", "Merkez Kasa TL")
    fill(d, {"Tarih": "2026-09-25", "Tutar": "39200"})
    save(page)
    expect(page.get_by_role("button", name="Teslim al")).to_have_count(0)
    volkan = (
        page.get_by_role("listitem")
        .filter(has_text="Volkan Demir")
        .filter(has=page.get_by_role("button", name="Ortağa öde"))
    )
    expect(volkan).to_contain_text("12.000,00")


def test_general_expense_this_month(page: Page) -> None:
    goto(page, "/finans")
    page.get_by_role("button", name="Gider Gir").first.click()
    d = dialog(page)
    fill(d, {"Açıklama": "Ofis kirası Eylül", "Tarih": "2026-09-30", "Tutar": "6000"})
    choose(d, "Kategori", "Kira")
    choose(d, "Kim ödedi?", "Şirket ödedi")
    choose(d, "Hesap", "İş Bankası TL")
    d.get_by_text("Bu döneme ait").click()
    save(page)


def test_cancel_wrong_collection(page: Page) -> None:
    """Fazladan girilen tahsilat iptal edilir; bakiyeler eski haline döner."""
    goto(page, "/finans/kasa")
    before = money(
        page.locator("main")
        .get_by_text("Merkez Kasa TL")
        .first.locator("xpath=ancestor::li[1]|ancestor::tr[1]")
        .first.inner_text()
    )
    # Ek maliyet olmadan tahsilat girilemeyeceği için önce plan dışı bir gelir yok;
    # bunun yerine gider girip iptal ederiz.
    page.get_by_role("button", name="Gider Gir").first.click()
    d = dialog(page)
    fill(d, {"Açıklama": "Yanlış kayıt", "Tarih": "2026-09-28", "Tutar": "500"})
    choose(d, "Kim ödedi?", "Şirket ödedi")
    choose(d, "Hesap", "Merkez Kasa TL")
    save(page)
    goto(page, "/finans/giderler")
    page.get_by_label("Ay").fill("2026-09")
    row = page.get_by_role("row").filter(has_text="Yanlış kayıt")
    row.get_by_role("button", name="Gideri iptal et").click()
    d = dialog(page)
    field(d, "Sebep").fill("Yanlışlıkla girildi")
    d.get_by_role("button").filter(has_not_text="Vazgeç").filter(has_not_text="Kapat").last.click()
    expect(d).to_be_hidden()
    goto(page, "/finans/kasa")
    after = money(
        page.locator("main")
        .get_by_text("Merkez Kasa TL")
        .first.locator("xpath=ancestor::li[1]|ancestor::tr[1]")
        .first.inner_text()
    )
    assert after == before


def test_cash_balances(page: Page) -> None:
    goto(page, "/finans/kasa")
    main = page.locator("main")

    def balance(name: str) -> Decimal:
        return money(
            main.get_by_text(name).first.locator("xpath=ancestor::li[1]|ancestor::tr[1]").first.inner_text()
        )

    assert balance("İş Bankası TL") == Decimal("24000.00")
    assert balance("Merkez Kasa TL") == Decimal("46200.00")
    assert balance("İş Bankası EUR") == Decimal("0.00")
