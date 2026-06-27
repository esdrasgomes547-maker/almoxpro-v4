import { auth } from './firebase';
import { GoogleAuthProvider, signInWithPopup, User, onAuthStateChanged } from 'firebase/auth';

const provider = new GoogleAuthProvider();

// Workspace Scopes
provider.addScope('https://www.googleapis.com/auth/gmail.modify');
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initGoogleAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // If we have a user but no token, we might need to re-auth or it's a regular login
        // For workspace features, we need the token from a fresh signInWithPopup usually
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleConnect = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Connect error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getGoogleToken = (): string | null => {
  return cachedAccessToken;
};

export const googleDisconnect = async () => {
  cachedAccessToken = null;
  // We don't necessarily sign out from Firebase, just clear the local token
};
