# PFAS Dashboard Google Sheet Template

Import `pfas-dashboard-template.csv` into Google Sheets.

The dashboard currently reads one published CSV URL from:

```env
VITE_GOOGLE_SHEET_CSV_URL=
```

Required useful columns (either layout works):

**Checkbox columns** (matches your live sheet): one column per stage with headers `Retainer`, `Ordered`, `Eurofins`, `Outbound`, `Pure Green Testers`, `Inbound`, `Invoice`, `Test Results`. Checked boxes export as `TRUE` in CSV; Test Kit Summary counts each `TRUE` per column. **Eurofins** is special: use text values `Stand By` or `Preparing` (empty when not in that stage). Recent Activity shows e.g. `Blanchester Water Supply updated Eurofins to Stand By`.

**Single status column** (template CSV): `Status` text value per row drives Test Kit Summary and Status Breakdown.
- **Tester Activity tab** (separate sheet): columns `Tester`, `Status`, `Current Location`, `Last Activity` → Tester Activity (Pure Green) widget.
  - **With API key:** set `VITE_GOOGLE_SHEET_TESTER_TAB=Tester Activity` (default).
  - **Without API key:** File → Share → Publish to web → choose **Tester Activity** (not the main tab) → CSV → paste that link in `VITE_GOOGLE_SHEET_TESTER_CSV_URL`. The main published URL only includes the first tab.
- **Recent Activity** (main tab): auto-detects checkbox and status changes when you have **`Company Name`** (or `Record ID`) plus stage columns (`Retainer`, `Ordered`, …). Example: checking Retainer for Blanchester Water Supply shows `Blanchester Water Supply checked Retainer` with a timestamp. Unchecking shows `unchecked Retainer`. The first dashboard load only sets a baseline (no backfill of existing checks). Optional **`Activity`** and **`Time`** columns still add manual log lines; both auto and manual items appear together, newest first.
- `Alert`, `Type`: drives Alerts and Reminders.

After importing to Google Sheets, publish the sheet as CSV and paste the CSV URL into `.env`.

The dashboard polls every second with an API key, or every 5 seconds for published CSV only (`VITE_GOOGLE_SHEET_POLL_MS` overrides this).

**Fastest (recommended):** set `VITE_GOOGLE_SHEET_ID` and `VITE_GOOGLE_SHEETS_API_KEY` so the app reads the sheet via the Google Sheets API (live data, no publish delay). Enable the Sheets API in Google Cloud Console, create an API key, and share the spreadsheet as “Anyone with the link can view”.

**Without an API key:** use `VITE_GOOGLE_SHEET_CSV_URL` (published CSV). Do not rely on sheet ID alone from the browser — private sheets redirect to login and cause CORS errors.

## Firebase Recent Activity (shared history)

Auto-detected Recent Activity is saved to **Cloud Firestore** in the background (one document per `VITE_GOOGLE_SHEET_ID`, shared by all logged-in users). When the list is empty on load, the dashboard fetches the last saved feed from Firestore.

1. In [Firebase Console](https://console.firebase.google.com/) → project **pfas-lawg** → **Build** → **Firestore Database** → **Create database** (if not created yet).
2. **Rules** → **Replace** the default deny-all rules. If you see `allow read, write: if false` on `/{document=**}`, Recent Activity will fail with *Missing or insufficient permissions*.
3. Paste the rules from [`firestore.rules`](../firestore.rules) in this repo (or copy below), then click **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /recentActivityFeeds/{sheetId} {
      allow read, write: if request.auth != null;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

4. Ensure `.env` has Firebase config (`VITE_FIREBASE_*`) and `VITE_GOOGLE_SHEET_ID` so the app knows which document to use.
5. Reload the dashboard after publishing rules (you must be logged in).

Manual `Activity` / `Time` rows are still read from the Google Sheet only; Firestore stores auto-detected checkbox/status events (up to 50).
