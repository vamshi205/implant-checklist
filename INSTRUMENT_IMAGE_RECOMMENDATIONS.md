# Instrument Image Popup - Implementation Recommendations

## Image Storage Options

### Option 1: Google Drive (Recommended for Easy Management)
**Pros:**
- Easy to add/update images without code changes
- No need to commit large image files to repository
- Can be managed by non-technical users
- Good for frequently changing images

**Cons:**
- Requires public sharing or API access
- Slightly slower loading (depends on Drive performance)
- Need to ensure proper sharing permissions

**Implementation:**
- Store image URLs in Google Sheets (add new column)
- Or create a mapping object with instrument names → Drive URLs
- Use direct image links: `https://drive.google.com/uc?export=view&id=FILE_ID`

### Option 2: Local Storage (Recommended for Performance)
**Pros:**
- Fast loading (served from same domain)
- No external dependencies
- Better for offline use
- Full control over images

**Cons:**
- Need to commit images to repository
- Repository size increases
- Requires code deployment for image updates

**Implementation:**
- Store images in `public/images/instruments/`
- Use relative paths: `/images/instruments/instrument-name.jpg`
- Create a mapping object or JSON file

### Option 3: Hybrid Approach (Best of Both Worlds)
**Pros:**
- Use local storage for common instruments
- Use Google Drive for new/dynamic instruments
- Fallback mechanism

**Cons:**
- More complex implementation
- Need to manage two sources

## Recommendation: **Google Drive with Sheet Integration**

**Why:**
1. Your app already uses Google Sheets for data
2. Easy to add image URLs as a new column
3. Non-technical users can manage images
4. No repository bloat
5. Can update images without code changes

## Implementation Plan

### Step 1: Update Google Sheets
Add a new column "Instrument Images" with format:
- Pipe-separated URLs matching instrument order
- Example: `https://drive.google.com/uc?export=view&id=ABC123|https://drive.google.com/uc?export=view&id=XYZ789`

### Step 2: Parse Image URLs
Extract image URLs when parsing procedures from CSV

### Step 3: Add Info Icon
Add Info icon from lucide-react next to each instrument

### Step 4: Create Image Modal
Create a reusable modal component to display images

### Step 5: Handle Click Events
Open modal when info icon is clicked

## Google Drive Image URL Format

### Getting Public Image URL from Google Drive:
1. Upload image to Google Drive
2. Right-click → Get link → Set to "Anyone with the link"
3. Extract File ID from URL: `https://drive.google.com/file/d/FILE_ID/view`
4. Use direct image URL: `https://drive.google.com/uc?export=view&id=FILE_ID`

### Alternative: Use Google Drive API
- More complex but better control
- Requires API credentials
- Better for production apps

## Alternative: JSON Mapping File

If you prefer not to modify Google Sheets:
- Create `public/instrument-images.json`:
```json
{
  "Drill": "https://drive.google.com/uc?export=view&id=ABC123",
  "Forceps": "https://drive.google.com/uc?export=view&id=XYZ789"
}
```

## Performance Considerations

1. **Lazy Loading**: Load images only when modal opens
2. **Image Optimization**: Compress images before uploading
3. **Caching**: Browser will cache images automatically
4. **Fallback**: Show placeholder if image fails to load

## Security Considerations

1. **Public Links**: Ensure Drive links are set to "Anyone with link"
2. **Validation**: Validate image URLs before displaying
3. **Error Handling**: Handle broken/missing image URLs gracefully

