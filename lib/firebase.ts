import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDHjGUosvXZp8Oo5TcZAgoVXCCo8A61Z8A",
  authDomain: "paciente-virtual-avatar.firebaseapp.com",
  projectId: "paciente-virtual-avatar",
  storageBucket: "paciente-virtual-avatar.firebasestorage.app",
  messagingSenderId: "93155755963",
  appId: "1:93155755963:web:25b28a02ce2d468b4f269e"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);
export const auth = getAuth(app);