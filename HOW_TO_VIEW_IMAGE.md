# How to See Your Instrument Image in the App

## Quick Steps

### If you added the image to Google Sheets:
1. **Refresh the procedure** in the app:
   - Find the procedure that has the instrument
   - Click the refresh button (↻) next to the procedure name
   - OR refresh the entire page (F5 or Cmd+R)

2. **Look for the info icon** (ℹ️) next to the instrument name
   - The icon appears in blue next to instruments that have images

3. **Click the info icon** to view the image popup

### If you added the image to code (instrumentImageMap):
1. **Save the file** (if you edited App.js)
2. **The app should auto-reload** (if running with `npm start`)
3. **Look for the info icon** (ℹ️) next to the instrument
4. **Click the info icon** to view

## Troubleshooting

### Info icon doesn't appear?
1. **Check instrument name matches exactly** (case-sensitive)
   - "Drill" ≠ "drill" ≠ "DRILL"
   
2. **Verify the image URL works**:
   - Open the URL in a browser: `https://drive.google.com/uc?export=view&id=1DXP1Vawl4-B_LPNc5WcWwWQno62BNRGE`
   - If it doesn't show the image, check sharing settings

3. **If using Google Sheets**:
   - Make sure the URL is in the 7th column
   - URLs must match instrument order (pipe-separated)
   - Refresh the procedure after adding

4. **If using code mapping**:
   - Check the instrument name matches exactly
   - Make sure the URL is in quotes
   - Save the file and wait for auto-reload

### Image doesn't load in popup?
1. **Check browser console** (F12) for errors
2. **Verify Google Drive sharing**: Set to "Anyone with the link"
3. **Test the URL directly** in browser

## Quick Test - Add to Code (Fastest Way)

If you want to test quickly, add it to the code:

1. Open `src/App.js`
2. Find line ~48 (the `instrumentImageMap` object)
3. Add your instrument:

```javascript
const instrumentImageMap = {
  "Your Instrument Name": "https://drive.google.com/uc?export=view&id=1DXP1Vawl4-B_LPNc5WcWwWQno62BNRGE",
};
```

4. Save - the app will auto-reload
5. Look for the info icon next to "Your Instrument Name"

## Where to Look

The info icon appears:
- Next to the instrument name in the instrument tags
- Only for instruments that have images
- In blue color (ℹ️)

Example:
```
[Drill ℹ️ ×]  [Forceps ×]
```

The ℹ️ icon means there's an image available!

