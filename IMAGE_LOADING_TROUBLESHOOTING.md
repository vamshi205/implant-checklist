# Image Not Loading - Troubleshooting Guide

## ✅ You Can See the Info Icon - Good!
This means the app found the image URL. The issue is with loading the image itself.

## Common Issues & Solutions

### Issue 1: Google Drive Sharing Settings

**Problem:** Image URL exists but image doesn't load

**Solution:**
1. Go to your Google Drive
2. Find the image file
3. Right-click → "Share" or "Get link"
4. **IMPORTANT:** Set sharing to **"Anyone with the link"** (not just "Restricted")
5. Make sure it says "Viewer" access
6. Copy the link again and update your sheet

### Issue 2: Wrong URL Format

**Problem:** Using the wrong Google Drive URL format

**Current URL format you're using:**
```
https://drive.google.com/uc?export=view&id=1DXP1Vawl4-B_LPNc5WcWwWQno62BNRGE
```

**Try these alternative formats:**

**Option A - Direct download:**
```
https://drive.google.com/uc?export=download&id=1DXP1Vawl4-B_LPNc5WcWwWQno62BNRGE
```

**Option B - Thumbnail (faster):**
```
https://drive.google.com/thumbnail?id=1DXP1Vawl4-B_LPNc5WcWwWQno62BNRGE&sz=w1000
```

**Option C - Using file/d/ format:**
If your original link was: `https://drive.google.com/file/d/1DXP1Vawl4-B_LPNc5WcWwWQno62BNRGE/view`
Try: `https://drive.google.com/file/d/1DXP1Vawl4-B_LPNc5WcWwWQno62BNRGE/preview`

### Issue 3: Check Browser Console

**Steps:**
1. Open your app in browser
2. Press **F12** (or Cmd+Option+I on Mac) to open Developer Tools
3. Click the **Console** tab
4. Click the info icon to open the image
5. Look for error messages in red

**Common errors:**
- `CORS policy` - Sharing settings issue
- `404 Not Found` - Wrong file ID or file deleted
- `403 Forbidden` - Not shared publicly

### Issue 4: Test the URL Directly

**Steps:**
1. Copy the exact URL from your Google Sheet
2. Paste it in a new browser tab
3. Press Enter

**Expected result:** Image should display directly
**If it doesn't:** The URL or sharing settings are wrong

### Issue 5: Use Alternative Image Hosting

If Google Drive continues to have issues, consider:

**Option A - Imgur:**
1. Upload image to imgur.com
2. Get direct link: `https://i.imgur.com/IMAGE_ID.jpg`

**Option B - GitHub:**
1. Upload to GitHub repository
2. Use raw URL: `https://raw.githubusercontent.com/user/repo/branch/image.jpg`

**Option C - Local images:**
1. Put images in `public/images/instruments/`
2. Use: `/images/instruments/filename.jpg`

## Quick Debug Steps

1. **Open browser console** (F12)
2. **Click the info icon**
3. **Check console for:**
   - "Opening image for: [instrument name]"
   - "Image URL: [url]"
   - Any error messages

4. **Check the modal:**
   - Does it open?
   - Do you see "Image not available"?
   - Is there an error message below the image?

5. **Test the URL:**
   - Copy URL from console
   - Paste in new browser tab
   - Does it show the image?

## Updated Code Features

I've added debugging to help you:
- Console logs when opening image
- Error messages in the modal
- URL display in the modal (so you can verify it's correct)

## Most Likely Solution

**Try this URL format instead:**
```
https://drive.google.com/thumbnail?id=1DXP1Vawl4-B_LPNc5WcWwWQno62BNRGE&sz=w1000
```

Or ensure the file is shared as "Anyone with the link can view" and use:
```
https://drive.google.com/file/d/1DXP1Vawl4-B_LPNc5WcWwWQno62BNRGE/preview
```

## Still Not Working?

1. Check browser console (F12) for specific errors
2. Verify the URL works when opened directly in browser
3. Try a different image hosting service
4. Check if there are any browser extensions blocking images

