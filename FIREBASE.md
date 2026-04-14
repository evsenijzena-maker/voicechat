# Firebase Security Rules

## Firestore Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users collection
    match /users/{userId} {
      // Anyone can read nickname, verified, isOnline
      allow read: if request.auth != null;
      
      // Users can only write their own data
      allow write: if request.auth != null && request.auth.uid == userId;
      
      // But cannot change verified flag (only admin can)
      allow update: if request.auth != null 
        && request.auth.uid == userId
        && !request.resource.data.diff(resource.data).affectedKeys().hasAll(['verified']);
    }
    
    // User profiles are readable by authenticated users
    match /users/{userId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.auth.uid == userId;
      allow update: if request.auth != null && request.auth.uid == userId
        && request.resource.data.verifie == resource.data.verified;
    }
  }
}
```

## Realtime Database Rules

```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null",
    
    "waiting": {
      "$uid": {
        ".write": "auth.uid == $uid",
        ".read": "auth != null"
      }
    },
    
    "partners": {
      "$uid": {
        ".write": "auth.uid == $uid",
        ".read": "auth != null"
      }
    },
    
    "calls": {
      "$callId": {
        ".read": "auth != null",
        ".write": "auth != null",
        
        "candidates": {
          ".read": "auth != null"
        }
      }
    }
  }
}
```

## How to deploy rules

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy Realtime Database rules
firebase deploy --only database:rules
```
