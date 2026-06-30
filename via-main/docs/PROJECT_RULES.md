# VIA EVENTS Proje Kuralları

Bu dosya projenin çalışma disiplinini belirler.

## Genel Kurallar

- Proje aceleye getirilmeyecektir.
- Önce doğru mimari, sonra kod yazılacaktır.
- Çalışan yapı korunacaktır.
- Gereksiz refactor yapılmayacaktır.
- Her değişiklikten sonra test adımları uygulanacaktır.
- Para, tahsilat, gider ve ortaklık hesaplarında veri bütünlüğü korunacaktır.

## Kodlama Kuralları

- Backend ve frontend ayrı tutulacaktır.
- Gizli bilgiler `.env` dosyalarında tutulacaktır.
- `.env` dosyaları GitHub'a gönderilmeyecektir.
- Silme işlemi yerine mümkün olduğunca pasife alma veya iptal kaydı kullanılacaktır.
- Kritik işlemler audit log ile kayıt altına alınacaktır.
- Kapanmış dönemlerde doğrudan değişiklik yapılmayacaktır.

## Çalışma Bilgisayarı Kuralları

Her iki bilgisayarda proje yolu aynı olacaktır:

```text
C:\via
```

Çalışmaya başlamadan önce:

```powershell
git pull
```

Çalışma sonunda:

```powershell
git add .
git commit -m "Aciklayici commit mesaji"
git push
```
