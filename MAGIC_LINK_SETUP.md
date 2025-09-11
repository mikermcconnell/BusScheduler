# Magic Link Authentication Setup Guide for Scheduler2

## Overview
This guide will help you configure Firebase Authentication for Magic Link (passwordless email) sign-in in your Scheduler2 application.

## Prerequisites
- Firebase project created
- Firebase configuration added to `.env` file
- Node.js and npm installed

## Firebase Console Configuration

### Step 1: Enable Email/Password Authentication
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your Scheduler2 project
3. Navigate to **Authentication** → **Sign-in method**
4. Click on **Email/Password**
5. Enable **Email/Password** (first toggle)
6. Enable **Email link (passwordless sign-in)** (second toggle)
7. Click **Save**

### Step 2: Configure Authorized Domains
1. In Authentication → Settings → **Authorized domains**
2. Add your production domain (e.g., `scheduler2.app`)
3. Add your development domain (e.g., `localhost`)
4. Add any staging domains if applicable

### Step 3: Customize Email Template (Optional)
1. Go to Authentication → **Templates**
2. Select **Email address verification**
3. Click the pencil icon to edit
4. Customize the template with your branding:

```html
Subject: Sign in to Scheduler2

Message:
Hello,

Click the link below to sign in to Scheduler2:

%LINK%

This link will expire in 1 hour and can only be used once.

If you didn't request this, you can safely ignore this email.

Best regards,
The Scheduler2 Team
```

### Step 4: Configure Email Settings
1. Go to Authentication → Settings → **User actions**
2. Set the action URL to: `https://yourdomain.com/auth/email-link`
3. For development, use: `http://localhost:3000/auth/email-link`

## Environment Configuration

### Update `.env` file
Add or update these environment variables:

```bash
# Firebase Configuration
REACT_APP_FIREBASE_API_KEY=your-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-auth-domain
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-storage-bucket
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
REACT_APP_FIREBASE_APP_ID=your-app-id

# Magic Link Configuration
REACT_APP_MAGIC_LINK_DOMAIN=http://localhost:3000
# For production: REACT_APP_MAGIC_LINK_DOMAIN=https://scheduler2.app

# Optional: Dynamic Links (for mobile apps)
# REACT_APP_DYNAMIC_LINK_DOMAIN=scheduler2.page.link
```

## Testing the Implementation

### Local Development Testing
1. Start the development server:
   ```bash
   npm start
   ```

2. Navigate to http://localhost:3000

3. Click on the **Email** authentication method

4. Enter your email address

5. Click **Send Magic Link**

6. Check your email for the sign-in link

7. Click the link to complete authentication

### Testing Checklist
- [ ] Email validation works (invalid emails show error)
- [ ] Rate limiting prevents spam (60-second cooldown, max 5 attempts/hour)
- [ ] Magic link email arrives within 1-2 minutes
- [ ] Clicking the link successfully signs in the user
- [ ] Link expires after 24 hours
- [ ] Link can only be used once
- [ ] "Check Your Email" page shows correct instructions
- [ ] Resend email functionality works with countdown timer
- [ ] User remains signed in after browser refresh
- [ ] Sign out functionality works correctly
- [ ] Cross-device sign-in works (email prompt on different device)

## Production Deployment

### Pre-Deployment Checklist
1. **Update Environment Variables**
   - Set `REACT_APP_MAGIC_LINK_DOMAIN` to production URL
   - Ensure all Firebase config variables are set

2. **Configure Custom Domain Email**
   - Set up SPF records for your domain
   - Configure DKIM for better deliverability
   - Use a custom "from" address (e.g., noreply@scheduler2.app)

3. **Security Rules**
   Update Firestore security rules:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       // Users can only read/write their own data
       match /users/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
       
       // Schedules are tied to authenticated users
       match /schedules/{scheduleId} {
         allow read: if request.auth != null && 
           resource.data.userId == request.auth.uid;
         allow create: if request.auth != null;
         allow update, delete: if request.auth != null && 
           resource.data.userId == request.auth.uid;
       }
     }
   }
   ```

4. **Monitor Authentication**
   - Set up Firebase Analytics events for sign-in success/failure
   - Monitor email delivery rates in Firebase Console
   - Set up alerts for authentication errors

### Deployment Steps
1. Build the production bundle:
   ```bash
   npm run build
   ```

2. Deploy to your hosting service (Firebase Hosting, Vercel, Netlify, etc.)

3. Test the production authentication flow

4. Monitor initial user sign-ins for any issues

## Troubleshooting

### Common Issues and Solutions

#### Email not received
- Check spam/junk folder
- Verify email address is correct
- Check Firebase email quota (free tier: 100 emails/day)
- Verify domain is in authorized domains list

#### "Invalid sign-in link" error
- Link may have expired (24-hour limit)
- Link may have been used already
- User may be on a different device/browser
- URL may have been modified by email client

#### Rate limiting issues
- Wait 60 seconds between email requests
- Clear localStorage to reset rate limits (development only)
- Check browser console for specific error messages

#### Cross-device sign-in not working
- Ensure user enters the same email on both devices
- Check that localStorage is not disabled
- Verify cookies are enabled in the browser

### Debug Mode
Enable debug logging in development:

```javascript
// In App.tsx or index.tsx
if (process.env.NODE_ENV === 'development') {
  window.localStorage.setItem('debug', 'scheduler2:*');
}
```

## Security Considerations

### Best Practices
1. **Always use HTTPS** in production
2. **Implement rate limiting** (already built-in)
3. **Monitor for abuse** using Firebase Analytics
4. **Regular security audits** of authentication flow
5. **Keep Firebase SDK updated** to latest version

### Data Privacy
- Email addresses are stored securely in Firebase Auth
- No passwords are stored (passwordless system)
- User data is isolated by Firebase Auth UID
- Sessions expire after browser is closed (configurable)

## Advanced Configuration

### Session Persistence
Modify session persistence in `AuthContext.tsx`:

```javascript
import { setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';

// For persistent login (survives browser restart)
await setPersistence(auth, browserLocalPersistence);

// For session-only (cleared when browser closes)
await setPersistence(auth, browserSessionPersistence);
```

### Custom Email Providers
To use a custom email service (SendGrid, Mailgun, etc.):

1. Set up Firebase Functions
2. Override the default email sending
3. Implement custom email templates
4. Handle delivery tracking

### Multi-Factor Authentication (Future Enhancement)
Magic Links can be combined with:
- SMS verification
- TOTP (Time-based One-Time Passwords)
- Backup codes

## Support and Resources

### Documentation
- [Firebase Auth Documentation](https://firebase.google.com/docs/auth)
- [Email Link Authentication Guide](https://firebase.google.com/docs/auth/web/email-link-auth)
- [Firebase Security Rules](https://firebase.google.com/docs/rules)

### Getting Help
- Check the [troubleshooting section](#troubleshooting) above
- Review browser console for error messages
- Check Firebase Console for authentication logs
- Contact support with specific error messages and steps to reproduce

## Implementation Status
✅ Magic Link Service (`src/services/magicLinkAuth.ts`)
✅ Sign-In Page with Email option (`src/components/SignInPage.tsx`)
✅ Check Email Page (`src/components/CheckEmailPage.tsx`)
✅ Email Link Handler (`src/components/EmailLinkHandler.tsx`)
✅ Auth Context Integration (`src/contexts/AuthContext.tsx`)
✅ Protected Routes (`src/components/ProtectedRoute.tsx`)
✅ Rate Limiting
✅ Email Validation
✅ Session Management
✅ Cross-Device Support

---

**Last Updated**: January 2025
**Version**: 1.0.0
**Status**: Production Ready