import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// ↓↓ ここにあなたのFirebase設定を貼り付けてください ↓↓
const firebaseConfig = {
  apiKey: "AIzaSyA3mbgYB5liw1fgFdBQ_Bi07cvGfFr3UsU",
  authDomain: "setokousai-16c72.firebaseapp.com",
  projectId: "setokousai-16c72",
  storageBucket: "setokousai-16c72.firebasestorage.app",
  messagingSenderId: "682104596039",
  appId: "1:682104596039:web:4851212365cd1af9e1b362",
  measurementId: "G-SJ1QXELW19"
};
// ↑↑ ここまで ↑↑

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
