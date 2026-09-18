import { initializeApp } from "firebase/app";
import { getAuth, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

export const firebaseConfig = {
  apiKey: "AIzaSyBi5-tCf-BnX8FCvfbDT4BFX6ceo6Tjx_0",
  authDomain: "zad-elroh.firebaseapp.com",
  projectId: "zad-elroh",
  storageBucket: "zad-elroh.firebasestorage.app",
  messagingSenderId: "711156238295",
  appId: "1:711156238295:web:a674b398cda52c89d26d92"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export const signOutFirebase = async (): Promise<void> => {
  await signOut(auth);
};

export default app;
