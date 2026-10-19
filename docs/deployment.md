# Deployment & Release Engineering

## Pipeline Architecture

```
GitHub (maha-ai-developer/kerala-lottery-intelligence)
  ↓
Merge to 'main' branch
  ↓
GitHub CI Checks (Lint, Typecheck, Invariant Tests, Build)
  ↓
Firebase App Hosting Trigger (Webhook)
  ↓
Google Cloud Build (Container Compilation)
  ↓
Google Cloud Run (Serverless Container Hosting)
  ↓
Google Cloud CDN (Global Edge Caching for Static Assets)
  ↓
Production Service: kerala-lottery-intelligence.web.app
```

---

## Commit Traceability & Versioning

Every production build is linked to:
1. **Git Repository**: `maha-ai-developer/kerala-lottery-intelligence`
2. **Branch**: `main`
3. **Commit SHA**: Displayed in the Admin System Health UI and API headers (`X-Build-Commit`).
4. **App Version**: Set via `NEXT_PUBLIC_APP_VERSION` in `apps/web/next.config.ts`.

---

## Deployment Procedures

### 1. Manual Deployment via Firebase CLI
To deploy rules and static assets directly:
```bash
# Ensure you are logged into Firebase
npx -y firebase-tools@latest login

# Target project (dev is default alias, prod requires explicit selection)
npx -y firebase-tools@latest use dev
# or for production:
# npx -y firebase-tools@latest use prod

# Deploy Firestore rules and indexes
npx -y firebase-tools@latest deploy --only firestore --project dev

# Deploy App Hosting backend (or push to appropriate branch: develop -> DEV, main -> PROD)
npx -y firebase-tools@latest apphosting:backends:create --project dev
```

---

## Rollback Procedure
1. If a production release encounters a critical defect, navigate to **Firebase Console** > **App Hosting** > **Deployments**.
2. Select the previously verified successful build.
3. Click **Rollback to this version**.
4. Cloud Run instantly shifts traffic back to the prior stable revision with zero downtime.

---

## Continuous Deployment Verification

DEV deployment is connected to the `develop` branch.

This is only a deployment-pipeline verification marker.

