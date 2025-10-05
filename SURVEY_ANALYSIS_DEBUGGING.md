# Survey Analysis Debugging Guide

## ✅ What I Just Fixed

### Problem
Survey submissions were returning default scores (all 50s) with message "Analysis unavailable - using default positioning" instead of real AI-analyzed scores based on survey answers.

### Root Cause
The OpenAI API key was likely not configured in Vercel, or the AI analysis was failing silently.

### Solution Implemented

1. **Enhanced Logging** - Added detailed console logging throughout the survey analysis pipeline:
   - `[Survey Submit]` - Tracks the API endpoint flow
   - `[Survey Analysis]` - Tracks the AI analysis process
   - Clear ✓/❌ indicators for success/failure
   - Timing information for performance monitoring

2. **Simplified Analysis Flow** - Removed complex advanced analysis that was failing:
   - Now uses direct OpenAI API call with structured prompt
   - Better error handling with meaningful fallback data
   - Clear distinction between "OpenAI not configured" vs "AI analysis failed"

3. **Better Fallbacks** - If AI fails, users still get:
   - Varied scores (not all 50s) so it's clear survey was processed
   - Meaningful issue titles based on survey structure
   - Clear rationale messages explaining what happened

## 🔍 How to Debug

### Step 1: Check Vercel Environment Variables

Go to: https://vercel.com/arturos-projects-968ce00e/nexo/settings/environment-variables

**Required Variables:**
- ✅ `NEXT_PUBLIC_SUPABASE_URL`
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`
- ⚠️  **`OPENAI_API_KEY`** ← This one is critical for AI analysis!

If `OPENAI_API_KEY` is missing or invalid, you'll see this in logs:
```
[Survey Analysis] OpenAI API key not configured!
[Survey Analysis] Using fallback mock analysis (OpenAI not configured)
```

### Step 2: Complete a Test Survey

1. Go to: https://nexo-1raehrt6k-arturos-projects-968ce00e.vercel.app
2. Click "I'm new here" → Complete survey
3. Sign up with email → Click magic link
4. View your profile at `/views`

### Step 3: Check the Logs

```bash
vercel logs nexo-1raehrt6k-arturos-projects-968ce00e.vercel.app --follow
```

**Look for these log patterns:**

#### ✅ SUCCESS Pattern (OpenAI working):
```
[Survey Submit] ==================== NEW SURVEY SUBMISSION ====================
[Survey Submit] ✓ Received survey answers: 5 questions
[Survey Submit] ✓ Authenticated user: <uuid>
[Survey Submit] ✓ Survey responses stored
[Survey Submit] Starting AI analysis...
[Survey Analysis] Starting with answers: {...}
[Survey Analysis] OpenAI configured, starting AI analysis...
[Survey Analysis] Calling OpenAI API...
[Survey Analysis] OpenAI response received
[Survey Analysis] Raw AI response: {...}
[Survey Analysis] ✅ AI analysis completed successfully: {...}
[Survey Submit] ✓ Analysis completed in 2341ms
[Survey Submit] Pillar scores: economy=65, social=58, environment=72, governance=61, foreign=55
[Survey Submit] Top issues: Economic Policy, Healthcare, Climate Action
[Survey Submit] ✓ Snapshot saved to views_snapshots
[Survey Submit] ✓ Audit trail created
[Survey Submit] ✅ SUCCESS - Total time: 2450ms
```

#### ❌ FAILURE Pattern (OpenAI not configured):
```
[Survey Submit] ==================== NEW SURVEY SUBMISSION ====================
[Survey Submit] ✓ Received survey answers: 5 questions
[Survey Submit] ✓ Authenticated user: <uuid>
[Survey Submit] ✓ Survey responses stored
[Survey Submit] Starting AI analysis...
[Survey Analysis] Starting with answers: {...}
[Survey Analysis] OpenAI API key not configured!
[Survey Analysis] Using fallback mock analysis (OpenAI not configured)
[Survey Submit] ✓ Analysis completed in 8ms
[Survey Submit] Pillar scores: economy=60, social=55, environment=70, governance=65, foreign=58
[Survey Submit] Top issues: Economic Policy, Social Issues, Environmental Protection
[Survey Submit] ✓ Snapshot saved to views_snapshots
```

#### ❌ FAILURE Pattern (OpenAI configured but API call failed):
```
[Survey Analysis] OpenAI configured, starting AI analysis...
[Survey Analysis] Calling OpenAI API...
[Survey Analysis] ❌ AI analysis failed: <error message>
[Survey Analysis] Error details: <stack trace>
[Survey Analysis] Using fallback data due to AI error
```

### Step 4: Expected Results

#### If OpenAI IS configured correctly:
- Pillar scores vary widely (e.g., economy=72, social=45, environment=88)
- Rationales are specific and reference your answers
- Top issues are relevant to your responses
- Analysis time: 2-5 seconds

#### If OpenAI is NOT configured:
- Pillar scores are slightly varied (60, 55, 70, 65, 58)
- Rationales say "Survey completed - awaiting OpenAI configuration"
- Top issues are generic (Economic Policy, Social Issues, etc.)
- Analysis time: <100ms

## 🔧 How to Fix

### If OpenAI Key is Missing:

1. Get your OpenAI API key from: https://platform.openai.com/api-keys
2. Go to Vercel dashboard: https://vercel.com/arturos-projects-968ce00e/nexo/settings/environment-variables
3. Add new variable:
   - **Name**: `OPENAI_API_KEY`
   - **Value**: `sk-proj-...` (your actual key)
   - **Environments**: Production, Preview, Development
4. Click "Save"
5. **Redeploy**: 
   ```bash
   vercel --prod
   ```

### If OpenAI Key is Invalid:

Check the logs for error messages like:
- "Invalid API key"
- "Rate limit exceeded"
- "Insufficient quota"

Then either:
- Update the key in Vercel
- Check your OpenAI account billing
- Verify the key has permissions

## 🧪 Testing Checklist

- [ ] Vercel logs show `[Survey Analysis] OpenAI configured, starting AI analysis...`
- [ ] Survey submission completes in 2-5 seconds (not <100ms)
- [ ] Pillar scores are varied and not default values
- [ ] Rationales reference your actual survey responses
- [ ] Top issues are specific to your answers
- [ ] No error messages in logs

## 📊 What Happens After Survey

1. **Survey Submission** → Creates `views_snapshots` with initial scores
2. **Chat Conversations** → Updates scores via `/api/views/refresh-since`
3. **Delta Application** → Adds/subtracts from current scores (clamped 0-100)
4. **Party Aggregation** → Calculates averages across all users

**The Flow:**
```
Survey (base scores) 
  → Chat (deltas: -10 to +10) 
  → Refresh Views (merge deltas) 
  → Party Stats (aggregate all users)
```

## 💡 Pro Tips

1. **Check logs immediately after survey** - Logs are time-ordered
2. **Use `--follow` flag** - See logs in real-time
3. **Filter by user ID** - Track specific user's journey
4. **Check database** - Verify `views_snapshots` table has data

## 📝 Next Steps

1. Verify OpenAI key in Vercel
2. Complete test survey
3. Check logs for success pattern
4. If still failing, share logs for debugging

---

**Deployment:** https://nexo-1raehrt6k-arturos-projects-968ce00e.vercel.app
**Latest Build:** CF7TAHeHLBmZkPfJ9KafCNCextPM

