# EyeHospital Registration Portal

A complete, production-ready, standalone **Registration & Credential Management Portal** built with **React.js**, **Firebase Authentication**, and **Cloud Firestore**.

Designed for medical institutions, hospitals, and clinics to securely handle patient and visitor intake, administrative approval workflows, unique username generation, and secure temporary credentials.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technologies Used](#2-technologies-used)
3. [Installation & Quick Start](#3-installation--quick-start)
4. [How to Run Locally](#4-how-to-run-locally)
5. [Interactive Demo Mode](#5-interactive-demo-mode)
6. [Firebase Project Creation](#6-firebase-project-creation)
7. [Firebase Authentication Setup](#7-firebase-authentication-setup)
8. [Firestore Database Setup](#8-firestore-database-setup)
9. [Firestore Security Rules](#9-firestore-security-rules)
10. [Environment Variable Configuration](#10-environment-variable-configuration)
11. [How to Create the First Administrator](#11-how-to-create-the-first-administrator)
12. [Application Workflow Details](#12-application-workflow-details)
    - [Flow 1: User Registration](#flow-1--user-registration)
    - [Flow 2: Admin Approval](#flow-2--admin-approval)
    - [Flow 3: User Login & Dashboard](#flow-3--user-login--dashboard)
    - [Flow 4: Rejection Handling](#flow-4--rejection-handling)
13. [Security Architecture](#13-security-architecture)
14. [How to Build for Production](#14-how-to-build-for-production)

---

## 1. Project Overview

The **EyeHospital Registration Portal** decouples public intake from immediate account creation. Rather than granting instant access:
1. Applicants submit structured profile data (Full Name, Age, Gender, 10-digit Indian Mobile Number, and a verified `@gmail.com` address).
2. All submissions enter a secure `pending` queue in Firestore.
3. Hospital administrators review applications in a password-protected **Admin Dashboard**.
4. Upon approval, the system generates a unique username (e.g., `USER10294`) and a cryptographic temporary password, creates the Firebase Authentication account securely in the background, and displays credentials to the admin once.
5. Users log into their **User Dashboard** using their generated username and password.

---

## 2. Technologies Used

* **Frontend:** React.js (v19) with Vite
* **Backend:** Firebase (Client SDK v12)
* **Authentication:** Firebase Authentication (Email/Password provider with Username mapping)
* **Database:** Firebase Cloud Firestore (NoSQL document database)
* **Icons:** `lucide-react`
* **Styling:** Custom Vanilla CSS (clean, responsive design system with zero CSS framework bloat)

---

## 3. Installation & Quick Start

### Prerequisites
* **Node.js** (v18.0 or newer)
* **npm** (v9.0 or newer)

### Step 1: Clone or navigate to the project directory
```bash
cd eyehospital
```

### Step 2: Install dependencies
```bash
npm install
```

---

## 4. How to Run Locally

Start the Vite development server:

```bash
npm run dev
```

Open your browser and navigate to:
```
http://localhost:5173/
```

The application uses client-side hash routing:
* **Landing Page:** `http://localhost:5173/#/`
* **Registration Form:** `http://localhost:5173/#/register`
* **User Login:** `http://localhost:5173/#/login`
* **Admin Login:** `http://localhost:5173/#/admin-login`
* **User Dashboard:** `http://localhost:5173/#/dashboard` (Protected)
* **Admin Dashboard:** `http://localhost:5173/#/admin-dashboard` (Protected)

---

## 5. Interactive Demo Mode

The application includes an **instant out-of-the-box Interactive Demo Mode**:
* If Firebase credentials are not yet configured in `.env`, the portal uses synchronized local state storage.
* You can immediately test all 4 flows:
  - **Admin Login:** `admin@eyehospital.com` / `Admin@12345` (Auto-fill button provided)
  - **Existing Sample User:** `USER10294` / `Password@123`
  - Submitting new registrations, approving them, copying credentials, and logging in.
* When you add your Firebase credentials to `.env`, the application automatically switches to live Cloud Firestore and Firebase Auth!

---

## 6. Firebase Project Creation

1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project** (or **Create a project**).
3. Enter a project name (e.g. `eyehospital-portal`).
4. (Optional) Disable Google Analytics or configure as desired, then click **Create project**.
5. Once your project is ready, click **Continue**.

---

## 7. Firebase Authentication Setup

1. In the Firebase Console left sidebar, click **Build** > **Authentication**.
2. Click **Get started**.
3. Under the **Sign-in method** tab, click **Email/Password**.
4. Enable the **Email/Password** toggle (leave "Email link (passwordless sign-in)" disabled).
5. Click **Save**.

---

## 8. Firestore Database Setup

1. In the Firebase Console left sidebar, click **Build** > **Firestore Database**.
2. Click **Create database**.
3. Choose your database location (e.g., `asia-south1` for India / Mumbai or closest to your users).
4. Select **Start in production mode** (or test mode if developing locally; we will apply custom rules next).
5. Click **Create**.

---

## 9. Firestore Security Rules

Copy the contents of [`firestore.rules`](./firestore.rules) and paste them into the **Rules** tab in your Firestore Console, then click **Publish**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthenticated() {
      return request.auth != null;
    }

    function isAdmin() {
      return isAuthenticated() &&
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    // Registrations Collection
    match /registrations/{registrationId} {
      // Public intake with strict validation
      allow create: if 
        request.resource.data.status == 'pending' &&
        request.resource.data.username == null &&
        request.resource.data.name is string &&
        request.resource.data.name.size() >= 2 &&
        request.resource.data.age is int &&
        request.resource.data.age >= 1 &&
        request.resource.data.age <= 120 &&
        request.resource.data.email is string &&
        request.resource.data.email.matches('^[a-zA-Z0-9._%+-]+@gmail\\.com$') &&
        request.resource.data.phone is string &&
        request.resource.data.phone.matches('^[6-9][0-9]{9}$');

      // Only administrators or the user owner can read
      allow read: if isAdmin() || (isAuthenticated() && resource.data.uid == request.auth.uid);

      // Only admins can approve, reject, or modify registrations
      allow update: if isAdmin();
      allow delete: if isAdmin();
    }

    // Users Collection (RBAC)
    match /users/{userId} {
      allow read: if isOwner(userId) || isAdmin();
      allow write: if isAdmin();
    }

    // Username Lookup
    match /usernames/{username} {
      allow read: if true;
      allow write: if isAdmin();
    }
  }
}
```

---

## 10. Environment Variable Configuration

1. In the Firebase Console, go to **Project settings** (gear icon) > **General**.
2. Scroll to the **Your apps** card and click the Web icon (`</>`) to register a web app.
3. App nickname: `eyehospital-web`. Click **Register app**.
4. You will see your `firebaseConfig` object.
5. Create a `.env` file in the root directory (copy from `.env.example`):

```bash
cp .env.example .env
```

6. Fill in the values:

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
```

---

## 11. How to Create the First Administrator

To bootstrap your first admin in Firebase:

### Method A: Using the Included Setup Script
Run the automated script with your preferred admin credentials:
```bash
node scripts/createAdmin.js admin@eyehospital.com SecureAdminPass@2026 "Hospital Administrator"
```

### Method B: Manual Setup via Firebase Console
1. Go to **Authentication** > **Users** > **Add user**.
   - Email: `admin@eyehospital.com`
   - Password: `YourPassword123`
   - Copy the generated `User UID`.
2. Go to **Firestore Database** > **Data** > **Start collection**.
   - Collection ID: `users`
   - Document ID: `<Paste the User UID>`
   - Fields:
     - `email` (string): `admin@eyehospital.com`
     - `name` (string): `Hospital Administrator`
     - `role` (string): `admin`
     - `createdAt` (string): `2026-09-24T00:00:00.000Z`
3. Log in at `/#/admin-login`!

---

## 12. Application Workflow Details

### Flow 1 — User Registration
* Applicant visits `/#/register`.
* Enters Full Name, Age (1–120), Gender, 10-digit Indian Mobile Number, and `@gmail.com` address.
* Submits the form:
  - System verifies format and checks for duplicate Gmail submissions.
  - Document written to Firestore with status `pending`.
  - Applicant sees confirmation: *"Registration submitted successfully. Your application is waiting for admin approval."*
  - No credentials are given at this stage.

### Flow 2 — Admin Approval
* Admin logs in at `/#/admin-login`.
* Admin Dashboard displays:
  - Metrics: Total, Pending, Approved, and Rejected registrations.
  - Live table with search by Name/Gmail and status filters.
* Admin clicks **Approve** on a pending applicant:
  - Confirmation prompt: *"Are you sure you want to approve this registration?"*
  - On confirmation:
    1. A unique username is generated (`USER` + 5 random digits, e.g. `USER10492`).
    2. A cryptographic temporary password is generated.
    3. A Firebase Authentication account is provisioned in the background using an isolated secondary app instance (ensuring the admin's session is never disrupted).
    4. Registration status updated to `approved` with `approvedAt` timestamp.
    5. Username mapping stored in `usernames/{username}`.
    6. Modal displays the credentials to the admin with 1-click copy buttons and a security warning.
    7. Credentials are never displayed again once the modal closes.

### Flow 3 — User Login & Dashboard
* Approved user visits `/#/login`.
* Enters their assigned **Username** and **Password**.
* System verifies status is `approved` and authenticates against Firebase.
* User is redirected to `/#/dashboard`:
  - Displays welcome message, verified status badge, profile information, and hospital desk instructions.
  - User can safely logout.

### Flow 4 — Rejection Handling
* Admin clicks **Reject** on a pending applicant.
* Confirmation prompt: *"Are you sure you want to reject this registration?"*
* Status is updated to `rejected`.
* If a rejected or pending applicant attempts to log in, access is denied with a clear user-friendly explanation.

---

## 13. Security Architecture

1. **No Plain-Text Passwords:** Passwords are never stored in Firestore. Firebase Authentication securely handles bcrypt password hashing and auth tokens.
2. **Dual-Session Isolation:** Admin account creation uses a secondary Firebase App instance so the current administrator is never logged out during approval.
3. **Role-Based Access Control (RBAC):** Server-enforced Firestore rules inspect `users/$(request.auth.uid).data.role == 'admin'` before allowing approval, status updates, or reading other applicants' data.
4. **Input Sanitization & Normalization:**
   - Phone numbers are validated against Indian 10-digit mobile standards (`/^[6-9]\d{9}$/`).
   - Emails are normalized to lowercase and strictly constrained to `@gmail.com`.
   - Age is strictly validated between 1 and 120.

---

## 14. How to Build for Production

To create an optimized production build:

```bash
npm run build
```

This generates production assets in the `dist/` directory.

### Deploying to Firebase Hosting

1. Install Firebase CLI (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```
2. Log into Firebase:
   ```bash
   firebase login
   ```
3. Deploy Firestore rules and Hosting:
   ```bash
   firebase deploy
   ```

---

## License

This project is licensed under the MIT License.
