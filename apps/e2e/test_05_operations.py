"""Senaryo 5 — Operasyon: standart görevler, ek görev, rider şartı, etkinlik sonrası rapor."""

from playwright.sync_api import Page, expect

from ui import choose, dialog, fill, goto, save

EVENT_TITLE = "Merit Yaz Gecesi"


def open_event(page: Page, tab: str | None = None, title: str = EVENT_TITLE) -> None:
    goto(page, "/etkinlikler", "Etkinlikler")
    choose(page, "Dönem", "Tümü")
    page.locator("main").get_by_text(title).first.click()
    expect(page.get_by_role("heading", level=1)).to_contain_text(title)
    if tab:
        page.get_by_role("tab", name=tab).click()


def test_standard_tasks_created_and_completed(page: Page) -> None:
    open_event(page, "Operasyon")
    panel = page.get_by_role("tabpanel")
    toggles = panel.get_by_role("button", name="tamamlandı olarak işaretle")
    expect(toggles).to_have_count(7)
    names = [n.split(":")[0] for n in (t.get_attribute("aria-label") or "" for t in toggles.all())]
    for name in names:
        panel.get_by_role("button", name=f"{name}: tamamlandı olarak işaretle").click()
        expect(panel.get_by_role("button", name=f"{name}: tamamlanmadı olarak işaretle")).to_be_visible()
    expect(panel.get_by_role("button", name="tamamlanmadı olarak işaretle")).to_have_count(7)
    expect(panel).to_contain_text("7 / 7")


def test_extra_task(page: Page) -> None:
    open_event(page, "Operasyon")
    page.get_by_role("button", name="Görev Ekle").click()
    d = dialog(page)
    fill(d, {"Görev": "Jeneratör yedeği teyidi", "Son tarih": "2026-09-19"})
    choose(d, "Sorumlu", "Okan Operasyon")
    save(page)
    panel = page.get_by_role("tabpanel")
    expect(panel).to_contain_text("Jeneratör yedeği teyidi")
    expect(panel).to_contain_text("7 / 8")


def test_rider_check(page: Page) -> None:
    open_event(page, "Operasyon")
    page.get_by_role("button", name="Şart Ekle").click()
    fill(dialog(page), {"Şart": "Kulis: 6 şişe su, meyve tabağı"})
    save(page)
    group = page.get_by_role("group", name="Kulis: 6 şişe su, meyve tabağı durumu")
    group.get_by_role("button", name="Tamam").click()
    expect(group.get_by_role("button", name="Tamam")).to_have_attribute("aria-pressed", "true")
    expect(page.get_by_role("tabpanel")).to_contain_text("1 / 1")


def test_operation_report_submitted(page: Page) -> None:
    open_event(page, "Operasyon")
    fill(
        page.get_by_role("tabpanel"),
        {
            "Gerçekleşen kişi sayısı": "385",
            "İyi gidenler": "Ses kalitesi çok iyiydi.",
            "Yaşanan sorunlar": "Sanatçı 20 dk geç geldi.",
        },
    )
    page.get_by_role("button", name="Raporu Teslim Et").click()
    expect(page.get_by_role("tabpanel")).to_contain_text("Teslim edildi")
    expect(page.get_by_role("button", name="Raporu Teslim Et")).to_be_hidden()


def test_operation_sheet_print(page: Page) -> None:
    open_event(page, "Operasyon")
    with page.context.expect_page() as popup:
        page.get_by_role("link", name="Operasyon föyü").click()
    sheet = popup.value
    sheet.wait_for_load_state("networkidle")
    body = sheet.locator("body")
    expect(body).to_contain_text(EVENT_TITLE)
    expect(body).to_contain_text("Jeneratör yedeği teyidi")
    expect(body).to_contain_text("Kulis: 6 şişe su")
    # Operasyon föyünde para bilgisi olmamalı
    expect(body).not_to_contain_text("139.200")
    sheet.close()
