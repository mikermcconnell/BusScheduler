import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { act } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { auth as firebaseAuth } from '../config/firebase';
import { firebaseStorage } from '../services/firebaseStorage';
import { authPersistence } from '../services/authPersistence';

const mockSetPersistence = jest.fn(() => Promise.resolve());
const mockSignInWithEmailAndPassword = jest.fn(() =>
  Promise.resolve({ user: { uid: 'user-123' } })
);
const mockCreateUserWithEmailAndPassword = jest.fn(() =>
  Promise.resolve({ user: { uid: 'user-456' } })
);
const mockSignOut = jest.fn(() => Promise.resolve());
const mockUpdateProfile = jest.fn(() => Promise.resolve());
const mockOnAuthStateChanged = jest.fn((_auth, callback) => {
  callback(null);
  return jest.fn();
});

const browserLocalPersistence = { type: 'local' };
const browserSessionPersistence = { type: 'session' };

jest.mock('firebase/auth', () => ({
  __esModule: true,
  setPersistence: (...args: unknown[]) => mockSetPersistence(...args),
  signInWithEmailAndPassword: (...args: unknown[]) =>
    mockSignInWithEmailAndPassword(...args),
  createUserWithEmailAndPassword: (...args: unknown[]) =>
    mockCreateUserWithEmailAndPassword(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
  browserLocalPersistence,
  browserSessionPersistence,
}));

jest.mock('../config/firebase', () => ({
  auth: { currentUser: null },
}));

jest.mock('../services/draftService', () => ({
  draftService: {
    setCurrentUser: jest.fn(),
  },
}));

jest.mock('../services/firebaseStorage', () => {
  const storage = {
    setUserContext: jest.fn(),
    clearUserContext: jest.fn(),
  };
  return {
    firebaseStorage: storage,
    default: storage,
  };
});

jest.mock('../services/authPersistence', () => ({
  authPersistence: {
    getRememberMePreference: jest.fn(() => false),
    setRememberMePreference: jest.fn(),
    clear: jest.fn(),
  },
}));

interface CaptureProps {
  onReady: (value: ReturnType<typeof useAuth>) => void;
}

const CaptureAuth: React.FC<CaptureProps> = ({ onReady }) => {
  const auth = useAuth();

  React.useEffect(() => {
    onReady(auth);
  }, [auth, onReady]);

  return null;
};

describe('AuthContext remember-me behaviour', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignInWithEmailAndPassword.mockResolvedValue({
      user: { uid: 'user-123' },
    });
    mockCreateUserWithEmailAndPassword.mockResolvedValue({
      user: { uid: 'user-456' },
    });
    (firebaseStorage.setUserContext as jest.Mock).mockClear();
    (authPersistence.getRememberMePreference as jest.Mock).mockReturnValue(false);
  });

  const renderAndCapture = async () => {
    const captured: ReturnType<typeof useAuth>[] = [];
    render(
      <AuthProvider>
        <CaptureAuth onReady={(value) => captured.push(value)} />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(captured.length).toBeGreaterThan(0);
    });
    return captured[captured.length - 1];
  };

  it('uses local persistence when remember is true', async () => {
    const auth = await renderAndCapture();

    await act(async () => {
      await auth.signIn({
        email: 'test@example.com',
        password: 'secret',
        remember: true,
      });
    });

    expect(mockSignInWithEmailAndPassword).toHaveBeenCalled();
    expect(mockSetPersistence).toHaveBeenCalledWith(
      firebaseAuth,
      browserLocalPersistence
    );
    expect(authPersistence.setRememberMePreference as jest.Mock).toHaveBeenCalledWith(
      true
    );
    expect(firebaseStorage.setUserContext as jest.Mock).toHaveBeenCalledWith(
      'user-123'
    );
  });

  it('uses session persistence when remember is false', async () => {
    const auth = await renderAndCapture();

    await act(async () => {
      await auth.signIn({
        email: 'test@example.com',
        password: 'secret',
        remember: false,
      });
    });

    expect(mockSignInWithEmailAndPassword).toHaveBeenCalled();
    expect(mockSetPersistence).toHaveBeenCalledWith(
      firebaseAuth,
      browserSessionPersistence
    );
    expect(authPersistence.setRememberMePreference as jest.Mock).toHaveBeenCalledWith(
      false
    );
    expect(firebaseStorage.setUserContext as jest.Mock).toHaveBeenCalledWith(
      'user-123'
    );
  });

  it('falls back to stored preference when remember is omitted', async () => {
    (authPersistence.getRememberMePreference as jest.Mock).mockReturnValueOnce(
      true
    );
    const auth = await renderAndCapture();

    await act(async () => {
      await auth.signIn({
        email: 'fallback@example.com',
        password: 'secret',
      });
    });

    expect(mockSignInWithEmailAndPassword).toHaveBeenCalled();
    expect(mockSetPersistence).toHaveBeenCalledWith(
      firebaseAuth,
      browserLocalPersistence
    );
    expect(firebaseStorage.setUserContext as jest.Mock).toHaveBeenCalledWith(
      'user-123'
    );
  });

  it('defaults registration to local persistence', async () => {
    const auth = await renderAndCapture();

    await act(async () => {
      await auth.register({
        email: 'new@example.com',
        password: 'secret',
        displayName: 'New User',
      });
    });

    expect(mockSetPersistence).toHaveBeenCalledWith(
      firebaseAuth,
      browserLocalPersistence
    );
    expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalled();
    expect(firebaseStorage.setUserContext as jest.Mock).toHaveBeenCalledWith(
      'user-456'
    );
  });
});
