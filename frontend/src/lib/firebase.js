import { initializeApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyA0QbsnkTNbYyFsxwxgAdDXdhLT22Ps3Ys',
  authDomain: 'judgo-2726f.firebaseapp.com',
  databaseURL: 'https://judgo-2726f-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'judgo-2726f',
  storageBucket: 'judgo-2726f.firebasestorage.app',
  messagingSenderId: '970672447283',
  appId: '1:970672447283:web:df10946e8c27f391a6e846',
  measurementId: 'G-SEGP03PV42',
}

export const firebaseApp = initializeApp(firebaseConfig)
export const auth = getAuth(firebaseApp)
export const googleProvider = new GoogleAuthProvider()

export async function firebaseSignInEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password)
}

export async function firebaseSignUpEmail(email, password) {
  return createUserWithEmailAndPassword(auth, email, password)
}

export async function firebaseSignInGoogle() {
  return signInWithPopup(auth, googleProvider)
}

export async function firebaseLogout() {
  return signOut(auth)
}
