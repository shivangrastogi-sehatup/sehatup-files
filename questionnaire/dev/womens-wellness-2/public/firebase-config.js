// assets/firebase-config.js
const firebaseConfig = { 
    apiKey: "AIzaSyBCuj9geUYV69Ievt59WO8PjJWQZ1cKDLw", 
    authDomain: "sehatup-f96b5.firebaseapp.com", 
    projectId: "sehatup-f96b5", 
    storageBucket: "sehatup-f96b5.firebasestorage.app", 
    messagingSenderId: "886569695434", 
    appId: "1:886569695434:web:4932dca7625c98972a5c33", 
    measurementId: "G-X2274KKWE4" 
}; 

firebase.initializeApp(firebaseConfig); 
const db = firebase.firestore(); 
window.db = db;