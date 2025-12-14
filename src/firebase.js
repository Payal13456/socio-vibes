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
  apiKey: "AIzaSyC8vCjp7wGr5QTIaLfoSisAZjYQHIQZCvw",
  authDomain: "socio-vibes.firebaseapp.com",
  projectId: "socio-vibes",
  storageBucket: "socio-vibes.firebasestorage.app",
  messagingSenderId: "406222854076",
  appId: "1:406222854076:web:c896ce0a9f271a2331bdb9",
  measurementId: "G-NQJSQYQZK0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
