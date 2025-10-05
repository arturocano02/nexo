# Nexo - Quick Start Guide

## 🚀 Your App is Live!
**URL**: https://nexo-jthjendaa-arturos-projects-968ce00e.vercel.app

## ⚡ Immediate Next Steps

### 1. Apply Database Migration (5 minutes)
```bash
# Go to: https://supabase.com/dashboard
# Navigate to: Your Project → SQL Editor
# Copy and run: supabase/migrations/20241005_complete_schema.sql
```

### 2. Test the App (10 minutes)
1. Visit the app URL
2. Click "I'm new here"
3. Complete the 5-question survey
4. Sign up with your email
5. Click the magic link in your email
6. See your political profile on `/views`

### 3. Verify Health (1 minute)
```bash
curl https://nexo-jthjendaa-arturos-projects-968ce00e.vercel.app/api/health
```

Should return: `"status": "ok"` ✅

## 📋 What Was Fixed

✅ Environment configuration with safe helpers
✅ Complete database schema with RLS
✅ Health check endpoint
✅ Dev banner for missing OpenAI key
✅ All TypeScript compilation errors resolved
✅ Comprehensive documentation (3 files)

## 📚 Documentation Files

- `DEPLOYMENT_SUMMARY.md` - Full deployment details
- `QA_CHECKLIST.md` - 150+ test checkpoints
- `AUDIT_SUMMARY.md` - Complete audit findings
- `QUICK_START.md` - This file!

## 🧪 Quick Test Checklist

- [ ] Database migration applied
- [ ] Health endpoint returns "ok"
- [ ] Can complete survey without login
- [ ] Magic link authentication works
- [ ] Profile shows real AI analysis (not all 50s)
- [ ] Chat bot responds to messages
- [ ] "Refresh Views" updates profile
- [ ] Party tab shows aggregate stats

## 🔧 Common Commands

```bash
# Deploy to production
vercel --prod

# View logs
vercel logs

# Check health
curl https://nexo-jthjendaa-arturos-projects-968ce00e.vercel.app/api/health | jq

# Run locally
npm run dev
```

## 📊 Database Tables

All tables are created by the migration:
- `profiles` - User info
- `survey_responses` - Survey answers (JSONB)
- `views_snapshots` - Political profile
- `conversations` - Chat threads
- `messages` - Chat history
- `view_updates` - Audit trail
- `aggregates` - Party stats (public)
- `analysis_state` - Incremental processing tracker
- `message_topics` - Topic metadata

## 🎯 Core Features

1. **Survey-First Onboarding** - No account needed to start
2. **Real OpenAI Analysis** - Analyzes political views
3. **Continuous Chat** - One thread, no auto-updates
4. **Manual Refresh** - User-triggered view updates
5. **Party Aggregation** - Anonymous group statistics
6. **RLS Security** - User data isolation

## ⚠️ Important Notes

- OpenAI key required for AI analysis
- Survey must be completed before chat access
- "Refresh Views" only processes new messages
- Rate limits: 10s for views, 30s for party
- All pillar scores clamped 0-100

## 🆘 Need Help?

Check the docs:
1. `DEPLOYMENT_SUMMARY.md` for details
2. `QA_CHECKLIST.md` for testing
3. `AUDIT_SUMMARY.md` for architecture

Or check health endpoint for system status!

---

**Ready to test?** Start with step 1 above! 🎉

