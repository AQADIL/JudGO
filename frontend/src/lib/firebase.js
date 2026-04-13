import { initializeApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
  signOut,
} from 'firebase/auth'

const getEnv = (key, { optional = false } = {}) => {
  const raw = import.meta.env?.[key]
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (!value && !optional) {
    throw new Error(`Missing Firebase config environment variable: ${key}`)
  }
  return value || undefined
}

const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  databaseURL: getEnv('VITE_FIREBASE_DATABASE_URL'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID'),
  measurementId: getEnv('VITE_FIREBASE_MEASUREMENT_ID', { optional: true }),
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

export async function firebaseSendPasswordReset(email) {
  return sendPasswordResetEmail(auth, email)
}
