# Production Readiness & Deployment Guide

> **Milestone 1A — Production Bootstrap Verification**  
> **Repository**: `maha-ai-developer/kerala-lottery-intelligence`  
> **Status**: Local Verified | Cloud Configuration Pending | Manual Verification Required  

---

## Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Environment Strategy (DEV vs PROD)](#2-environment-strategy-dev-vs-prod)
3. [Firebase Projects Required](#3-firebase-projects-required)
4. [Firebase Authentication Configuration](#4-firebase-authentication-configuration)
5. [Fictional Test Phone Setup](#5-fictional-test-phone-setup)
6. [Firestore Security Rules Deployment](#6-firestore-security-rules-deployment)
7. [Firestore Emulator Testing](#7-firestore-emulator-testing)
8. [Firebase App Hosting Setup](#8-firebase-app-hosting-setup)
9. [Monorepo `apps/web` Root Directory](#9-monorepo-appsweb-root-directory)
10. [Environment Variables Matrix](#10-environment-variables-matrix)
11. [Secret Management](#11-secret-management)
12. [Local Quality Gates & Verification Commands](#12-local-quality-gates--verification-commands)
13. [GitHub Workflow & Branch Mapping](#13-github-workflow--branch-mapping)
14. [Deployment Procedure](#14-deployment-procedure)
15. [Rollback Procedure](#15-rollback-procedure)
16. [Security & Hygiene Checklist](#16-security--hygiene-checklist)
17. [Known Limitations](#17-known-limitations)
18. [Manual Actions Matrix (Automated vs Manual)](#18-manual-actions-matrix-automated-vs-manual)

---

## 1. Architecture Overview

The Kerala State Lottery Intelligence & Experiment Platform follows a strict layered separation of concerns:

```
                      [ GITHUB REPOSITORY ]
            maha-ai-developer/kerala-lottery-intelligence
                       │                     │
                (develop branch)       (main branch)
                       │                     │
                       ▼                     ▼
              [ App Hosting DEV ]    [ App Hosting PROD ]
             kerala-lottery-intel-dev  kerala-lottery-intelligence
                       │                     │
                       └──────────┬──────────┘
                                  ▼
                        [ Cloud Run Container ]
                              (Next.js 15)
                                  │
          ┌───────────────────────┼───────────────────────┐
          ▼                       ▼                       ▼
 [ Firebase Phone Auth ]  [ Cloud Firestore ]    [ Cloud Storage ]
 (SMS OTP / reCAPTCHA)     (Security Rules)      (SHA-256 Provenance)
```

- **Frontend & App Server**: Next.js 15 App Router (`apps/web`), running on Google Cloud Run through Firebase App Hosting.
- **Identity & Boundary**: Firebase Phone Authentication with invisible/explicit reCAPTCHA.
- **Data & Access Control**: Cloud Firestore guarded by independent Security Rules (`firestore.rules`). Client profiles default to role `VIEWER`; client self-elevation is blocked by rule constraints.
- **Safety Invariants**:
  - Canonical lottery numbers are strictly strings preserving leading zeros (e.g., `"0276"` is never coerced to `276`).
  - Strict temporal cutoffs prevent future lottery data from leaking into past experiment models.

---

## 2. Environment Strategy (DEV vs PROD)

Development and production environments must be completely isolated to ensure development experiments never connect to production Firestore or affect production user data.

| Environment | Git Branch | Target Firebase Project | Intended Usage |
| :--- | :--- | :--- | :--- |
| **Development** | `develop` | `kerala-lottery-intel-dev` | Feature development, sandbox experiments, fictional test phones, CI testing |
| **Production** | `main` | `kerala-lottery-intelligence` | Live production service, verified datasets, real carrier SMS auth |

---

## 3. Firebase Projects Required

To fulfill the two-project isolation model, the following projects are configured in the Google Cloud / Firebase Console:

1. **`kerala-lottery-intel-dev`** (Development)
   - Project Number: `608186999779`
   - Firestore Mode: Native Mode, location `asia-south1` (Mumbai).
   - Blaze plan required for App Hosting.
2. **`kerala-lottery-intelligence`** (Production)
   - Project Number: `660682986882`
   - Firestore Mode: Native Mode, location `asia-south1` (Mumbai).
   - Blaze plan required for App Hosting.

> [!NOTE]
> The DEV project is `kerala-lottery-intel-dev` (targeting the `develop` branch) and the official PROD project is `kerala-lottery-intelligence` (targeting the `main` branch). Bare CLI operations default safely to `kerala-lottery-intel-dev`.

---

## 4. Firebase Authentication Configuration

Authentication uses the official Firebase Phone Auth Web SDK (`signInWithPhoneNumber`, `RecaptchaVerifier`).

### Configuration Steps in Firebase Console:
1. Navigate to **Authentication** > **Sign-in method**.
2. Enable the **Phone** provider.
3. Under **Authorized Domains**, ensure the following are present:
   - `localhost` (for local development)
   - `127.0.0.1`
   - Your App Hosting generated production domain (e.g. `*.hosted.app` or custom domain).

---

## 5. Fictional Test Phone Setup

> [!IMPORTANT]
> **Never use real mobile numbers or hardcoded test OTPs in source code.**
> Real SMS authentication incurs network carrier charges and is subject to quota limits. For development and review, configure fictional test phone numbers in Firebase Console.

### How to Configure Fictional Test Numbers:
1. In Firebase Console, go to **Authentication** > **Sign-in method** > **Phone**.
2. Scroll to **Phone numbers for testing (optional)**.
3. Add a fictional number and fixed verification code:
   - *Phone Number*: `+91 90000 00001` (or any fictional prefix not assigned to real users)
   - *Verification Code*: `123456`
4. Click **Save**.
5. When using this number, Firebase Auth bypasses the carrier SMS gateway and validates immediately with the predefined code without incurring cost.

---

## 6. Firestore Security Rules Deployment

The authoritative security rules file is `firestore.rules`.
It enforces role-based access control with four roles:
- `VIEWER`: Default role. Read-only access to published draws/numbers. Can only create own initial profile (`role: 'VIEWER'`, `status: 'ACTIVE'`). Cannot mutate research data.
- `RESEARCHER`: Permitted write access to source documents, draws, winning numbers, and legal rules. Cannot elevate users or update experiments.
- `ANALYST`: Permitted write access to experiments, runs, and predictions. Cannot mutate official source documents.
- `ADMIN`: Full administrative access to users and audit log inspection.
- `Audit Logs`: Append-only (`allow create: if isAuthenticated()`), update and delete are strictly `false` for all callers.

### Manual Command to Deploy Rules:
```bash
# Deploy rules to development
npx -y firebase-tools@latest deploy --only firestore:rules --project kerala-lottery-intel-dev

# Deploy rules to production
npx -y firebase-tools@latest deploy --only firestore:rules --project kerala-lottery-intelligence
```

---

## 7. Firestore Emulator Testing

All 18 security rules authorization cases are verified using `@firebase/rules-unit-testing` against the local Firestore emulator.

### Running Rules Tests Locally:
```bash
npm run test:rules
```
This command:
1. Starts the Firestore emulator on port `8080`.
2. Executes `tests/firestore-rules.test.ts`.
3. Verifies unauthenticated denials, VIEWER self-elevation prevention, RESEARCHER write gates, ANALYST boundaries, ADMIN controls, and audit log immutability.
4. Shuts down the emulator cleanly upon completion.

---

## 8. Firebase App Hosting Setup

Firebase App Hosting automatically deploys the Next.js application from GitHub commits.

### Manual Setup Steps in Firebase Console:
1. In Firebase Console, select your target project (`kerala-lottery-intelligence` for PROD or `kerala-lottery-intel-dev` for DEV).
2. In the left navigation, open **Hosting & Serverless** > **App Hosting**.
3. Click **Get Started** / **Create Backend**.
4. Connect your GitHub account and select repository:
   `maha-ai-developer/kerala-lottery-intelligence`
5. Configure backend settings:
   - **Backend ID**: `kerala-lottery-platform`
   - **App Root Directory**: `apps/web` *(Critical: do not leave as `/`)*
   - **Live Branch**:
     - `main` for production
     - `develop` for development
   - **Automatic Rollouts**: Enabled.

---

## 9. Monorepo `apps/web` Root Directory

- The Next.js 15 application resides in `apps/web/`.
- The single authoritative App Hosting configuration file is located at:
  [`apps/web/apphosting.yaml`](file:///home/pi/kerela-lottery-project/kerala-lottery-intelligence/apps/web/apphosting.yaml)
- The root `apphosting.yaml` has been removed to prevent duplicate drift and ensure App Hosting builds from `apps/web` accurately read the container sizing and environment variables.

### Authoritative `apps/web/apphosting.yaml` Summary:
- `cpu`: 1
- `memoryMiB`: 512
- `minInstances`: 0 (scales to zero to eliminate idle charges)
- `maxInstances`: 10
- `concurrency`: 80

---

## 10. Environment Variables Matrix

| Variable | Scope | Availability | Example / Value | Description |
| :--- | :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_APP_ENV` | Browser & Server | `BUILD`, `RUNTIME` | `production` / `development` | Deployment environment identifier |
| `NEXT_PUBLIC_APP_VERSION` | Browser & Server | `BUILD`, `RUNTIME` | `0.1.0` | Application release version |
| `NEXT_PUBLIC_GIT_COMMIT_SHA` | Browser & Server | `BUILD`, `RUNTIME` | `051cced` | Deployed git commit hash |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Browser & Server | `BUILD`, `RUNTIME` | `kerala-lottery-intelligence` | Firebase project identifier |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`| Browser & Server | `BUILD`, `RUNTIME` | `kerala-lottery-intelligence.firebaseapp.com` | Auth redirect domain |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`| Browser & Server | `BUILD`, `RUNTIME`| `kerala-lottery-intelligence.firebasestorage.app` | Cloud Storage bucket |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Browser & Server | `BUILD`, `RUNTIME` | *(Project Web API Key)* | Public Firebase Client SDK key |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Browser & Server | `BUILD`, `RUNTIME` | `1:660682986882:web:...` | Firebase Web App ID |
| `GCP_PROJECT_ID` | Server only | `RUNTIME` | `kerala-lottery-intelligence` | Cloud project for backend SDKs |
| `GCS_BUCKET_DOCUMENTS` | Server only | `RUNTIME` | `...-documents` | Raw document storage bucket |
| `GEMINI_API_KEY` | Secret Manager | Server Secret | `secret:gemini-api-key` | AI Gateway API Key |

---

## 11. Secret Management

> [!CAUTION]
> **Never prefix backend secrets with `NEXT_PUBLIC_`.**
> Any variable prefixed with `NEXT_PUBLIC_` is inlined into browser JavaScript bundles and visible to anyone inspecting network requests.

### Provisioning Secrets in App Hosting:
Use the Firebase CLI to securely store backend secrets in Google Cloud Secret Manager:
```bash
npx -y firebase-tools@latest apphosting:secrets:set gemini-api-key
npx -y firebase-tools@latest apphosting:secrets:set anthropic-api-key
npx -y firebase-tools@latest apphosting:secrets:set openai-api-key
```
Then grant the App Hosting backend service account access to read the secret:
```bash
npx -y firebase-tools@latest apphosting:secrets:grantaccess gemini-api-key --backend kerala-lottery-platform
```

---

## 12. Local Quality Gates & Verification Commands

Before pushing any changes to Git, execute the local quality gates:

```bash
# 1. Typecheck the entire monorepo
npm run typecheck

# 2. Run unit & platform invariant tests
npm test

# 3. Run emulator-backed Firestore security rules tests
npm run test:rules

# 4. Build the Next.js production web application
npm run build --workspace=apps/web
```

---

## 13. GitHub Workflow & Branch Mapping

The repository uses Git with two principal branches:
- `main`: Production-ready code deployed to `kerala-lottery-intelligence`.
- `develop`: Integration branch deployed to `kerala-lottery-intel-dev`.

### Safe Manual Git Push Commands:
Push branches using Git's credential helper or interactive authentication (never pass raw PATs in shell history):

```bash
# Push main branch
git push -u origin main

# Push develop branch
git push -u origin develop
```

---

## 14. Deployment Procedure

Once GitHub is connected to App Hosting:
1. Feature work is completed on a feature branch.
2. Pull request merged into `develop`.
3. Firebase App Hosting detects commit on `develop` and automatically triggers buildpack build for `apps/web`.
4. Artifact deployed to Cloud Run in `kerala-lottery-intel-dev`.
5. When verified, `develop` is merged into `main`.
6. App Hosting builds and rolls out production release in `kerala-lottery-intelligence`.

---

## 15. Rollback Procedure

If an unexpected regression occurs in production:
1. **App Hosting Console Rollback**:
   - Go to **Firebase Console** > **App Hosting** > **Backends** > `kerala-lottery-platform`.
   - Under **Rollouts**, locate the last known healthy rollout.
   - Click the three dots (`...`) and select **Roll back to this version**.
2. **Git Revert**:
   - Create a revert commit locally: `git revert HEAD`.
   - Push to `main`: `git push origin main`.
   - App Hosting will trigger a new build of the reverted commit.

---

## 16. Security & Hygiene Checklist

- [x] Zero API keys, private keys, or service-account JSON committed to Git.
- [x] Zero GitHub PATs stored in repository files.
- [x] No custom OTP storage or generation in client or Firestore.
- [x] Firestore Security Rules strictly block client self-elevation (`role == 'VIEWER'`).
- [x] Audit logs are append-only; update/delete operations denied for all roles.
- [x] Authoritative `apps/web/apphosting.yaml` configured with cost-effective auto-scaling (0 to 10 instances).
- [x] `/api/health` exposes only safe metadata; zero internal secrets leaked.
- [x] Browser variables strictly isolated to `NEXT_PUBLIC_*` public web configuration.

---

## 17. Known Limitations

1. **Carrier SMS Delivery Limits**: Production phone auth depends on carrier network latency and Firebase SMS quotas. Test phone numbers should always be used for automated testing.
2. **App Hosting Region**: App Hosting is currently supported in selected Google Cloud regions (defaulting to `us-central1` for backend buildpacks while Firestore and storage reside in `asia-south1`).
3. **Lottery Features Pending**: PDF ingestion, knowledge graphs, and predictive analysis remain intentionally unbuilt until cloud deployment verification (Milestone 1B) is completed.

---

## 18. Manual Actions Matrix (Automated vs Manual)

| Task | Automation Status | Execution Mode | Action Required |
| :--- | :--- | :--- | :--- |
| Monorepo Build & Typecheck | **AUTOMATED** | Local / CI | `npm run typecheck && npm run build` |
| Security Rules Testing | **AUTOMATED** | Local / CI | `npm run test:rules` |
| Phone Auth & User Profile UI | **AUTOMATED** | Codebase | Built in `apps/web` |
| Health Endpoint (`/api/health`)| **AUTOMATED** | Codebase | Built in `apps/web` |
| Git Branch Pushing | **MANUAL** | Developer | Run `git push -u origin main` and `develop` |
| Phone Auth Enablement | **MANUAL** | Firebase Console | Enable Phone provider in Console |
| Test Phone Registration | **MANUAL** | Firebase Console | Register fictional test numbers in Console |
| App Hosting Backend Creation | **MANUAL** | Firebase Console | Connect GitHub repo to App Hosting backend |
| Secret Manager Secret Creation | **MANUAL** | Firebase CLI | Run `apphosting:secrets:set` for AI keys |
