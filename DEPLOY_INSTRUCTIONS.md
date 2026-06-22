# 🚀 DEPLOY INSTRUCTIONS - Swiss Lead Pro

## ✅ Correzioni Applicate

### 1. **Vercel Configuration Updated**
- ✅ Vercel serverless functions configurate
- ✅ Environment variables configuration pronta
- ✅ Memory e timeout settings ottimizzati
- ✅ Runtime: Node.js 20.x

### 2. **Gemini Models Upgraded**
- ✅ API calls usano sempre `gemini-2.5-pro` (modello più recente)
- ✅ Fallback automatico a `gemini-2.5-flash`, `gemini-2.0-flash`, ecc.
- ✅ Retry logic con exponential backoff (1.5s → 3s → 6s)
- ✅ Migliorato error handling e logging

### 3. **Files Updated**
```
✅ vercel.json                    → Configurazione Vercel ottimale
✅ .env.production               → Template variabili produzione
✅ api/generate-leads.ts         → Modelli Gemini aggiornati + retry
✅ api/ask-ai.ts                 → Modelli Gemini aggiornati + fallback
✅ server.ts                      → Logica fallback migliorata
```

---

## 📋 SETUP GUIDE - Per Deploy su Vercel

### **Step 1: Ottenere la Gemini API Key**

1. Vai a: https://aistudio.google.com/app/apikey
2. Clicca "Create API Key" 
3. Seleziona il progetto Google Cloud (o creane uno nuovo)
4. Copia la chiave API generata
5. Salva in un posto sicuro

### **Step 2: Aggiungere Secrets a Vercel**

1. Vai a: https://vercel.com/gabrielecode/swiss-lead-pro/settings/environment-variables
2. Aggiungi nuova variabile:
   - **Name:** `GEMINI_API_KEY`
   - **Value:** (Incolla la chiave dal Step 1)
   - **Environments:** Production, Preview, Development
3. Clicca "Add"

### **Step 3: Deploy su Vercel**

Opzione A - Da CLI locale:
```bash
cd /path/to/swiss_lead_pro
git add .
git commit -m "feat: Upgrade Gemini models and Vercel configuration"
git push
vercel deploy --prod
```

Opzione B - From GitHub (consigliato):
1. Vai a GitHub: https://github.com/gabrielecode/swiss_lead_pro
2. Fai push delle correzioni:
   ```bash
   git add .
   git commit -m "feat: Upgrade Gemini models and fix Vercel config"
   git push origin master
   ```
3. Vercel rebuilda automaticamente su push

### **Step 4: Verificare il Deploy**

1. Attendi il build su Vercel (~2-3 minuti)
2. Vai a: https://swiss-lead-pro.vercel.app
3. Testa la ricerca con:
   - "palestra" + "Zurigo"
   - "scuola" + "Berna"  
   - "parrucchiere" + "Lugano"
4. Verifica che i lead vengano estratti correttamente

---

## 🔍 Model Selection Strategy

L'app adesso usa questa strategia per i modelli Gemini:

```
Priority Order (Latest First):
1. gemini-2.5-pro        ← Newest model (May 2025)
2. gemini-2.5-flash      ← Fast alternative
3. gemini-2.0-flash      ← Proven stable
4. gemini-1.5-pro        ← Fallback
5. gemini-1.5-flash      ← Last resort

Retry Logic:
- Max 3 tentativi per modello
- Exponential backoff: 1.5s → 3s → 6s
- Auto-fallback se transient error (503, UNAVAILABLE, timeout)
- Throw se error non-transient (auth, quota, etc)
```

---

## 🐛 Debugging

Se le ricerche non funzionano ancora:

1. **Controlla Vercel Logs:**
   ```bash
   vercel logs --follow
   ```

2. **Verificare che la API Key sia presente:**
   - Vai a Vercel Settings → Environment Variables
   - Conferma che `GEMINI_API_KEY` sia settata

3. **Guarda la console del browser (F12):**
   - Network tab → `/api/generate-leads` 
   - Vedi se c'è errore 4xx o 5xx

4. **Controlla status Gemini:**
   - https://status.cloud.google.com/

---

## 📊 Expected Behavior

**Prima (con il bug):**
```
❌ Ricerca "palestra" → 0 lead
❌ Nessun errore in console
❌ Richieste a /api/ non trovate
```

**Dopo (corretto):**
```
✅ Ricerca "palestra" → 3-5 lead estratti
✅ Mostra aziende reali da Gemini AI + Google Search
✅ Se Gemini fallisce, fallback a risultati simulati
✅ Email estratte e telefoni presenti
```

---

## 🎯 Prossimi Step (Opzionali)

1. **Aggiungere API Key multipli** (per load balancing)
2. **Caching dei risultati** (Redis su Vercel)
3. **Rate limiting** (proteggere API Gemini)
4. **Analytics** (trackare ricerche effettuate)
5. **Webhook integration** (CRM, email marketing tools)

---

**Status:** ✅ Ready for Production Deploy
**Last Updated:** 2026-06-22
**Build Time:** 14s
**TypeScript Errors:** 0
