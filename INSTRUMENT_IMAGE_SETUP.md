# Instrument Image Setup Guide

## Implementation Complete! ✅

The feature has been implemented. You can now add info icons next to instruments that will show image popups when clicked.

## How It Works

1. **Info Icon**: An info icon (ℹ️) appears next to instruments that have images
2. **Click to View**: Click the info icon to open a modal with the instrument image
3. **Two Image Sources**: Images can come from:
   - **Google Sheets** (7th column - recommended)
   - **Code mapping** (fallback for instruments not in sheets)

## Option 1: Google Sheets (Recommended)

### Step 1: Add Image Column to Google Sheets
Add a 7th column to your Google Sheet named "Instrument Images"

**Column Order:**
1. Procedure Name
2. Items
3. Fixed Items
4. Fixed Qty
5. Instruments
6. Type
7. **Instrument Images** ← New column

### Step 2: Get Google Drive Image URLs

For each instrument, you need a Google Drive image URL:

1. **Upload image to Google Drive**
2. **Right-click the image** → "Get link"
3. **Set sharing to "Anyone with the link"**
4. **Copy the link** - it will look like:
   ```
   https://drive.google.com/file/d/FILE_ID/view?usp=sharing
   ```
5. **Convert to direct image URL**:
   ```
   https://drive.google.com/uc?export=view&id=FILE_ID
   ```
   (Replace `FILE_ID` with the ID from your link)

### Step 3: Add URLs to Sheet

In the "Instrument Images" column, add pipe-separated URLs matching the instrument order:

**Example:**
- Instruments: `Drill | Forceps | Retractor`
- Instrument Images: `https://drive.google.com/uc?export=view&id=ABC123 | https://drive.google.com/uc?export=view&id=XYZ789 | https://drive.google.com/uc?export=view&id=DEF456`

**Important:** 
- URLs must be in the same order as instruments
- Use `|` (pipe) to separate URLs
- Leave empty if an instrument has no image

## Option 2: Code Mapping (Fallback)

If you prefer not to modify Google Sheets, you can add images directly in the code:

### Step 1: Open `src/App.js`

### Step 2: Find the `instrumentImageMap` object (around line 45)

### Step 3: Add your instrument-image mappings:

```javascript
const instrumentImageMap = {
  "Drill": "https://drive.google.com/uc?export=view&id=YOUR_FILE_ID",
  "Forceps": "https://drive.google.com/uc?export=view&id=YOUR_FILE_ID",
  "Retractor": "https://drive.google.com/uc?export=view&id=YOUR_FILE_ID",
  // Add more instruments as needed
};
```

### Step 4: Save and the images will be available

## Option 3: Local Images (Alternative)

If you want to use local images instead of Google Drive:

### Step 1: Create images folder
```bash
mkdir -p public/images/instruments
```

### Step 2: Add your images
Place instrument images in `public/images/instruments/`:
- `drill.jpg`
- `forceps.jpg`
- etc.

### Step 3: Update the mapping
```javascript
const instrumentImageMap = {
  "Drill": "/images/instruments/drill.jpg",
  "Forceps": "/images/instruments/forceps.jpg",
  // etc.
};
```

## Priority Order

The app checks for images in this order:
1. **Google Sheets column** (7th column) - Highest priority
2. **Code mapping** (`instrumentImageMap`) - Fallback
3. **No image** - Info icon won't appear

## Testing

1. **Add images** using one of the methods above
2. **Refresh the app** (or refetch procedures)
3. **Look for info icons** (ℹ️) next to instruments with images
4. **Click the info icon** to see the image popup
5. **Click outside or X button** to close the modal

## Image Requirements

- **Format**: JPG, PNG, or any web-compatible format
- **Size**: Recommended max 2MB per image
- **Dimensions**: Any size (will be auto-scaled in modal)
- **Access**: Must be publicly accessible (for Google Drive, set to "Anyone with link")

## Troubleshooting

### Info icon doesn't appear
- Check that the image URL is correct
- Verify the URL is accessible (try opening in browser)
- Ensure the instrument name matches exactly (case-sensitive)

### Image doesn't load
- Check browser console for errors
- Verify the Google Drive link is set to "Anyone with link"
- Try the direct image URL format: `https://drive.google.com/uc?export=view&id=FILE_ID`

### Image appears but is broken
- The image URL might be incorrect
- The file might have been deleted or moved
- Check sharing permissions on Google Drive

## Example Google Sheet Format

| Procedure Name | Items | Fixed Items | Fixed Qty | Instruments | Type | Instrument Images |
|---------------|-------|-------------|-----------|-------------|------|-------------------|
| Hip Replacement | ... | ... | ... | Drill\|Forceps | Hip | https://drive.google.com/uc?export=view&id=ABC123\|https://drive.google.com/uc?export=view&id=XYZ789 |

## Notes

- Images are loaded lazily (only when modal opens)
- Modal is responsive and works on mobile
- Images are cached by the browser
- If an image fails to load, a placeholder is shown

