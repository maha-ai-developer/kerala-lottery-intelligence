# Authentication & Authorization Specification

## Principle
- **Identity Provider**: Firebase Authentication (Phone Number + SMS OTP).
- **Zero Custom OTP Storage**: We never generate, store, or transmit raw OTP codes ourselves.
- **Zero Password Storage**: No passwords exist anywhere in the platform.
- **Zero Client Trust**: Browser claims of user roles are completely untrusted. The backend must always verify the Firebase ID token and evaluate the user's role from Firestore or custom claims.

---

## Authentication Flow

```
1. User enters phone number (+91 XXXXXXXXXX)
     ↓
2. reCAPTCHA verification triggers silently
     ↓
3. Firebase Phone Auth issues SMS OTP via telecom carrier
     ↓
4. User enters 6-digit OTP code in UI
     ↓
5. Firebase Client SDK validates OTP code with Google servers
     ↓
6. Firebase User object generated / restored
     ↓
7. Client retrieves cryptographically signed Firebase ID Token
     ↓
8. Token sent via Authorization Bearer header to backend API
     ↓
9. Backend decodes UID, retrieves User Profile, and evaluates Role-Based Access Control
```

---

## User Roles & Permissions

| Role | Permissions |
| :--- | :--- |
| `VIEWER` | Default role for all new accounts. Can view verified draws, winning numbers, legal documents, and source citations. |
| `ANALYST` | Inherits `VIEWER`. Can run statistical calculations, create features, configure experiments, and execute walk-forward backtests. |
| `RESEARCHER`| Inherits `ANALYST`. Can upload source PDFs, review extractions, approve draws, modify knowledge graph entities, and publish dataset versions. |
| `ADMIN` | Complete access: elevate user roles, modify system configuration, view audit logs, and trigger maintenance operations. |

---

## Session & Error Handling

The application handles:
- Invalid OTP code entry (with attempts remaining indicator)
- Expired OTP code (with 60-second cooldown resend button)
- Rate-limiting (Firebase `auth/too-many-requests` handling with user-friendly retry timing)
- Session expiration and silent token refresh
- User account deletion flow with compliance purge of personal identifiers
