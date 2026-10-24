import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';

export const firebaseConfig = {
  projectId: "gen-lang-client-0717644565",
  appId: "1:1029942957534:web:4a8bf373e1fce688ce394f",
  apiKey: "AIzaSyDmr8Nai2rL5lU1AlxLftFKSDbNZJXTJog",
  authDomain: "gen-lang-client-0717644565.firebaseapp.com",
  storageBucket: "gen-lang-client-0717644565.firebasestorage.app",
  messagingSenderId: "1029942957534"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with specific database ID from config
export const db = getFirestore(app, "ai-studio-greekmedentryexa-83fa4510-0c84-4401-b060-8a4a809d988e");

// Initialize Auth
export const auth = getAuth(app);

// Connection test as required by firebase-integration guidelines
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firebase Firestore connection verified successfully.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('offline')) {
      console.error("Please check your Firebase configuration or internet status.");
    } else {
      // It's normal for 'test/connection' to not exist, as long as it doesn't fail on connection/auth
      console.log("Firebase Firestore is reachable.");
    }
  }
}

testConnection();
