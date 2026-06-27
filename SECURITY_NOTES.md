# MediScan AI — Security Notes & Firestore Rules

## Firestore Security Rules

The following Firestore security rules should be deployed to enforce server-side data isolation. These rules ensure that each authenticated user can only read and write their own data.

### Recommended Rules

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // ── Users collection ──────────────────────────────────────────────────
    // Each user can only access their own document and subcollections.
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;

      // All subcollections under a user document
      match /{subcollection}/{docId} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }

      // Nested subcollections (e.g., privacySettings/privacyLogs)
      match /{subcollection}/{docId}/{nestedCollection}/{nestedDocId} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }
    }

    // ── Global activity logs (admin view) ─────────────────────────────────
    // Users can write their own activity logs to the global collection.
    // Reading global logs should be restricted to admin users.
    match /activityLogs/{logId} {
      allow create: if request.auth != null
                    && request.resource.data.uid == request.auth.uid;
      allow read, delete: if request.auth != null
                          && resource.data.uid == request.auth.uid;
    }

    // ── Default deny ──────────────────────────────────────────────────────
    // All other documents are denied by default.
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### How to Deploy

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Initialize (if not already): `firebase init firestore`
4. Copy the rules above into `firestore.rules`
5. Deploy: `firebase deploy --only firestore:rules`

---

## Architecture Overview

### Authentication

- **Firebase Authentication** provides each user with a unique, secure UID.
- Supported sign-in methods: Email/Password, Google OAuth 2.0, Phone OTP.
- Authentication state is managed via React context (`AuthProvider`).

### Data Storage

- All user data is stored in **Cloud Firestore** under `users/{uid}/`.
- Each feature module has its own subcollection:
  - `users/{uid}/prescriptions`
  - `users/{uid}/xrayScans`
  - `users/{uid}/labReports`
  - `users/{uid}/reportSummaries`
  - `users/{uid}/medicineReminders`
  - `users/{uid}/aiAssistantLogs`
  - `users/{uid}/activityLogs`
  - `users/{uid}/emergencyEvents`
  - `users/{uid}/smartwatchHealth`
  - `users/{uid}/followUps`
  - `users/{uid}/triageCases`
  - `users/{uid}/privacySettings` (deletion requests, privacy logs)

### API Key Protection

- **OpenRouter AI API keys** are stored as server-side environment variables.
- They use non-`NEXT_PUBLIC_` prefixed names and are never sent to the browser.
- All AI inference calls go through Next.js API routes (`app/api/`).
- The `lib/server/` directory contains server-only modules with a clear comment:
  `// Server-only. NEVER import into client components.`

### Input Security

- **Sanitization**: All user inputs are cleaned via `lib/server/sanitize.ts`:
  - Control characters stripped
  - Length limits enforced (4000 chars for messages, 2000 for context, 8000 for OCR)
- **Rate Limiting**: API endpoints are rate-limited at 30 requests/minute/IP via `lib/server/rate-limit.ts`.

### File Handling

- **No raw file storage**: Firebase Storage is not enabled (billing not activated).
- Uploaded medical documents (images, PDFs) are:
  1. Read client-side into base64
  2. Sent to the API route for processing
  3. Processed via Tesseract OCR and/or AI inference
  4. Only structured results (extracted text, AI summary) are saved to Firestore
  5. The original file data is discarded after processing

### Emergency SOS

- Geolocation is requested **only** when the user activates Emergency SOS.
- No background location tracking occurs.
- Live tracking pages use a shareable URL — the user controls who sees it.
- Location sharing can be disabled at any time.

---

## Firebase Admin SDK Setup (Optional)

For full server-side account deletion (deleting the Firebase Auth user record):

1. Go to [Firebase Console](https://console.firebase.google.com/) → Project Settings → Service Accounts
2. Click "Generate new private key" to download the service account JSON
3. Base64-encode the JSON file:
   ```bash
   # macOS/Linux
   base64 -i serviceAccountKey.json | tr -d '\n'

   # Windows PowerShell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("serviceAccountKey.json"))
   ```
4. Set the environment variable:
   ```
   FIREBASE_ADMIN_SERVICE_ACCOUNT=<base64-encoded-string>
   ```
5. Add this to your `.env.local` (never commit to version control)

Without this setup, the application will:
- Delete all Firestore data successfully
- Attempt client-side `currentUser.delete()` for Auth deletion
- If reauthentication is required, prompt the user to sign in again

---

## Privacy Features

| Feature | Implementation |
|---------|---------------|
| View saved data | Data summary with record counts per subcollection |
| Delete medical data | Batch deletion of 9 subcollections with typed confirmation |
| 7-day deletion request | Stored in `privacySettings/deletionRequest` with scheduled date |
| Cancel deletion | Resets account status to active |
| Permanent deletion | Deletes all data + attempts Auth account removal |
| Privacy logging | All actions logged to `privacySettings/privacyLogs` |
| Data export | PDF export via DataExport component |

---

## Disclaimer

MediScan AI does not claim HIPAA, GDPR, or any specific regulatory compliance. The privacy and security measures implemented are best practices appropriate for a prototype-stage medical AI application. For production deployment handling real patient data, a comprehensive compliance audit would be required.
