from pathlib import Path
import sys

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient

from app.db.database import SessionLocal
from app.main import app
from app.models.artist import Artist, ArtistRiderTemplateItem, ServiceItem
from app.models.service_package import ServicePackage, ServicePackageItem

client = TestClient(app)


def expect_status(response, expected_status: int, label: str):
    if response.status_code != expected_status:
        raise RuntimeError(
            f"{label} failed. Expected {expected_status}, got {response.status_code}. Body: {response.text}"
        )


def cleanup_created_records(ids: dict[str, list[int]]) -> None:
    db = SessionLocal()

    try:
        if ids["package_ids"]:
            db.query(ServicePackageItem).filter(
                ServicePackageItem.package_id.in_(ids["package_ids"])
            ).delete(synchronize_session=False)
            db.query(ServicePackage).filter(
                ServicePackage.id.in_(ids["package_ids"])
            ).delete(synchronize_session=False)

        if ids["artist_ids"]:
            db.query(ArtistRiderTemplateItem).filter(
                ArtistRiderTemplateItem.artist_id.in_(ids["artist_ids"])
            ).delete(synchronize_session=False)
            db.query(Artist).filter(
                Artist.id.in_(ids["artist_ids"])
            ).delete(synchronize_session=False)

        if ids["service_item_ids"]:
            db.query(ServiceItem).filter(
                ServiceItem.id.in_(ids["service_item_ids"])
            ).delete(synchronize_session=False)

        db.commit()
    finally:
        db.close()


def main() -> None:
    route_paths = [route.path for route in app.routes if "service-catalog" in route.path]
    if not route_paths:
        raise RuntimeError("Service catalog routes are not registered.")

    created_ids = {
        "artist_ids": [],
        "service_item_ids": [],
        "package_ids": [],
    }

    try:
        login_response = client.post(
            "/api/v1/auth/login",
            json={
                "email": "admin@viaevents.com",
                "password": "Via12345!",
            },
        )
        expect_status(login_response, 200, "login")

        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        solo_response = client.post(
            "/api/v1/service-catalog/artists",
            headers=headers,
            json={
                "artist_type": "solo_artist",
                "name": "Smoke Solo Sanatçı",
                "manager_partner_id": 1,
                "default_cost_amount": 40000,
                "default_cost_currency": "TRY",
                "default_sale_amount": 65000,
                "default_sale_currency": "TRY",
                "notes": "Smoke test artist",
            },
        )
        expect_status(solo_response, 201, "create solo artist")
        solo_artist_id = solo_response.json()["id"]
        created_ids["artist_ids"].append(solo_artist_id)

        guitarist_response = client.post(
            "/api/v1/service-catalog/artists",
            headers=headers,
            json={
                "artist_type": "musician",
                "name": "Smoke Gitarist",
                "default_cost_amount": 10000,
                "default_cost_currency": "TRY",
                "default_sale_amount": 18000,
                "default_sale_currency": "TRY",
            },
        )
        expect_status(guitarist_response, 201, "create guitarist")
        guitarist_id = guitarist_response.json()["id"]
        created_ids["artist_ids"].append(guitarist_id)

        rider_response = client.post(
            f"/api/v1/service-catalog/artists/{solo_artist_id}/rider",
            headers=headers,
            json={
                "title": "Kulis su ve havlu hazırlığı",
                "description": "Sanatçı gelmeden önce kuliste hazır olmalı.",
                "category": "kulis",
                "sort_order": 1,
                "is_required": True,
            },
        )
        expect_status(rider_response, 201, "create rider item")

        dj_service_response = client.post(
            "/api/v1/service-catalog/services",
            headers=headers,
            json={
                "service_type": "technical_service",
                "name": "Smoke Açılış DJ Hizmeti",
                "default_cost_amount": 15000,
                "default_cost_currency": "TRY",
                "default_sale_amount": 25000,
                "default_sale_currency": "TRY",
            },
        )
        expect_status(dj_service_response, 201, "create service item")
        dj_service_id = dj_service_response.json()["id"]
        created_ids["service_item_ids"].append(dj_service_id)

        usd_service_response = client.post(
            "/api/v1/service-catalog/services",
            headers=headers,
            json={
                "service_type": "lighting_system",
                "name": "Smoke USD Işık Hizmeti",
                "default_cost_amount": 300,
                "default_cost_currency": "USD",
                "default_sale_amount": 500,
                "default_sale_currency": "USD",
            },
        )
        expect_status(usd_service_response, 201, "create USD service item")
        usd_service_id = usd_service_response.json()["id"]
        created_ids["service_item_ids"].append(usd_service_id)

        package_response = client.post(
            "/api/v1/service-catalog/packages",
            headers=headers,
            json={
                "package_type": "program",
                "name": "Smoke Deluxe Gece Programı",
                "description": "DJ + solo sanatçı + gitarist program akışı.",
                "default_sale_amount": 108000,
                "default_sale_currency": "TRY",
            },
        )
        expect_status(package_response, 201, "create service package")
        package_id = package_response.json()["id"]
        created_ids["package_ids"].append(package_id)

        item_ids = []

        for payload, label in [
            (
                {
                    "component_type": "service",
                    "service_item_id": dj_service_id,
                    "program_section": "opening",
                    "sort_order": 1,
                    "start_time": "20:00:00",
                    "end_time": "21:00:00",
                    "quantity": 1,
                    "unit_cost_amount": 15000,
                    "unit_cost_currency": "TRY",
                    "unit_sale_amount": 25000,
                    "unit_sale_currency": "TRY",
                },
                "add dj package item",
            ),
            (
                {
                    "component_type": "artist",
                    "artist_id": solo_artist_id,
                    "program_section": "main_performance",
                    "sort_order": 2,
                    "start_time": "21:30:00",
                    "end_time": "23:00:00",
                    "quantity": 1,
                    "unit_cost_amount": 40000,
                    "unit_cost_currency": "TRY",
                    "unit_sale_amount": 65000,
                    "unit_sale_currency": "TRY",
                },
                "add solo package item",
            ),
            (
                {
                    "component_type": "artist",
                    "artist_id": guitarist_id,
                    "program_section": "support_performance",
                    "sort_order": 3,
                    "start_time": "21:30:00",
                    "end_time": "23:00:00",
                    "quantity": 1,
                    "unit_cost_amount": 10000,
                    "unit_cost_currency": "TRY",
                    "unit_sale_amount": 18000,
                    "unit_sale_currency": "TRY",
                },
                "add guitarist package item",
            ),
            (
                {
                    "component_type": "service",
                    "service_item_id": usd_service_id,
                    "program_section": "technical",
                    "sort_order": 4,
                    "start_time": "19:00:00",
                    "end_time": "23:30:00",
                    "quantity": 1,
                    "unit_cost_amount": 300,
                    "unit_cost_currency": "USD",
                    "unit_sale_amount": 500,
                    "unit_sale_currency": "USD",
                },
                "add USD package item",
            ),
        ]:
            response = client.post(
                f"/api/v1/service-catalog/packages/{package_id}/items",
                headers=headers,
                json=payload,
            )
            expect_status(response, 201, label)
            item_ids.append(response.json()["id"])

        detail_response = client.get(
            f"/api/v1/service-catalog/packages/{package_id}/detail",
            headers=headers,
        )
        expect_status(detail_response, 200, "get package detail")
        detail = detail_response.json()

        assert len(detail["items"]) == 4, detail

        delete_response = client.delete(
            f"/api/v1/service-catalog/packages/{package_id}/items/{item_ids[2]}",
            headers=headers,
        )
        expect_status(delete_response, 200, "delete package item")

        detail_after_delete_response = client.get(
            f"/api/v1/service-catalog/packages/{package_id}/detail",
            headers=headers,
        )
        expect_status(detail_after_delete_response, 200, "get package detail after delete")
        detail_after_delete = detail_after_delete_response.json()

        assert len(detail_after_delete["items"]) == 3, detail_after_delete
        assert all(item["id"] != item_ids[2] for item in detail_after_delete["items"])

        print("Service catalog backend API smoke test passed.")
        print("Registered service catalog routes:", route_paths)
        print("Active item count after delete:", len(detail_after_delete["items"]))
    finally:
        cleanup_created_records(created_ids)


if __name__ == "__main__":
    main()
