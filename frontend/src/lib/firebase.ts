 // src/lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBvHNz4D598MGp19hlwZqeThZY7ayH50RI",
  authDomain: "optisync-a5182.firebaseapp.com",
  projectId: "optisync-a5182",
  storageBucket: "optisync-a5182.firebasestorage.app",
  messagingSenderId: "156108664564",
  appId: "1:156108664564:web:1280a03e0ec3a8891878a1"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };