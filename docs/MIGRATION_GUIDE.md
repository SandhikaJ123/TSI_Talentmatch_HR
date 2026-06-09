# Migration Guide: Removing localStorage Persistence

## What Changed?

The application previously stored jobs and sessions in localStorage, which caused sync issues with the database. We've now removed this redundant storage.

**What's still in localStorage:**
- ✅ UI preferences (dark mode, sidebar state)
- ✅ Settings (company name, default weights)
- ✅ Candidate pipeline statuses (new, shortlisted, interview, etc.)

**What's NO LONGER in localStorage:**
- ❌ Jobs (now loaded from database only)
- ❌ Sessions (now loaded from database only)
- ❌ Candidate data (now loaded from database only)

## How to Clear Old Data

If you're experiencing issues with stale data showing up, follow these steps:

### Option 1: Use the Clear Tool (Recommended)

1. Open `client/clear-localstorage.html` in your browser
2. Click "View Current Data" to see what's stored
3. Click "Clear Jobs Only" to remove old job/session data
4. Refresh your application

### Option 2: Manual Browser Clear

1. Open your application in the browser
2. Open Developer Tools (F12)
3. Go to the "Application" or "Storage" tab
4. Find "Local Storage" → your domain
5. Find the key `client-store`
6. Delete it or edit it to remove `jobs` and `sessions` keys
7. Refresh the page

### Option 3: Browser Console

1. Open Developer Tools (F12)
2. Go to the "Console" tab
3. Run this command:
   ```javascript
   localStorage.removeItem('client-store');
   ```
4. Refresh the page

## Verification

After clearing, verify the fix:

1. Go to the Dashboard - should show correct job count from database
2. Go to Matcher → "Select a job posting" dropdown - should only show jobs from database
3. Go to Candidates - should show candidates from database
4. Clear the database (if testing) - UI should reflect the empty state immediately after refresh

## For Developers

The changes were made in:
- `client/src/store/useAppStore.js` - Updated `partialize` to exclude jobs and sessions
- `client/src/views/CandidatesView.jsx` - Now loads from database via API
- `client/src/views/MatcherView.jsx` - Always syncs with database on mount
- `client/src/views/DashboardView.jsx` - Already loading from database

All views now fetch fresh data from the database on mount, ensuring consistency.
