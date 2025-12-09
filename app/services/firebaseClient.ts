// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCdHp9_UDq0vEbb9aXL1xD1kuoclnVGs3c",
  authDomain: "pill-dispencer-16395.firebaseapp.com",
  databaseURL: "https://pill-dispencer-16395-default-rtdb.firebaseio.com",
  projectId: "pill-dispencer-16395",
  storageBucket: "pill-dispencer-16395.firebasestorage.app",
  messagingSenderId: "266885353742",
  appId: "1:266885353742:web:df8c21a4adca780d6d075f",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const database = getDatabase(app);
