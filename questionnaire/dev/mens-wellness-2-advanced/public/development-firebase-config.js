const firebaseConfig={
    apiKey:"AIzaSyCr7hpZ8_Qye66RC2LyyWwQ8pXs7Jw1cPg",
    authDomain:"sehatupdev.firebaseapp.com",
    projectId:"sehatupdev",
    storageBucket:"sehatupdev.firebasestorage.app",
    messagingSenderId:"367894412167",
    appId:"1:367894412167:web:e8e19660246ff976cfb122"
};

firebase.initializeApp(firebaseConfig);
const db=firebase.firestore();
window.db=db;