import { getApp, getApps, initializeApp } from 'firebase/app';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseEnabled = Object.values(config).every(Boolean);
export const firebaseApp = firebaseEnabled ? (getApps().length ? getApp() : initializeApp(config)) : null;
export const firebaseAuth = firebaseApp ? (() => {
  try {
    // A persistência React Native existe no Android/iOS, mas não no bundle Web.
    if (typeof getReactNativePersistence === 'function') {
      return initializeAuth(firebaseApp, { persistence: getReactNativePersistence(AsyncStorage) });
    }
    return getAuth(firebaseApp);
  } catch (error) {
    if (error?.code === 'auth/already-initialized') return getAuth(firebaseApp);
    throw error;
  }
})() : null;
export const firestore = firebaseApp ? getFirestore(firebaseApp) : null;

export function getFirebaseConfigStatus() {
  return { enabled: firebaseEnabled, missing: Object.entries(config).filter(([, value]) => !value).map(([key]) => key) };
}
