# Security Model & Threat Mitigation

## Principles
1. **Zero Trust Architecture**: Never trust client claims. Every incoming request must be cryptographically authenticated and checked against authorization rules.
2. **Role Elevation Protection**: New users are always initialized with the `VIEWER` role. Only verified `ADMIN` accounts can elevate user privileges.
3. **Secret Isolation**: Production secrets (private API keys, database credentials) are never stored in client bundles or public repositories.
4. **Immutable Audit Trail**: Security-relevant events (role elevation, document approval, model execution) are logged to an append-only collection where updates and deletions are barred by Firestore rules.

---

## Authorization Matrix

```
Client Request (Firebase ID Token)
  ↓
Backend Cloud Run Auth Middleware
  ↓
Verify Token Signature with Google Identity Toolkit
  ↓
Extract UID
  ↓
Fetch /users/{uid} from Firestore
  ↓
Check role (ADMIN > RESEARCHER > ANALYST > VIEWER)
  ↓
Evaluate Endpoint Route Policy
  ↓
Permit or Return 403 Forbidden
```

---

## Defense in Depth

### Firestore Security Rules
- Rules run directly at the database engine level.
- Unauthenticated users cannot read or write any documents.
- User profile updates can never alter the `role` attribute unless triggered by an administrator.
- `auditLogs` allow create operations but strictly forbid update and delete operations.

### API Rate Limiting & Abuse Prevention
- Phone Authentication is shielded by Google reCAPTCHA Enterprise.
- AI Gateway endpoints enforce sliding-window rate limits to prevent token exhaustion and runaway cost.
