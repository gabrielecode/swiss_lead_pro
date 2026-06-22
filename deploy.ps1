# Swiss Lead Pro - Deploy Helper Script (PowerShell - Windows)

Write-Host "🚀 Swiss Lead Pro - Deploy Script (Windows)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Pre-deployment checks
Write-Host "📋 Step 1: Pre-deployment Checks" -ForegroundColor Yellow
Write-Host "--------------------------------" -ForegroundColor Yellow

# Check TypeScript errors
Write-Host "Checking TypeScript errors..." -ForegroundColor White
npm run lint
if ($LASTEXITCODE -ne 0) {
  Write-Host "❌ TypeScript errors found!" -ForegroundColor Red
  exit 1
}
Write-Host "✅ No TypeScript errors" -ForegroundColor Green
Write-Host ""

# Check build
Write-Host "Running build..." -ForegroundColor White
npm run build
if ($LASTEXITCODE -ne 0) {
  Write-Host "❌ Build failed!" -ForegroundColor Red
  exit 1
}
Write-Host "✅ Build successful" -ForegroundColor Green
Write-Host ""

# Step 2: Git operations
Write-Host "📋 Step 2: Git Operations" -ForegroundColor Yellow
Write-Host "------------------------" -ForegroundColor Yellow

Write-Host "Files that will be committed:" -ForegroundColor White
git diff --name-only --cached
Write-Host ""

Write-Host "Adding all changes..." -ForegroundColor White
git add .
Write-Host "✅ Changes staged" -ForegroundColor Green
Write-Host ""

Write-Host "Committing changes..." -ForegroundColor White
git commit -m "feat: Upgrade Gemini models to 2.5-pro, fix Vercel serverless config, add retry logic and fallback chains"
if ($LASTEXITCODE -ne 0) {
  Write-Host "⚠️  Commit failed (maybe nothing to commit)" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "Pushing to GitHub..." -ForegroundColor White
git push origin master
if ($LASTEXITCODE -ne 0) {
  Write-Host "❌ Push failed!" -ForegroundColor Red
  exit 1
}
Write-Host "✅ Pushed to GitHub" -ForegroundColor Green
Write-Host ""

# Step 3: Vercel deployment info
Write-Host "📋 Step 3: Vercel Deployment" -ForegroundColor Yellow
Write-Host "----------------------------" -ForegroundColor Yellow
Write-Host "Next steps:" -ForegroundColor White
Write-Host ""
Write-Host "1️⃣  Vercel will automatically detect the push and start building..." -ForegroundColor White
Write-Host "   Monitor at: https://vercel.com/gabrielecode/swiss-lead-pro/deployments" -ForegroundColor Cyan
Write-Host ""
Write-Host "2️⃣  Once build completes, add GEMINI_API_KEY to Vercel Secrets:" -ForegroundColor White
Write-Host "   Go to: https://vercel.com/gabrielecode/swiss-lead-pro/settings/environment-variables" -ForegroundColor Cyan
Write-Host "   Add: GEMINI_API_KEY = [your-gemini-api-key-here]" -ForegroundColor Cyan
Write-Host ""
Write-Host "3️⃣  Trigger redeploy from Vercel dashboard" -ForegroundColor White
Write-Host ""
Write-Host "4️⃣  Test at: https://swiss-lead-pro.vercel.app" -ForegroundColor White
Write-Host ""

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "✅ Local deployment prep complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
