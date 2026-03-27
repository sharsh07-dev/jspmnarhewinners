# AgroShare Deployment Guide

## Prerequisites
1. Node.js installed on your machine
2. Firebase CLI installed (`npm install -g firebase-tools`)
3. Vercel CLI installed (Optional for Vercel deployment: `npm i -g vercel`)

## Local Development
1. Run `npm install`
2. Run `npm run dev`
3. The app will start locally, usually at `http://localhost:5173`

## Firebase Hosting Deployment (Recommended)

1. **Login to Firebase:**
   ```bash
   firebase login
   ```

2. **Initialize Firebase in your project:**
   ```bash
   firebase init hosting
   ```
   - Select the existing project: `agroshare-17977`
   - What do you want to use as your public directory? `dist`
   - Configure as a single-page app (rewrite all urls to /index.html)? `Yes`
   - Set up automatic builds and deploys with GitHub? `No` (or Yes if desired)

3. **Build the application for production:**
   ```bash
   npm run build
   ```

4. **Deploy to Firebase Hosting:**
   ```bash
   firebase deploy --only hosting
   ```

## Firebase Database Security Rules
To ensure secure access rules (Firebase rules), go to your Firebase Console -> Realtime Database -> Rules and paste this:

```json
{
  "rules": {
    "users": {
        ".read": "auth != null",
        "$uid": {
            ".write": "$uid === auth.uid || root.child('users/'+auth.uid+'/role').val() === 'admin'"
        }
    },
    "equipment": {
        ".read": true,
        "$eqId": {
            ".write": "auth != null && (root.child('users/'+auth.uid+'/role').val() === 'owner' || root.child('users/'+auth.uid+'/role').val() === 'admin')"
        }
    },
    "bookings": {
        ".read": "auth != null",
        "$bookId": {
             ".write": "auth != null" 
        }
    }
  }
}
```

## Vercel Deployment

1. Run `vercel` in your project root.
2. Follow the interactive prompts to link your project.
3. Vercel will auto-detect Vite and deploy the production build. Ensure your environment variables from `firebaseConfig.js` are securely placed in Vercel.

---

### Key Features implemented:
✅ **Auth:** Real Firebase Authentication (Email + Google) fully integrated with Zustand.
✅ **UI:** Green-themed modern components. Tailwind applied completely.
✅ **Booking logic:** `runTransaction` used in Firebase to prevent double booking.
✅ **Storage:** Unauthenticated upload mapped over Cloudinary.
✅ **Roles:** Admin panel accessible to Admin, owners get 'add equipment' option, farmers get booking capabilities.
