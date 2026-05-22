# PFAS Dashboard Google Sheet Template

Import `pfas-dashboard-template.csv` into Google Sheets.

The dashboard currently reads one published CSV URL from:

```env
VITE_GOOGLE_SHEET_CSV_URL=
```

Required useful columns (either layout works):

**Checkbox columns** (matches your live sheet): one column per stage with headers `Retainer`, `Ordered`, `Eurofins`, `Outbound`, `Pure Green Testers`, `Inbound`, `Invoice`, `Test Results`. Checked boxes export as `TRUE` in CSV; Test Kit Summary counts each `TRUE` per column.

**Single status column** (template CSV): `Status` text value per row drives Test Kit Summary and Status Breakdown.
- `Tester`, `Current Location`, `Last Activity`: drives Tester Activity.
- `Activity`, `Time`: drives Recent Activity.
- `Alert`, `Type`: drives Alerts and Reminders.

After importing to Google Sheets, publish the sheet as CSV and paste the CSV URL into `.env`.

The dashboard polls every second by default (`VITE_GOOGLE_SHEET_POLL_MS`, default `1000`).

**Fastest (recommended):** set `VITE_GOOGLE_SHEET_ID` and `VITE_GOOGLE_SHEETS_API_KEY` so the app reads the sheet via the Google Sheets API (live data, no publish delay). Enable the Sheets API in Google Cloud Console, create an API key, and share the spreadsheet as “Anyone with the link can view”.

**Without an API key:** use `VITE_GOOGLE_SHEET_CSV_URL` (published CSV). Do not rely on sheet ID alone from the browser — private sheets redirect to login and cause CORS errors.
