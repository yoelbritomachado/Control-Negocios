// --- Firebase Configuration (OFFLINE MODE) ---
// Import functions from the SDKs (using CDN modules for static app)
// import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
// import {
//     getFirestore,
//     doc,
//     getDoc,
//     setDoc,
//     onSnapshot
// } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// MOCK IMPLEMENTATION FOR OFFLINE / LOCALHOST USE
console.warn("⚠️ MODO LOCAL: Firebase desactivado. Usando localStorage.");

const dbFirestore = {};

function doc() { return {}; }
async function getDoc() { return { exists: () => false }; } // Always return "not found" so it falls back to local
async function setDoc() { console.log("💾 [Local] Guardado simulado (persistido en localStorage)"); return true; }
function onSnapshot() { return () => { }; }

const firebaseConfig = {
    apiKey: "OFFLINE_MODE",
    projectId: "local-mch-control"
};

// Initialize Firebase
// const app = initializeApp(firebaseConfig);
// const dbFirestore = getFirestore(app);

console.log("🔥 Firebase Mock Initialized (Offline)");

export { dbFirestore, doc, getDoc, setDoc, onSnapshot };
