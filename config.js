// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB69Do9RN2u4ErWcgNtTQtg1klXSH8oACc",
  authDomain: "engenharia-prometals.firebaseapp.com",
  projectId: "engenharia-prometals",
  storageBucket: "engenharia-prometals.firebasestorage.app",
  messagingSenderId: "665357159090",
  appId: "1:665357159090:web:898481adfb1f2c5b4417ab",
  measurementId: "G-XSBDBNLLV2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);