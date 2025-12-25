# Image URL Conversion Guide

## Your Google Drive URL
```
https://drive.google.com/file/d/1DXP1Vawl4-B_LPNc5WcWwWQno62BNRGE/view?usp=drive_link
```

## Converted Direct Image URL (Use This in Your App)
```
https://drive.google.com/uc?export=view&id=1DXP1Vawl4-B_LPNc5WcWwWQno62BNRGE
```

## How to Use This URL

### Option 1: In Google Sheets (Recommended)
1. Open your Google Sheet
2. Add/use the "Instrument Images" column (7th column)
3. Paste the converted URL: `https://drive.google.com/uc?export=view&id=1DXP1Vawl4-B_LPNc5WcWwWQno62BNRGE`
4. If you have multiple instruments, separate URLs with `|` (pipe)

**Example:**
- Instruments: `Drill | Forceps`
- Instrument Images: `https://drive.google.com/uc?export=view&id=1DXP1Vawl4-B_LPNc5WcWwWQno62BNRGE | https://drive.google.com/uc?export=view&id=ANOTHER_ID`

### Option 2: In Code Mapping
Open `src/App.js` and find the `instrumentImageMap` object, then add:

```javascript
const instrumentImageMap = {
  "Instrument Name": "https://drive.google.com/uc?export=view&id=1DXP1Vawl4-B_LPNc5WcWwWQno62BNRGE",
  // Add more instruments here
};
```

## URL Conversion Formula

**From:** `https://drive.google.com/file/d/FILE_ID/view?usp=drive_link`
**To:** `https://drive.google.com/uc?export=view&id=FILE_ID`

**Steps:**
1. Extract the FILE_ID from your URL (between `/d/` and `/view`)
2. Use format: `https://drive.google.com/uc?export=view&id=FILE_ID`

## Important Notes

1. **Sharing Settings**: Make sure the Google Drive file is set to "Anyone with the link can view"
2. **File ID**: The file ID in your URL is: `1DXP1Vawl4-B_LPNc5WcWwWQno62BNRGE`
3. **Testing**: You can test the URL by opening it directly in a browser - it should show the image

## Quick Test
Open this URL in your browser to verify it works:
```
https://drive.google.com/uc?export=view&id=1DXP1Vawl4-B_LPNc5WcWwWQno62BNRGE
```

If you see the image, it's ready to use in your app!

