# PFAS Dashboard Google Sheet Template

Import `pfas-dashboard-template.csv` into Google Sheets.

The dashboard currently reads one published CSV URL from:

```env
VITE_GOOGLE_SHEET_CSV_URL=
```

Required useful columns:

- `Status`: drives Test Kit Summary and Status Breakdown.
- `Tester`, `Current Location`, `Last Activity`: drives Tester Activity.
- `Activity`, `Time`: drives Recent Activity.
- `Alert`, `Type`: drives Alerts and Reminders.

After importing to Google Sheets, publish the sheet as CSV and paste the CSV URL into `.env`.
