# Firebase Setup Guide for Scheduler2

This guide will help you set up Firebase data storage for the Scheduler2 bus scheduling application, replacing the current localStorage system with cloud-based storage.

## Overview

Firebase provides:
- **Cloud storage** with automatic backups and sync across devices
- **Real-time updates** when schedules change
- **User authentication** for multi-user environments
- **Scalable storage** that grows with your data needs
- **Offline support** that syncs when connection is restored

## Prerequisites

- A Google account
- Node.js and npm installed
- The Scheduler2 application running locally

## Step 1: Create a Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Click **"Create a project"** or **"Add project"**
3. Enter project name: `scheduler2` (or your preferred name)
4. Optionally disable Google Analytics (not needed for this app)
5. Click **"Create project"** and wait for setup to complete

## Step 2: Enable Firestore Database

1. In your Firebase project, go to **Firestore Database** in the left sidebar
2. Click **"Create database"**
3. Choose **"Start in test mode"** (we'll secure it later)
4. Select your preferred location (choose closest to your users)
5. Click **"Done"**

## Step 3: Add Web App to Project

1. In the Firebase console, click the **web icon (</>) ** to add a web app
2. Enter app nickname: `Scheduler2 Web App`
3. **Don't check** "Also set up Firebase Hosting" (optional)
4. Click **"Register app"**
5. **Copy the config object** - you'll need these values next

The config will look like this:
```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "scheduler2-xxx.firebaseapp.com",
  projectId: "scheduler2-xxx",
  storageBucket: "scheduler2-xxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123def456",
  measurementId: "G-ABCDEFGHIJ"
};
```

## Step 4: Configure Environment Variables

1. Copy `.env.example` to `.env` in your project root
2. Fill in the Firebase configuration values:

```bash
# Copy from your Firebase project config
REACT_APP_FIREBASE_API_KEY=your_api_key_here
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
REACT_APP_FIREBASE_APP_ID=1:123456789:web:abc123def456
REACT_APP_FIREBASE_MEASUREMENT_ID=G-ABCDEFGHIJ

# For local development (optional)
REACT_APP_USE_FIREBASE_EMULATOR=false
```

## Step 5: Set Up Authentication (Optional but Recommended)

1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Enable your preferred sign-in methods:
   - **Email/Password**: For simple email-based accounts
   - **Google**: For Google account sign-in
   - **Anonymous**: For guest users (temporary accounts)

For email/password authentication:
1. Click **Email/Password**
2. Enable **Email/Password** (first toggle)
3. Optionally enable **Email link (passwordless sign-in)**
4. Click **Save**

## Step 6: Configure Firestore Security Rules

1. Go to **Firestore Database** → **Rules** tab
2. Replace the default rules with these secure rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow users to read/write their own schedules
    match /schedules/{scheduleId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
    
    // Allow users to read/write their own draft schedules
    match /draft_schedules/{draftId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
    
    // Allow users to read/write their own profile
    match /user_profiles/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

3. Click **Publish** to apply the rules

## Step 7: Test the Connection

1. Restart your development server: `npm start`
2. Open the browser console (F12)
3. Look for the message: `🔥 Firebase user authenticated: [user-id]` or `🔥 Firebase user signed out`
4. Try creating a schedule to test if data is being saved to Firebase

## Step 8: Migrate Existing Data (If You Have Local Data)

If you already have schedules stored locally:

1. Sign in to your Firebase app
2. The app will automatically detect local data and show a migration dialog
3. Follow the migration wizard to:
   - Create a backup of your local data
   - Transfer data to Firebase
   - Verify the migration was successful
   - Optionally clear local data

You can also trigger migration manually through the Settings page.

## Development with Firebase Emulators (Optional)

For local development without hitting the live Firebase services:

1. Install Firebase CLI globally:
```bash
npm install -g firebase-tools
```

2. Login to Firebase:
```bash
firebase login
```

3. Initialize Firebase in your project:
```bash
firebase init
```
Select:
- Firestore
- Authentication  
- Functions (if needed)
- Emulators

4. Start the emulators:
```bash
firebase emulators:start
```

5. Set environment variable:
```bash
REACT_APP_USE_FIREBASE_EMULATOR=true
```

## Firestore Data Structure

Your data will be organized in these collections:

```
/schedules/{scheduleId}
  - userId: string
  - routeName: string
  - direction: string
  - effectiveDate: string
  - status: 'Active' | 'Draft' | 'Expired'
  - tripCount: { weekday, saturday, sunday }
  - summarySchedule: { ... }
  - createdAt: timestamp
  - updatedAt: timestamp

/draft_schedules/{draftId}
  - userId: string
  - fileName: string
  - fileType: 'excel' | 'csv'
  - uploadedData: { ... }
  - processingStep: string
  - createdAt: timestamp
  - updatedAt: timestamp

/user_profiles/{userId}
  - displayName: string
  - email: string
  - preferences: { ... }
  - createdAt: timestamp
```

## Monitoring and Analytics

### Firebase Console Monitoring

1. **Firestore Usage**: Database → Usage tab
   - Monitor reads/writes
   - Track storage usage
   - View performance metrics

2. **Authentication**: Authentication → Users tab
   - View registered users
   - Monitor sign-in activity

3. **Project Usage**: Project Settings → Usage and billing
   - Track overall project usage
   - Monitor costs

### Cost Optimization Tips

1. **Use efficient queries**:
   - Index frequently queried fields
   - Limit query results where possible
   - Use pagination for large datasets

2. **Monitor usage**:
   - Firebase free tier includes:
     - 50,000 reads/day
     - 20,000 writes/day
     - 1GB storage
   - Set up billing alerts

3. **Optimize data structure**:
   - Avoid deeply nested documents
   - Use subcollections for large arrays
   - Minimize document size

## Troubleshooting

### Common Issues

1. **"Permission denied" errors**:
   - Check Firestore security rules
   - Ensure user is authenticated
   - Verify userId matches document ownership

2. **"Project not found" errors**:
   - Check `REACT_APP_FIREBASE_PROJECT_ID` in `.env`
   - Ensure project exists in Firebase Console

3. **Authentication not working**:
   - Check if sign-in methods are enabled
   - Verify `authDomain` in config
   - Check browser console for errors

4. **Data not syncing**:
   - Check network connection
   - Verify Firestore rules allow reads/writes
   - Look for errors in browser console

### Debug Mode

Enable debug mode by adding to your browser console:
```javascript
// Enable Firestore debug logging
firebase.firestore.setLogLevel('debug');
```

## Backup and Recovery

### Automatic Backups

Firebase automatically backs up your data, but you can also:

1. **Export data** using Firebase CLI:
```bash
firebase firestore:export gs://your-bucket/backups/
```

2. **Set up scheduled exports** using Google Cloud Functions

### Manual Backup

The app includes a backup feature:
1. Go to Settings → Data Management
2. Click "Download Backup"
3. Save the JSON file securely

## Production Considerations

1. **Enable security rules** (as shown in Step 6)
2. **Set up monitoring** and alerts
3. **Configure backups** and disaster recovery
4. **Review Firebase security checklist**
5. **Set up proper user authentication**
6. **Monitor costs** and usage
7. **Consider Firebase App Check** for additional security

## Support

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Getting Started](https://firebase.google.com/docs/firestore/quickstart)
- [Firebase Console](https://console.firebase.google.com/)
- [Firebase CLI Reference](https://firebase.google.com/docs/cli)

For Scheduler2-specific issues, check the application logs and error messages in the browser console.