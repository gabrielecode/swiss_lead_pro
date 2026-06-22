#!/bin/bash
# Swiss Lead Pro - Deploy Helper Script

echo "🚀 Swiss Lead Pro - Deploy Script"
echo "=================================="
echo ""

# Step 1: Pre-deployment checks
echo "📋 Step 1: Pre-deployment Checks"
echo "--------------------------------"

# Check TypeScript errors
echo "Checking TypeScript errors..."
npm run lint
if [ $? -ne 0 ]; then
  echo "❌ TypeScript errors found!"
  exit 1
fi
echo "✅ No TypeScript errors"
echo ""

# Check build
echo "Running build..."
npm run build
if [ $? -ne 0 ]; then
  echo "❌ Build failed!"
  exit 1
fi
echo "✅ Build successful"
echo ""

# Step 2: Git operations
echo "📋 Step 2: Git Operations"
echo "------------------------"
echo "Files that will be committed:"
git diff --name-only --cached
echo ""
echo "Adding all changes..."
git add .
echo "✅ Changes staged"
echo ""

echo "Committing changes..."
git commit -m "feat: Upgrade Gemini models to 2.5-pro, fix Vercel serverless config, add retry logic and fallback chains"
if [ $? -ne 0 ]; then
  echo "⚠️  Commit failed (maybe nothing to commit)"
fi
echo ""

echo "Pushing to GitHub..."
git push origin master
if [ $? -ne 0 ]; then
  echo "❌ Push failed!"
  exit 1
fi
echo "✅ Pushed to GitHub"
echo ""

# Step 3: Vercel deployment info
echo "📋 Step 3: Vercel Deployment"
echo "----------------------------"
echo "Next steps:"
echo ""
echo "1️⃣  Vercel will automatically detect the push and start building..."
echo "   Monitor at: https://vercel.com/gabrielecode/swiss-lead-pro/deployments"
echo ""
echo "2️⃣  Once build completes, add GEMINI_API_KEY to Vercel Secrets:"
echo "   Go to: https://vercel.com/gabrielecode/swiss-lead-pro/settings/environment-variables"
echo "   Add: GEMINI_API_KEY = [your-gemini-api-key-here]"
echo ""
echo "3️⃣  Trigger redeploy from Vercel dashboard"
echo ""
echo "4️⃣  Test at: https://swiss-lead-pro.vercel.app"
echo ""

echo "=================================="
echo "✅ Local deployment prep complete!"
echo "=================================="
