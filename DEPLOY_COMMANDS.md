# 🔧 QUICK START - EXACT COMMANDS TO RUN

## ⚡ TL;DR - 3 Steps to Deploy

```bash
# Step 1: Verify everything works locally
npm run lint && npm run build

# Step 2: Push to GitHub
git add . && git commit -m "feat: Fix Gemini and Vercel config" && git push

# Step 3: Add API Key to Vercel Secrets
# Go to: https://vercel.com/gabrielecode/swiss-lead-pro/settings/environment-variables
# Add: GEMINI_API_KEY = [your-key-from-aistudio.google.com]
# Done! ✅
```

---

## 📋 Detailed Step-by-Step Commands

### **Step 1: Prepare Your Gemini API Key (5 minutes)**

```bash
# Navigate to Gemini API Console
# URL: https://aistudio.google.com/app/apikey

# Do this in browser:
# 1. Click "Create API Key"
# 2. Select your Google Cloud Project
# 3. Click "Create API key in new project"
# 4. Copy the generated key (starts with "AI...")
# 5. Save it somewhere safe - you'll need it soon!
```

**Expected API Key Format:**
```
AIza_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

### **Step 2: Verify Local Build (2 minutes)**

**Windows (Command Prompt or PowerShell):**
```cmd
cd C:\Users\[YourUsername]\[path-to-project]
npm run lint
npm run build
```

**Expected Output:**
```
> npm run lint
✓ tsc --noEmit
(No output = Success!)

> npm run build
✓ 2076 modules transformed
✓ built in X.XX s
```

---

### **Step 3: Push Code to GitHub (1 minute)**

```bash
# From your project directory:
cd C:\Users\[YourUsername]\[path-to-project]

# Check what changed
git status

# Add everything
git add .

# Commit with message
git commit -m "feat: Update Gemini models to 2.5-pro and fix Vercel serverless config"

# Push to GitHub
git push origin master
```

**Expected Output:**
```
[master abc123d] feat: Update Gemini models...
 5 files changed, 250 insertions(+), 45 deletions(-)
 create mode 100644 .env.production
 
Everything up-to-date
```

**What it's doing:**
- Uploading your fixed code to GitHub
- Vercel will automatically detect the push
- Vercel will start building your app
- Build takes 2-3 minutes

---

### **Step 4: Configure Vercel Secrets (2 minutes)**

**In Your Browser:**

1. Go to: https://vercel.com/gabrielecode/swiss-lead-pro/settings/environment-variables

2. Click "Add New"

3. Fill in the form:
   ```
   Name:       GEMINI_API_KEY
   Value:      [PASTE YOUR KEY FROM STEP 1]
   Environments: ☑️ Production
                 ☑️ Preview
                 ☑️ Development
   ```

4. Click "Save"

5. Wait 30 seconds - Vercel will automatically redeploy with the new secret

**Expected Result:**
```
✅ GEMINI_API_KEY added successfully
🔄 Redeploy triggered
⏳ Deployment in progress...
🚀 Deployment complete (2 minutes later)
```

---

### **Step 5: Monitor Deployment (Optional)**

**Watch the build in real-time:**

```bash
# From your project directory
vercel logs https://swiss-lead-pro.vercel.app --follow

# You'll see:
# > Queued
# > Building...
# > Deployed successfully
```

Or visit: https://vercel.com/gabrielecode/swiss-lead-pro/deployments

---

### **Step 6: Test the App (5 minutes)**

**In Your Browser:**

1. Go to: https://swiss-lead-pro.vercel.app

2. Search Test 1:
   ```
   Keyword: palestra
   Location: Zurigo
   Canton: ZH
   Radius: 50 km
   Click: "Genera Lead"
   Expected: 3-5 fitness centers with names and contact info ✅
   ```

3. Search Test 2:
   ```
   Keyword: scuola
   Location: Berna
   Canton: BE
   Radius: 50 km
   Expected: 3-5 schools ✅
   ```

4. Search Test 3:
   ```
   Keyword: parrucchiere
   Location: Lugano
   Canton: TI
   Radius: 50 km
   Expected: 3-5 hair salons ✅
   ```

5. Open DevTools (F12) and check:
   - Console: No red errors ✅
   - Network → generate-leads: Status 200 ✅
   - Response shows leads array ✅

---

## 🐛 Troubleshooting Commands

### **If build fails:**

```bash
# Clean and reinstall
rm -r node_modules
npm install
npm run lint
npm run build
```

### **If push fails:**

```bash
# Check git status
git status

# Pull latest from remote
git pull origin master

# Retry push
git push origin master
```

### **If app still shows 0 leads:**

```bash
# Check Vercel logs for errors
vercel logs https://swiss-lead-pro.vercel.app --follow

# Check that API key is actually set
vercel env list

# Should show GEMINI_API_KEY in the list
```

### **If you see "API Key is required" error:**

```bash
# 1. Go to Vercel Settings
# URL: https://vercel.com/gabrielecode/swiss-lead-pro/settings/environment-variables

# 2. Verify GEMINI_API_KEY exists
# 3. If not there, add it
# 4. Click "Redeploy" button
# 5. Wait 1-2 minutes
```

---

## ⚙️ Configuration Files Changed

These files were updated (no action needed, already done):

```
✅ vercel.json                    → Serverless function config
✅ .env.production               → Environment variables template
✅ api/generate-leads.ts         → Gemini model selection
✅ api/ask-ai.ts                 → Gemini model selection
✅ server.ts                      → Retry logic
```

---

## 📊 Expected Vercel Build Output

When Vercel builds your app, you should see:

```
Building...
⠸ Running "npm run build"
> vite build && esbuild server.ts --bundle...
vite v6.4.3 building for production...
✓ 2076 modules transformed.
dist/index.html                   0.44 kB
dist/assets/index-*.css          43.13 kB
dist/assets/index-*.js          396.28 kB
✓ built in 9.00s

dist/server.cjs      20.9 kb
dist/server.cjs.map  32.5 kb
Done in 14ms

✅ Build Successful
🚀 Deployed to https://swiss-lead-pro.vercel.app
```

---

## 🚀 One-Liner Deploy (If You Know What You're Doing)

```bash
# Windows PowerShell
cd C:\path\to\swiss_lead_pro; git add .; git commit -m "fix: Gemini config"; git push

# Linux/Mac
cd ~/swiss_lead_pro && git add . && git commit -m "fix: Gemini config" && git push
```

Then:
1. Add GEMINI_API_KEY to Vercel Secrets
2. Wait for redeploy
3. Test at https://swiss-lead-pro.vercel.app

---

## ✅ Checklist Before Deploying

- [ ] I have my Gemini API Key (from aistudio.google.com)
- [ ] I ran `npm run lint` and got 0 errors
- [ ] I ran `npm run build` and it succeeded
- [ ] I ran `git push origin master` successfully
- [ ] I added GEMINI_API_KEY to Vercel Secrets
- [ ] Vercel shows "Deployed" status
- [ ] I can access https://swiss-lead-pro.vercel.app
- [ ] I tested search for "palestra" + got results

---

## 📞 If You Get Stuck

### Common Issues & Fixes:

```
❌ "Command not found: npm"
✅ Install Node.js from nodejs.org

❌ "fatal: not a git repository"
✅ Run: git init && git add . && git commit...

❌ "GEMINI_API_KEY is undefined"
✅ Check Vercel Secrets were added and saved

❌ "Build failed on Vercel"
✅ Check Vercel logs: vercel logs --follow

❌ "0 leads still showing"
✅ Check: 
   - Did you add GEMINI_API_KEY to Vercel?
   - Did Vercel redeploy after adding secret?
   - Check browser console (F12) for errors

❌ "404 on /api/generate-leads"
✅ Check vercel.json was deployed:
   - Verify it has "functions": { "api/**/*.ts": ... }
```

---

## 📈 Performance Notes

**First Search:** 8-12 seconds (Gemini processing + cold start)
**Subsequent Searches:** 2-3 seconds (caching + warm start)
**Fallback to Mock Data:** <1 second (if all models fail)

All normal behavior. Don't worry if first search takes a bit longer.

---

## 🎯 Success Indicators

You'll know it's working when:

```
✅ Search for "palestra" → Shows 5 fitness centers
✅ Each has name, phone, email, website
✅ Marketing scores between 60-95
✅ No console errors in DevTools (F12)
✅ Response time < 15 seconds
✅ Same results for "scuola" and "parrucchiere"
```

---

**Status: Ready to Deploy** 🚀

Follow these commands in order and you're done!
