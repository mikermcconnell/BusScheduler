# Magic Links (Passwordless Email) Authentication Setup

## Overview
Magic Links provide a secure, passwordless authentication method for Scheduler2. Users enter their email address and receive a sign-in link that logs them in directly - no password needed!

## Features
- **Passwordless Authentication**: No passwords to remember or manage
- **Secure Sign-in Links**: Each link is unique and expires after 24 hours
- **Rate Limiting**: Prevents abuse with built-in rate limiting
- **Email Provider Detection**: Auto-detects Gmail, Outlook, etc. for quick email access
- **Graceful Error Handling**: Clear messages for expired links, network issues, etc.
- **Dual Authentication**: Works alongside existing Google OAuth sign-in

## Setup Instructions

### 1. Firebase Console Configuration

1. **Enable Email Authentication**:
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select your project
   - Navigate to **Authentication → Sign-in method**
   - Enable **Email/Password** provider
   - Check the **Email link (passwordless sign-in)** option
   - Click **Save**

2. **Configure Authorized Domains**:
   - In Authentication → Settings → Authorized domains
   - Add your domains:
     - `localhost` (for development)
     - Your production domain (e.g., `scheduler2.app`)
   - Click **Add domain** for each

3. **Customize Email Template** (Optional):
   - Go to **Authentication → Templates**
   - Select **Email address verification**
   - Customize the email subject and content
   - Add your app branding
   - Test the template with preview

### 2. Environment Configuration

Add these variables to your `.env` file:

```env
# Magic Link Configuration
REACT_APP_MAGIC_LINK_DOMAIN=http://localhost:3000  # For development
# REACT_APP_MAGIC_LINK_DOMAIN=https://yourapp.com  # For production

# Optional: Dynamic Links (for mobile app support)
REACT_APP_DYNAMIC_LINK_DOMAIN=  # Leave empty if not using
```

### 3. Testing with Firebase Emulator

For local development without sending real emails:

1. **Start Firebase Emulator**:
   ```bash
   firebase emulators:start --only auth
   ```

2. **Enable Emulator in .env**:
   ```env
   REACT_APP_USE_FIREBASE_EMULATOR=true
   ```

3. **Access Emulator UI**:
   - Open http://localhost:4000
   - Navigate to Authentication tab
   - View and test magic link emails without sending

## User Flow

### Sending Magic Link
1. User clicks "Email" sign-in option
2. Enters email address
3. Clicks "Send Magic Link"
4. System validates email and checks rate limits
5. Firebase sends authentication email
6. User sees confirmation screen with instructions

### Completing Sign-in
1. User clicks link in email
2. Browser opens to `/auth/email-link` route
3. System validates the link
4. If valid, user is signed in automatically
5. Redirects to dashboard

### Error Scenarios
- **Expired Link**: Links expire after 24 hours
- **Already Used**: Each link can only be used once
- **Invalid Email**: Email validation before sending
- **Rate Limited**: Max 5 attempts per hour per email
- **Network Issues**: Graceful fallback with retry options

## Security Features

### Rate Limiting
- **Per-Email Limits**: 5 attempts per hour
- **Cooldown Period**: 60 seconds between requests
- **Local Storage Tracking**: Client-side rate limit enforcement

### Link Security
- **Single Use**: Links become invalid after first use
- **Time-Limited**: 24-hour expiration
- **Domain Restricted**: Only works from authorized domains
- **HTTPS Required**: Production links require secure connection

### Data Protection
- **Email Storage**: Temporarily stored in localStorage (cleared after sign-in)
- **No Passwords**: Eliminates password-related vulnerabilities
- **Firebase Security**: Leverages Firebase Auth security features

## Implementation Details

### Key Components

1. **`magicLinkAuth.ts`**: Core service handling all magic link operations
2. **`SignInPage.tsx`**: Updated with email input and toggle for auth methods
3. **`CheckEmailPage.tsx`**: Confirmation screen after sending link
4. **`EmailLinkHandler.tsx`**: Processes return from email links

### API Methods

```typescript
// Send magic link to email
await magicLinkAuth.sendMagicLink(email);

// Check if URL is a valid sign-in link
magicLinkAuth.isEmailLink(url);

// Complete sign-in with email link
await magicLinkAuth.completeMagicLinkSignIn(url);

// Utility methods
magicLinkAuth.isValidEmail(email);
magicLinkAuth.clearStoredEmail();
magicLinkAuth.clearRateLimit(email);
```

## Troubleshooting

### Common Issues

1. **"Email not found" error**:
   - User switched browsers/devices
   - localStorage was cleared
   - Solution: Prompt user to re-enter email

2. **Link expired**:
   - Link is older than 24 hours
   - Solution: Request new magic link

3. **Rate limit hit**:
   - Too many requests in short time
   - Solution: Wait for cooldown period

4. **Email not received**:
   - Check spam/junk folder
   - Verify email address is correct
   - Check Firebase email quota

### Debug Mode

Enable debug logging in console:
```javascript
localStorage.setItem('DEBUG_MAGIC_LINKS', 'true');
```

## Testing Checklist

- [ ] Send magic link successfully
- [ ] Receive email (or view in emulator)
- [ ] Click link and complete sign-in
- [ ] Test expired link handling (wait 24h or modify timestamp)
- [ ] Test rate limiting (send 6 requests quickly)
- [ ] Test invalid email formats
- [ ] Test cross-browser sign-in
- [ ] Test email resend functionality
- [ ] Test "back to sign-in" navigation
- [ ] Test with Firebase emulator

## Production Considerations

1. **Email Deliverability**:
   - Configure SPF/DKIM records
   - Monitor bounce rates
   - Consider using custom domain for emails

2. **Monitoring**:
   - Track sign-in success rates
   - Monitor email send failures
   - Set up alerts for unusual activity

3. **Scaling**:
   - Firebase Auth handles scaling automatically
   - Monitor quotas in Firebase Console
   - Consider upgrading plan if needed

4. **User Support**:
   - Provide clear instructions in UI
   - Include troubleshooting in help docs
   - Consider fallback auth methods

## Migration from Password Auth

If migrating existing users:

1. **Gradual Migration**:
   - Keep both auth methods available
   - Encourage magic links for new sign-ins
   - Phase out passwords over time

2. **User Communication**:
   - Email users about the change
   - Provide clear benefits
   - Offer support during transition

## Next Steps

1. **Enable in Firebase Console** (required)
2. **Update environment variables** (required)
3. **Test in development** with emulator
4. **Deploy to staging** for real email testing
5. **Monitor initial rollout** in production
6. **Gather user feedback** and iterate

---

## Support

For issues or questions:
- Check Firebase Auth documentation
- Review error logs in Firebase Console
- Test with Firebase Auth emulator
- Contact support with specific error messages

Last Updated: January 2025