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

The dashboard polls the published CSV every 5 seconds by default (override with `VITE_GOOGLE_SHEET_POLL_MS`). Each request bypasses browser cache so changes show as soon as Google’s published CSV updates.
