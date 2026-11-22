// ─────────────────────────────────────────────────────────────────────────────
// Firebase settings (README, step 2).
//
// Leave this as null and the site still works, but each profile's progress is
// saved only in the browser it was created in (no sync between devices).
//
// To turn on email sign-in and sync, replace null with the config object that
// Firebase shows you, for example:
//
// window.FIREBASE_CONFIG = {
//   apiKey: "AIza...",
//   authDomain: "your-project.firebaseapp.com",
//   projectId: "your-project",
//   storageBucket: "your-project.appspot.com",
//   messagingSenderId: "1234567890",
//   appId: "1:1234567890:web:abc123"
// };
//
// These values are not secret: Firebase web configs are meant to be public.
// Your data is protected by the rules in firestore.rules.
// ─────────────────────────────────────────────────────────────────────────────
window.FIREBASE_CONFIG = null;
