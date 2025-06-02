// Konfigurasi Firebase
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDQiaXS-iMRSK9K51HISvcVo7VaajgflVo",
  authDomain: "fokus-lebih-baik.firebaseapp.com",
  projectId: "fokus-lebih-baik",
  storageBucket: "fokus-lebih-baik.firebasestorage.app",
  messagingSenderId: "781749232235",
  appId: "1:781749232235:web:c597cd5a2600cc1072472e",
  measurementId: "G-K5YM7ZS6GB"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app); 