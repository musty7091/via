"""Türkçe uyumlu arama.

Kullanıcılar çoğu zaman Türkçe karakter kullanmadan yazar ("kaya dugun").
Her kaydın aranabilir metni `fold` ile sadeleştirilip `search_text` kolonunda
tutulur; arama terimi de aynı şekilde sadeleştirilip karşılaştırılır.
"""

_TURKISH_MAP = str.maketrans(
    {
        "İ": "i",
        "I": "i",
        "ı": "i",
        "Ş": "s",
        "ş": "s",
        "Ğ": "g",
        "ğ": "g",
        "Ü": "u",
        "ü": "u",
        "Ö": "o",
        "ö": "o",
        "Ç": "c",
        "ç": "c",
        "Â": "a",
        "â": "a",
        "Î": "i",
        "î": "i",
        "Û": "u",
        "û": "u",
    }
)


def fold(*parts: str | None) -> str:
    """Metinleri birleştirip Türkçe karakterlerden arındırılmış küçük harfe çevirir."""
    text = " ".join(part for part in parts if part)
    return " ".join(text.translate(_TURKISH_MAP).lower().split())


def search_pattern(term: str) -> str:
    """LIKE sorgusu için güvenli desen (% ve _ karakterleri kaçışlanır)."""
    folded = fold(term).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{folded}%"
