// --- Firebase Configuration ---
// Import functions from the SDKs (using CDN modules for static app)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBxPusqyeKmkx-lo4SX2w1ZORZjKY4k6fQ",
    authDomain: "mch-control.firebaseapp.com",
    projectId: "mch-control",
    storageBucket: "mch-control.firebasestorage.app",
    messagingSenderId: "669337977940",
    appId: "1:669337977940:web:b9a29e5cd58dfe1ec399c1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const dbFirestore = getFirestore(app);

console.log("🔥 Firebase Initialized");

export { dbFirestore, doc, getDoc, setDoc, onSnapshot };
