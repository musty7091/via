from typing import Any

from pydantic import BaseModel


def update_values(data: BaseModel, required: set[str]) -> dict[str, Any]:
    """PATCH isteğinden gönderilen alanları döner.

    Opsiyonel alanlar `null` gönderilerek temizlenebilir; zorunlu alanlara
    gelen `null` değerler yok sayılır (veritabanında boş kalamazlar).
    """
    values = data.model_dump(exclude_unset=True)
    return {key: value for key, value in values.items() if value is not None or key not in required}
