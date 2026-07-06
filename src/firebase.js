import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            "AIzaSyAIFXAsYSaraguX07vbtzvPzwZ-9YTBpMw",
  authDomain:        "building-program-calc.firebaseapp.com",
  projectId:         "building-program-calc",
  storageBucket:     "building-program-calc.firebasestorage.app",
  messagingSenderId: "57973593237",
  appId:             "1:57973593237:web:69c6fcda31cf0e073cf79c",
};

const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
