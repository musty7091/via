"""Uçtan uca testler: gerçek tarayıcı, derlenmiş ön yüz, boş `via_e2e` veritabanı.

Senaryolar dosya sırasıyla çalışır ve birbirinin bıraktığı veriye dayanır
(kurulum → katalog → satış → finans → operasyon → kapanış → roller → raporlar).
Çalıştırma: `bash run.sh` (veritabanını sıfırlar, sunucuyu başlatır, testleri koşar).
"""

import os
import re
from collections.abc import Iterator
from pathlib import Path

import pytest
from playwright.sync_api import Browser, BrowserContext, Page, expect

BASE_URL = os.environ.get("E2E_BASE_URL", "http://127.0.0.1:8001")
ADMIN_EMAIL = "admin@viaevents-e2e.com"
ADMIN_PASSWORD = "E2e-Admin-2026!"
ARTIFACTS = Path(__file__).parent / "artifacts"

expect.set_options(timeout=10_000)


FORCED_HEADING = "Kendi şifrenizi belirleyin"


def personal_password(temporary: str) -> str:
    """Kullanıcının ilk girişte belirlediği kendi şifresi (testlerde geçici şifreden türetilir)."""
    return f"{temporary}-Kendi"


def login(page: Page, email: str, password: str, *, forced: bool = False) -> None:
    """Giriş yapar. `forced`: yöneticinin verdiği geçici şifreyle ilk giriş; şifre değiştirme
    ekranı beklenir ve kişisel şifre belirlenir."""
    page.goto(f"{BASE_URL}/giris")
    page.get_by_label("E-posta").fill(email)
    page.get_by_label("Şifre").fill(password)
    page.get_by_role("button", name="Giriş").click()
    expect(page).not_to_have_url(re.compile(r"/giris"))
    if forced:
        expect(page.get_by_role("heading", name=FORCED_HEADING)).to_be_visible()
        page.get_by_label("Geçici şifre").fill(password)
        page.get_by_label("Yeni şifre", exact=True).fill(personal_password(password))
        page.get_by_label("Yeni şifre (tekrar)").fill(personal_password(password))
        page.get_by_role("button", name="Şifremi Kaydet").click()
    expect(page.get_by_role("navigation").first).to_be_visible()


def _watch_errors(page: Page, errors: list[str]) -> None:
    page.on("pageerror", lambda exc: errors.append(f"pageerror: {exc}"))

    def on_console(msg) -> None:  # noqa: ANN001
        # Beklenen 4xx yanıtları (doğrulama hataları) tarayıcı konsoluna da düşer; onları sayma.
        if msg.type == "error" and "Failed to load resource" not in msg.text:
            errors.append(f"console: {msg.text}")

    page.on("console", on_console)

    def on_response(resp) -> None:  # noqa: ANN001
        if resp.status >= 500:
            errors.append(f"HTTP {resp.status} {resp.request.method} {resp.url}")

    page.on("response", on_response)


@pytest.fixture(scope="session")
def admin_context(browser: Browser) -> Iterator[BrowserContext]:
    context = browser.new_context(base_url=BASE_URL, viewport={"width": 1440, "height": 900}, locale="tr-TR")
    page = context.new_page()
    login(page, ADMIN_EMAIL, ADMIN_PASSWORD)
    page.close()
    yield context
    context.close()


@pytest.fixture
def page(admin_context: BrowserContext, request: pytest.FixtureRequest) -> Iterator[Page]:
    """Yönetici oturumuyla açılmış sayfa. Test sonunda JS/500 hatası varsa test başarısız olur."""
    page = admin_context.new_page()
    errors: list[str] = []
    _watch_errors(page, errors)
    yield page
    failed = getattr(request.node, "rep_call", None) and request.node.rep_call.failed
    if failed:
        ARTIFACTS.mkdir(exist_ok=True)
        name = re.sub(r"[^\w]+", "_", request.node.name)
        page.screenshot(path=str(ARTIFACTS / f"{name}.png"), full_page=True)
        (ARTIFACTS / f"{name}.aria.txt").write_text(
            page.url + "\n" + page.locator("body").aria_snapshot(), encoding="utf-8"
        )
    page.close()
    assert not errors, "Tarayıcı hataları:\n" + "\n".join(errors)


@pytest.fixture
def new_user_page(browser: Browser) -> Iterator:
    """Başka bir kullanıcıyla giriş yapmak için temiz sayfa üretir."""
    contexts: list[BrowserContext] = []

    def make(email: str, password: str, *, forced: bool = False) -> Page:
        context = browser.new_context(
            base_url=BASE_URL, viewport={"width": 1440, "height": 900}, locale="tr-TR"
        )
        contexts.append(context)
        page = context.new_page()
        login(page, email, password, forced=forced)
        return page

    yield make
    for context in contexts:
        context.close()


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):  # noqa: ANN001, ANN201
    outcome = yield
    report = outcome.get_result()
    setattr(item, f"rep_{report.when}", report)
