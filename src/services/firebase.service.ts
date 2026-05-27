import env from '../config/env';

let firebaseAdmin: any = null;

try {
  if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
    const admin = require('firebase-admin');
    firebaseAdmin = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    console.log('Firebase Admin SDK initialized successfully.');
  }
} catch (error) {
  console.warn('Firebase Admin failed to initialize:', error);
}

/**
 * Verify Firebase Phone Authentication ID Token
 * Returns the verified phone number
 */
export const verifyFirebaseToken = async (idToken: string): Promise<string> => {
  if (!firebaseAdmin) {
    throw new Error('Firebase Admin SDK is not configured in environment variables.');
  }
  const decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken);
  if (!decodedToken.phone_number) {
    throw new Error('Firebase token does not contain a verified phone number.');
  }
  return decodedToken.phone_number;
};
