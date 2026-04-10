import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyDLdhvdNdH0Z2xe7Ogx9-zEyd0WYyjjTDU",
    authDomain: "agroshare-17977.firebaseapp.com",
    projectId: "agroshare-17977",
    storageBucket: "agroshare-17977.firebasestorage.app",
    messagingSenderId: "407679131572",
    appId: "1:407679131572:web:eb00384daadb3e6c245ce1",
    measurementId: "G-VB873X552G",
    databaseURL: "https://agroshare-17977-default-rtdb.firebaseio.com"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const firestore = getFirestore(app);
