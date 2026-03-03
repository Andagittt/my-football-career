import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // Dodajemo bazu
import { getAuth, GoogleAuthProvider } from "firebase/auth"; // Dodajemo auth

const firebaseConfig = {
  apiKey: "AIzaSyBeh2Z7ZNvR1dvoNcTd7iARt6noH3qfpzs",
  authDomain: "my-football-career-app.firebaseapp.com",
  projectId: "my-football-career-app",
  storageBucket: "my-football-career-app.firebasestorage.app",
  messagingSenderId: "389132857219",
  appId: "1:389132857219:web:033c242fd7a2bfad1ad0b6",
  measurementId: "G-48TZ55MV2T"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Exportuj varijable koje koristimo u App.js
export const db = getFirestore(app);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider(); // Nazvali smo ga 'provider' da se slaže sa App.js
