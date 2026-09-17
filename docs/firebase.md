# Firebase Setup & Configuration

## Overview
The platform uses **Firebase** for Authentication (Phone Number + SMS OTP), **Cloud Firestore** for canonical transactional records, and **Firebase App Hosting** for Next.js web application hosting on Google Cloud Run.

- **Project ID**: `kerala-lottery-intelligence`
- **Region**: `asia-south1` (Mumbai)

---

## 1. Firebase Authentication (Phone Number + SMS OTP)

### Configuration in Firebase Console
1. Navigate to **Authentication** > **Sign-in method**.
2. Enable **Phone** as a sign-in provider.
3. For local testing without incurring SMS charges, configure test phone numbers under **Phone numbers for testing**:
   - Example: `+91 9999999999` with SMS verification code `123456`.
4. Ensure reCAPTCHA verification is configured for anti-abuse protection.

### Flow
```
User enters phone number (+91 ...) 
  ──> reCAPTCHA anti-abuse check
  ──> Firebase Phone Auth sends SMS OTP
  ──> User enters 6-digit OTP
  ──> Firebase verifies OTP & creates/restores Firebase User
  ──> ID token passed to backend for role verification
```

---

## 2. Cloud Firestore Database

### Database Mode
- Database: `(default)` in Native mode.
- Region: `asia-south1`.

### Security Rules
- Configured in [firestore.rules](file:///home/pi/kerela-lottery-project/kerala-lottery-intelligence/firestore.rules).
- Enforces role-based permissions: `ADMIN`, `RESEARCHER`, `ANALYST`, `VIEWER`.
- Defaults new users to `VIEWER`. Role elevation can only be executed by administrators.
- Prevents tampering with canonical numbers or audit logs.

### Deploying Firestore Rules & Indexes
```bash
npx -y firebase-tools@latest deploy --only firestore:rules,firestore:indexes --project kerala-lottery-intelligence
```

---

## 3. Firebase App Hosting

The Next.js web application is deployed via Firebase App Hosting:
- Configuration file: [apphosting.yaml](file:///home/pi/kerela-lottery-project/kerala-lottery-intelligence/apphosting.yaml).
- Cloud Run service managed automatically by Google Cloud Build on Git commits.
- Zero-downtime rollouts with automatic rollback on build failures.

---

## 4. Local Development with Emulators

Run the local emulator suite:
```bash
npx -y firebase-tools@latest emulators:start
```
- Emulator UI: `http://localhost:4000`
- Auth Emulator: `localhost:9099`
- Firestore Emulator: `localhost:8080`
- Storage Emulator: `localhost:9199`
