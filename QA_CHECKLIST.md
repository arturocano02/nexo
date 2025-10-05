# Nexo End-to-End QA Checklist

## Prerequisites
- [ ] `.env.local` contains all required variables:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
  - `OPENAI_API_KEY`
- [ ] Database migration applied: `20241005_complete_schema.sql`
- [ ] App deployed and accessible

## Test 1: New User Onboarding

### 1.1 Survey Without Account
- [ ] Navigate to `/`
- [ ] Click "I'm new here" or similar CTA
- [ ] See 5-question survey page
- [ ] Each question has:
  - [ ] Multiple choice options
  - [ ] "I don't know" option
  - [ ] Optional free text field
- [ ] Fill out all 5 questions (mix of MCQ + text)
- [ ] Click "See my starter profile" or "Submit"

### 1.2 Auth Redirect
- [ ] Redirected to `/auth` page
- [ ] URL contains `?next=/survey/finish` parameter
- [ ] Enter email address
- [ ] See "Check your email" message
- [ ] Receive magic link email
- [ ] Click magic link in email

### 1.3 Survey Processing
- [ ] Land on `/survey/finish` page
- [ ] See "Processing your survey..." or similar message
- [ ] Backend calls `/api/survey/submit` with Authorization header
- [ ] Survey data saved to `survey_responses` table
- [ ] OpenAI analyzes responses (check server logs)
- [ ] `views_snapshots` row created with pillars + top_issues
- [ ] `view_updates` row created with source="survey"

### 1.4 Initial Profile View
- [ ] Redirected to `/views` (Mine tab)
- [ ] See 5 pillar bars (Economy, Social, Environment, Governance, Foreign)
- [ ] See radar chart with same 5 pillars
- [ ] See top 3 issues with titles and summaries
- [ ] (Optional) See political compass point
- [ ] All scores reflect real analysis (not all 50s)

### 1.5 Database Verification
```sql
-- Check survey_responses
SELECT * FROM survey_responses WHERE user_id = '<user_id>';

-- Check views_snapshots
SELECT * FROM views_snapshots WHERE user_id = '<user_id>';

-- Check view_updates
SELECT * FROM view_updates WHERE user_id = '<user_id>' AND source = 'survey';

-- Check profile created
SELECT * FROM profiles WHERE id = '<user_id>';
```

## Test 2: Chat + Refresh Views Flow

### 2.1 Send Chat Messages
- [ ] Navigate to `/chat`
- [ ] See empty conversation or existing messages
- [ ] Type message about a political topic (e.g., "What do you think about NHS funding?")
- [ ] Press Enter to send
- [ ] See user message appear immediately
- [ ] See "Thinking..." indicator
- [ ] Receive AI assistant response (relevant to topic)
- [ ] Send 2-3 more messages on different topics
- [ ] Verify messages persist after page refresh

### 2.2 Refresh Views from Chat
- [ ] While on `/chat` page
- [ ] Click "Refresh Views" button (if present)
- [ ] See loading/processing indicator
- [ ] Backend analyzes only new messages since last refresh
- [ ] See toast notification showing what changed (delta)
- [ ] See summary message appended to conversation:
  - [ ] Prefixed with "[NEXO-SUMMARY]" or similar styling
  - [ ] Plain English (under 60 words)
  - [ ] Describes pillar changes or top issue updates

### 2.3 Refresh Views from Views Page
- [ ] Navigate to `/views` (Mine tab)
- [ ] Note current pillar scores and top issues
- [ ] Click "Refresh" button
- [ ] See loading animation (processing steps)
- [ ] Backend processes new messages
- [ ] Pillar scores update (see mini diff)
- [ ] Top issues update
- [ ] Toast shows changes (e.g., "Economy +3, Social -2")

### 2.4 Verify Incremental Analysis
- [ ] Only processes messages since last refresh
- [ ] Check `analysis_state` table:
  ```sql
  SELECT * FROM analysis_state WHERE user_id = '<user_id>';
  ```
- [ ] `last_processed_message_id` should be latest message
- [ ] `last_processed_at` timestamp updated
- [ ] `last_refresh_result` contains delta summary

### 2.5 Verify View Updates Audit
```sql
SELECT * FROM view_updates 
WHERE user_id = '<user_id>' AND source = 'refresh_since'
ORDER BY created_at DESC;
```
- [ ] New row created
- [ ] `delta` contains pillarsDelta and topIssuesDelta
- [ ] Deltas are small integers (-10 to +10)

## Test 3: Party Aggregation

### 3.1 View Party Tab
- [ ] Navigate to `/views` (Party tab)
- [ ] See member count (number of users with snapshots)
- [ ] See top 3 party issues with mention counts
- [ ] See pillar means visualization (bars or chart)
- [ ] See compass distribution or scatter plot
- [ ] See top contributor display name
- [ ] See party summary (neutral, plain English)

### 3.2 Refresh Party Data
- [ ] Click "Refresh Party" button
- [ ] See loading indicator
- [ ] Backend recomputes aggregates:
  - [ ] Counts unique users in `views_snapshots`
  - [ ] Averages pillar scores across users
  - [ ] Merges top issues (case-insensitive)
  - [ ] Calculates compass distribution
  - [ ] Finds top contributor (last 14 days)
  - [ ] Generates party summary via OpenAI
- [ ] See updated statistics
- [ ] Verify debounce (cannot refresh within 30s)

### 3.3 Database Verification
```sql
SELECT * FROM aggregates WHERE id = TRUE;
```
- [ ] Single row exists
- [ ] `member_count` > 0
- [ ] `pillar_means` contains 5 pillars with averages
- [ ] `top_issues` array with titles and counts
- [ ] `compass_distribution` populated
- [ ] `top_contributor` has display_name and metric
- [ ] `party_summary` is concise text (≤400 chars)

## Test 4: RLS Security

### 4.1 User Isolation
- [ ] Create 2 test accounts (User A and User B)
- [ ] User A completes survey
- [ ] User B completes survey
- [ ] User A cannot see User B's `views_snapshots`
- [ ] User A cannot see User B's `conversations`
- [ ] User A cannot see User B's `messages`
- [ ] User A cannot see User B's `view_updates`

### 4.2 Aggregates Public Access
- [ ] Unauthenticated user can read `aggregates` table
- [ ] Authenticated users can update `aggregates`
- [ ] No PII exposed in aggregates (only display_names)

### 4.3 JWT Verification
- [ ] API calls without Authorization header return 401
- [ ] API calls with invalid JWT return 401
- [ ] API calls with expired JWT return 401

## Test 5: Health Check

### 5.1 Health Endpoint
- [ ] GET `/api/health`
- [ ] Returns JSON with:
  - [ ] `db.connected: boolean`
  - [ ] `db.tables: string[]` (list of required tables)
  - [ ] `auth.emailEnabled: boolean`
  - [ ] `ai.openaiConfigured: boolean`
- [ ] If Authorization header provided:
  - [ ] `user.hasSnapshot: boolean`
  - [ ] `user.id: string`
- [ ] No secrets or API keys in response
- [ ] Status 200 if healthy, 503 if issues

### 5.2 Server Logs
- [ ] Each OpenAI call logs:
  - [ ] Route (e.g., "/api/survey/submit")
  - [ ] User ID
  - [ ] Tokens used (if available)
  - [ ] Duration (ms)
- [ ] Format: `[OpenAI] /api/survey/submit user=<id> tokens=<n> duration=<ms>ms`

## Test 6: Accessibility & Mobile UX

### 6.1 Mobile Safe Areas
- [ ] Top header respects `env(safe-area-inset-top)`
- [ ] Bottom nav respects `env(safe-area-inset-bottom)`
- [ ] Content has padding: `calc(env(safe-area-inset-bottom) + 4rem)`
- [ ] Test on iPhone with notch
- [ ] Test on Android with gesture navigation

### 6.2 Tap Targets
- [ ] All buttons ≥44px height
- [ ] All interactive elements ≥44px tap target
- [ ] Sufficient spacing between adjacent targets

### 6.3 Keyboard & Focus
- [ ] Tab navigation works through all interactive elements
- [ ] Focus rings visible (not disabled)
- [ ] Enter key submits forms
- [ ] Shift+Enter adds newline in chat composer
- [ ] Escape key dismisses modals

### 6.4 Screen Readers
- [ ] Charts have aria-labels
  - [ ] Example: "Political compass showing libertarian-left position"
  - [ ] Example: "Economy pillar score: 65 out of 100"
- [ ] Toasts use aria-live="polite"
- [ ] Loading states announce to screen readers

## Test 7: Error Handling

### 7.1 Missing Environment Variables
- [ ] Remove `OPENAI_API_KEY` from `.env.local`
- [ ] Dev banner appears: "OpenAI key not configured"
- [ ] Survey analysis returns 503 with descriptive error
- [ ] Refresh views returns 503 with descriptive error
- [ ] Health endpoint shows `ai.openaiConfigured: false`

### 7.2 Network Errors
- [ ] Disconnect from internet
- [ ] Attempt to send chat message
- [ ] See error toast with retry option
- [ ] Attempt to refresh views
- [ ] See error toast

### 7.3 Rate Limiting
- [ ] Click "Refresh Views" multiple times rapidly
- [ ] After 1st request, see 429 rate limit error
- [ ] Toast shows "Please wait 10 seconds"
- [ ] After 10s, can refresh again

### 7.4 Invalid Data
- [ ] Send malformed data to API endpoints
- [ ] Receive 400 Bad Request with validation errors
- [ ] Zod schema validation catches issues
- [ ] No 500 errors from invalid input

## Test 8: Performance

### 8.1 Initial Load
- [ ] `/` loads in <2s
- [ ] `/views` loads in <3s (with data fetch)
- [ ] `/chat` loads in <2s (with message history)

### 8.2 Chat Responsiveness
- [ ] Message send appears instant (optimistic update)
- [ ] AI response arrives in <5s
- [ ] Scroll position maintained when new messages arrive

### 8.3 Refresh Operations
- [ ] "Refresh Views" completes in <10s (depends on message count)
- [ ] "Refresh Party" completes in <15s (depends on user count)
- [ ] Loading indicators show progress

## Test 9: Data Consistency

### 9.1 Pillar Score Clamping
- [ ] All pillar scores between 0-100
- [ ] Deltas applied correctly (+/- 10 max)
- [ ] Scores never exceed bounds
- [ ] Check `views_snapshots` table:
  ```sql
  SELECT 
    (pillars->'economy'->>'score')::int as economy,
    (pillars->'social'->>'score')::int as social,
    (pillars->'environment'->>'score')::int as environment,
    (pillars->'governance'->>'score')::int as governance,
    (pillars->'foreign'->>'score')::int as foreign
  FROM views_snapshots;
  ```
- [ ] All values 0-100

### 9.2 Top Issues Normalization
- [ ] Case-insensitive matching ("NHS" = "nhs")
- [ ] No duplicate issues with different casing
- [ ] Issue titles ≤100 chars
- [ ] Issue summaries ≤140 chars

### 9.3 Aggregate Consistency
- [ ] `member_count` matches `SELECT COUNT(*) FROM views_snapshots`
- [ ] `pillar_means` calculated correctly
- [ ] `top_issues` counts sum correctly

## Test 10: Edge Cases

### 10.1 First-Time User
- [ ] User with no survey data
- [ ] Shows prompt to complete survey
- [ ] Cannot access chat without survey
- [ ] `/views` shows onboarding message

### 10.2 No New Messages
- [ ] Click "Refresh Views" with no new messages
- [ ] Returns early with `processedCount: 0`
- [ ] Toast shows "No new messages"
- [ ] Snapshot unchanged

### 10.3 Very Long Conversations
- [ ] Conversation with 500+ messages
- [ ] Refresh only processes last 200 (or since last refresh)
- [ ] Performance acceptable (<15s)

### 10.4 Concurrent Refreshes
- [ ] Multiple users refresh simultaneously
- [ ] No race conditions
- [ ] Each user's data isolated
- [ ] Aggregates debounced correctly

## Acceptance Criteria

All tests must pass before considering the audit complete:
- [ ] 100% of Test 1 (Onboarding) passes
- [ ] 100% of Test 2 (Chat + Refresh) passes
- [ ] 100% of Test 3 (Party) passes
- [ ] 100% of Test 4 (RLS) passes
- [ ] 90%+ of remaining tests pass
- [ ] No critical bugs or security issues
- [ ] No placeholder/stub code remaining
- [ ] All TypeScript compiles without errors
- [ ] No console errors in browser

## Sign-off

**QA Engineer**: _________________ Date: _______

**Tech Lead**: _________________ Date: _______

**Product Owner**: _________________ Date: _______


