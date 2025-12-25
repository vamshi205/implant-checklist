# How to See Images After Adding to Google Sheets

## ✅ Your Setup is Complete!

You've added the "Instrument Images" column to your Google Sheet with the URL. Now you just need to refresh the data in the app.

## Steps to See Your Image:

### Method 1: Refresh the Page (Easiest)
1. **Press F5** (Windows) or **Cmd+R** (Mac) to refresh the browser
2. The app will automatically fetch the latest data from Google Sheets
3. Look for the **info icon (ℹ️)** next to instruments that have images
4. Click the icon to view the image

### Method 2: Refresh Individual Procedure
1. **Select a procedure** that has the instrument with the image
2. Look for the **refresh button (↻)** next to the procedure name
3. Click the refresh button to reload that procedure's data
4. The info icon should appear next to the instrument

### Method 3: Clear and Re-select
1. Click **"Clear All"** button
2. Re-select the procedure(s) you want
3. The data will be freshly loaded from Google Sheets

## What to Look For:

After refreshing, you should see:
- **Info icon (ℹ️)** in blue color next to instruments with images
- The icon appears between the instrument name and the remove (×) button

Example:
```
[Drill ℹ️ ×]  [Forceps ×]
```

## Troubleshooting:

### Info icon still doesn't appear?

1. **Check the column order in Google Sheets:**
   - Column 1: Procedure Name
   - Column 2: Items
   - Column 3: Fixed Items
   - Column 4: Fixed Qty
   - Column 5: Instruments
   - Column 6: Type
   - **Column 7: Instrument Images** ← Your image URLs go here

2. **Verify the URL format:**
   - Should be: `https://drive.google.com/uc?export=view&id=FILE_ID`
   - Make sure URLs are pipe-separated (|) if you have multiple instruments
   - Example: `https://drive.google.com/uc?export=view&id=ABC123 | https://drive.google.com/uc?export=view&id=XYZ789`

3. **Check instrument order matches:**
   - If Instruments column has: `Drill | Forceps`
   - Then Instrument Images should have: `URL1 | URL2` (in same order)

4. **Test the URL directly:**
   - Copy the URL from your sheet
   - Paste it in a browser
   - If it shows the image, the URL is correct
   - If not, check Google Drive sharing settings

5. **Check browser console:**
   - Press F12 to open developer tools
   - Look for any errors in the Console tab
   - Check the Network tab to see if the CSV is loading

## Quick Checklist:

- [ ] Added "Instrument Images" as 7th column
- [ ] Added image URL(s) in the correct format
- [ ] URLs are pipe-separated if multiple instruments
- [ ] Instrument order matches image URL order
- [ ] Google Drive file is shared as "Anyone with link"
- [ ] Refreshed the page or procedure
- [ ] Info icon appears next to instrument

## Still Not Working?

If the info icon still doesn't appear after refreshing:
1. Double-check the instrument name matches exactly (case-sensitive)
2. Verify the URL is accessible (test in browser)
3. Make sure there are no extra spaces in the sheet
4. Try adding the URL to the code mapping as a test (see HOW_TO_VIEW_IMAGE.md)

