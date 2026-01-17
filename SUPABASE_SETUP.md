# Supabase Kurulum Rehberi

## 1. Paket Kurulumu

```bash
npm install
```

## 2. Environment Variables

`.env.local` dosyasına şu değişkenleri ekleyin:

```env
GEMINI_API_KEY=your_gemini_api_key_here
NEXT_PUBLIC_SUPABASE_URL=https://zggugdxdvpdavogvekor.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable__wQbmJvoflVXB3Mx9Rr8Zw_kOrdYL4F
```

## 3. Supabase Veritabanı Şeması

Supabase Dashboard > SQL Editor'e gidin ve `database-schema.sql` dosyasındaki SQL'i çalıştırın.

Bu şema şunları oluşturur:
- `characters` tablosu (karakterler için)
- `generated_images` tablosu (oluşturulan görseller için)
- `generated_videos` tablosu (oluşturulan videolar için)
- Gerekli indexler

## 4. Özellikler

✅ **Karakterler**: Supabase'de saklanır
✅ **Görseller**: Her görsel prompt ile birlikte kaydedilir
✅ **Videolar**: Her video prompt ile birlikte kaydedilir
✅ **Arşiv**: Arşivlenmiş görseller/videolar ayrı tutulur
✅ **Otomatik Yedekleme**: localStorage yerine Supabase kullanılır
✅ **Fallback**: Supabase bağlantısı yoksa localStorage kullanılır

## 5. Veri Yapısı

### Characters
- `id`: UUID
- `name`: Karakter adı
- `images`: JSON array (base64 görseller)
- `created_at`: Oluşturulma tarihi

### Generated Images
- `id`: String (unique)
- `character_id`: UUID (karakter referansı)
- `url`: Görsel URL (base64 veya blob)
- `name`: Görsel adı
- `prompt`: Kullanılan prompt
- `timestamp`: Oluşturulma zamanı
- `is_archived`: Arşivlenmiş mi?

### Generated Videos
- `id`: String (unique)
- `character_id`: UUID (karakter referansı)
- `url`: Video URL (blob)
- `name`: Video adı
- `prompt`: Kullanılan prompt
- `timestamp`: Oluşturulma zamanı
- `is_archived`: Arşivlenmiş mi?

## 6. Notlar

- Supabase bağlantısı yoksa uygulama localStorage kullanmaya devam eder
- Tüm işlemler Supabase'e kaydedilir
- Karakter silindiğinde, o karaktere ait tüm görseller ve videolar da silinir (CASCADE)
- Prompt bilgisi her görsel/video ile birlikte saklanır
