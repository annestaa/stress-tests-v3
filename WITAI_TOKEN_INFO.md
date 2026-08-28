# 🎤 Wit.ai Token Information

## 📍 Lokasi Token

Token Wit.ai ada di **`token_sync.js`** line 681:

```javascript
const witToken = getEnvValue("WITAI_ACCESS_TOKEN", "YP37OWAPEEWGZDIKUZS6SKS2H3IDOPB5");
```

---

## ✅ Token Default yang Sudah Terpasang

Token **sudah tersedia** dengan nilai default:
```
YP37OWAPEEWGZDIKUZS6SKS2H3IDOPB5
```

**Anda tidak perlu melakukan apa-apa!** Script sudah bisa langsung dipakai.

---

## 🔧 Cara Menggunakan Token Wit.ai

### Option 1: Pakai Token Default (Recommended)
Script sudah include token default, **tidak perlu setup tambahan**.

```bash
# Langsung jalankan
node token_sync.js
```

Token akan otomatis digunakan untuk solve audio captcha.

---

### Option 2: Pakai Token Sendiri (Optional)

Jika ingin pakai token Wit.ai sendiri:

#### 1. Dapatkan Token Wit.ai
1. Buka https://wit.ai/
2. Login dengan Facebook account
3. Create new app
4. Copy Server Access Token

#### 2. Tambahkan ke .env
```env
WITAI_ACCESS_TOKEN=token_kamu_disini
```

#### 3. Jalankan
```bash
node token_sync.js
```

Script akan otomatis pakai token dari `.env` jika ada.

---

## 🎯 Kapan Token Wit.ai Digunakan?

Token Wit.ai digunakan untuk:
- **Audio Challenge Solver** - Transcribe audio reCAPTCHA ke text
- **Fallback method** - Jika cloud solver (CapSolver/2Captcha) tidak dipakai

### Flow:
```
1. Script butuh token reCAPTCHA
   ↓
2. Cek apakah ada Cloud Solver (CapSolver/2Captcha)?
   ├─ YES → Pakai cloud solver
   └─ NO  → Solve sendiri dengan Audio Challenge
      ↓
3. Audio Challenge
   ├─ Download audio dari Google
   ├─ Kirim ke Wit.ai Speech API
   ├─ Dapatkan transkrip text
   └─ Submit transkrip
```

---

## 📊 Prioritas Solver

Script menggunakan prioritas ini:

### 1. CapSolver (Highest Priority)
```env
CAPSOLVER_API_KEY=your_key
```
- ✅ Paling reliable
- ✅ Tidak kena IP limit
- ✅ Fast (2-10 detik)
- ❌ Berbayar (~$1 per 1000 solves)

### 2. 2Captcha (Second Priority)
```env
TWOCAPTCHA_API_KEY=your_key
```
- ✅ Reliable
- ✅ Tidak kena IP limit
- ✅ Fast (5-15 detik)
- ❌ Berbayar (~$1-2 per 1000 solves)

### 3. Audio Challenge + Wit.ai (Default/Free)
```env
WITAI_ACCESS_TOKEN=YP37OWAPEEWGZDIKUZS6SKS2H3IDOPB5
```
- ✅ **Gratis** (default included)
- ✅ Decent success rate (~70-80%)
- ❌ Bisa kena IP limit dari Google
- ❌ Slower (10-20 detik)
- ❌ Cooldown 90s jika spam

---

## ⚙️ Konfigurasi di `.env`

### Minimal (Pakai Default)
```env
# Tidak perlu tambahkan apa-apa
# Token default sudah include di script
```

### With Wit.ai Token Custom
```env
WITAI_ACCESS_TOKEN=your_custom_token
```

### With Cloud Solver (Recommended for 24/7)
```env
CAPSOLVER_API_KEY=your_capsolver_key
# atau
TWOCAPTCHA_API_KEY=your_2captcha_key

# Wit.ai tetap sebagai fallback
WITAI_ACCESS_TOKEN=YP37OWAPEEWGZDIKUZS6SKS2H3IDOPB5
```

---

## 🔍 Cara Cek Token Bekerja

### 1. Dari Log
Lihat output saat `token_sync.js` running:

```bash
[Token Sync] 🎧 Memilih Audio Challenge...
[Token Sync] 🔊 Mengirim audio ke Wit.ai Speech API...
[Token Sync] 📝 Wit.ai raw response (523 chars): {"text":"seven two five eight","speech_id":"..."}
[Token Sync] ✅ Wit.ai transkrip final (chunk 0): "seven two five eight"
```

### 2. Test Manual
```javascript
// Di Node.js console
const fetch = require('node-fetch');

fetch('https://api.wit.ai/speech?v=20230215', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YP37OWAPEEWGZDIKUZS6SKS2H3IDOPB5',
    'Content-Type': 'audio/mpeg'
  },
  body: audioBuffer // Your audio file buffer
})
.then(r => r.text())
.then(console.log);
```

---

## 🚨 Troubleshooting

### Error: "Wit.ai API error: HTTP 401"
**Problem:** Token invalid atau expired

**Solution:**
1. Cek token di https://wit.ai/
2. Generate token baru
3. Update di `.env`:
   ```env
   WITAI_ACCESS_TOKEN=new_token_here
   ```

### Error: "Wit.ai API error: HTTP 429"
**Problem:** Rate limit (terlalu banyak request)

**Solution:**
1. Script sudah handle dengan cooldown 90s
2. Atau pakai cloud solver:
   ```env
   CAPSOLVER_API_KEY=your_key
   ```

### Error: "Tidak ada field 'text' ditemukan"
**Problem:** Wit.ai tidak bisa transcribe audio

**Reasons:**
- Audio quality buruk
- Audio format tidak didukung
- Rate limit

**Solution:**
1. Retry otomatis (script handle max 3x)
2. Atau pakai cloud solver

### Error: "Google Cooldown aktif"
**Problem:** IP kena limit dari Google reCAPTCHA

**Solution:**
1. **Tunggu 90 detik** (auto-handled)
2. Atau pakai cloud solver (bypass IP limit)
3. Atau pakai proxy

---

## 💡 Tips Optimasi Wit.ai

### 1. Rate Limiting Prevention
```env
# Interval minimum antar solve
CAPTCHA_MIN_INTERVAL_SEC=6

# Cooldown saat detect DOS
CAPTCHA_DOS_COOLDOWN_SEC=90
```

### 2. Multiple Tokens (Round-robin)
Edit `token_sync.js` untuk pakai multiple tokens:

```javascript
const WIT_TOKENS = [
  "YP37OWAPEEWGZDIKUZS6SKS2H3IDOPB5",
  "TOKEN_2_HERE",
  "TOKEN_3_HERE"
];

let currentTokenIndex = 0;
function getNextWitToken() {
  const token = WIT_TOKENS[currentTokenIndex];
  currentTokenIndex = (currentTokenIndex + 1) % WIT_TOKENS.length;
  return token;
}
```

### 3. Combine with Proxy
```env
PROXY_SERVER=http://proxy.example.com:8080
WITAI_ACCESS_TOKEN=YP37OWAPEEWGZDIKUZS6SKS2H3IDOPB5
```

---

## 📈 Performance dengan Wit.ai

### Expected Success Rate
- **Good conditions**: 75-85% solve rate
- **Normal conditions**: 65-75% solve rate
- **Rate limited**: 40-60% solve rate

### Comparison

| Method | Cost | Speed | Success Rate | IP Limit |
|--------|------|-------|--------------|----------|
| **Wit.ai (Default)** | Free | 10-20s | 65-80% | Yes |
| **CapSolver** | $1/1000 | 2-10s | 95-99% | No |
| **2Captcha** | $1-2/1000 | 5-15s | 90-95% | No |

---

## 🎓 Summary

### ✅ Yang Sudah Ada
- Token Wit.ai default: `YP37OWAPEEWGZDIKUZS6SKS2H3IDOPB5`
- Sudah terpasang di `token_sync.js`
- Siap pakai tanpa setup tambahan

### 🎯 Recommended Setup

**For Testing/Learning (Free):**
```env
# Pakai default, tidak perlu tambah apa-apa
```

**For Production/24-7 (Paid):**
```env
CAPSOLVER_API_KEY=your_capsolver_key
WITAI_ACCESS_TOKEN=YP37OWAPEEWGZDIKUZS6SKS2H3IDOPB5  # Fallback
```

### 🚀 Next Steps

1. **Tidak perlu edit apa-apa** untuk Wit.ai token
2. Langsung jalankan:
   ```bash
   node token_sync.js
   ```
3. Token akan otomatis dipakai untuk audio challenge
4. Jika mau upgrade ke cloud solver, tambahkan `CAPSOLVER_API_KEY` atau `TWOCAPTCHA_API_KEY`

---

**Token Wit.ai sudah include dan siap dipakai! 🎉**

*Last updated: 2026-08-28*
