import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: 'AIzaSyBA-uD92gwICfqpqFH4EVC_CDHMLBNAemo',
  authDomain: 'floorplan2d.firebaseapp.com',
  projectId: 'floorplan2d',
  storageBucket: 'floorplan2d.firebasestorage.app',
  messagingSenderId: '821030103548',
  appId: '1:821030103548:web:daa8f23b8348b8cb322a79',
  measurementId: 'G-SSDH4GMGFP',
};

export const app = initializeApp(firebaseConfig);

// Only init analytics in browser (not during SSR/build)
export const analytics = isSupported().then((yes) => (yes ? getAnalytics(app) : null));
