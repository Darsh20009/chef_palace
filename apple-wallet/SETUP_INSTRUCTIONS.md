# Apple Wallet Setup — Black Rose Cafe

## الملفات الجاهزة ✅

- `CertificateSigningRequest.certSigningRequest` — ارفعه على Apple Developer
- `signer_key.pem` — المفتاح الخاص (احتفظ به سرياً)
- `wwdr.pem` — شهادة Apple العامة (جاهزة)

## الخطوة التالية

### 1. ارفع ملف CSR على Apple Developer
- ارفع ملف `CertificateSigningRequest.certSigningRequest`
- اضغط Continue → Download
- احفظ الملف المُحمَّل باسم `pass.cer` داخل مجلد `apple-wallet/`

### 2. شغّل سكريبت التحويل
```bash
bash apple-wallet/convert_cert.sh
```

### 3. أضف Secrets في Replit
ستجد في الملف `apple-wallet/secrets_to_add.txt` محتوى كل سر تضيفه.

## Secrets المطلوبة

| الاسم | القيمة |
|-------|--------|
| APPLE_PASS_TYPE_ID | pass.sa.blackrose.loyalty |
| APPLE_TEAM_ID | (رقم Team ID من Apple Developer) |
| APPLE_WWDR_PEM | محتوى wwdr.pem |
| APPLE_SIGNER_CERT_PEM | محتوى signer_cert.pem (بعد التحويل) |
| APPLE_SIGNER_KEY_PEM | محتوى signer_key.pem |
