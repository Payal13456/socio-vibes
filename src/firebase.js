// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDKQ-H0KXSpTGUmwpkvH0pBo6RpW75pvAY",
  authDomain: "soul-scribe-3e073.firebaseapp.com",
  projectId: "soul-scribe-3e073",
  storageBucket: "soul-scribe-3e073.firebasestorage.app",
  messagingSenderId: "388842500854",
  appId: "1:388842500854:web:7d0e9c3c4e0da78767b2d7",
  measurementId: "G-MC2CK98VH8",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
