/**
 * Protected Route Component
 * Ensures only authenticated users can access certain routes
 */

import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import SignInPage from './SignInPage';
import { LoadingSpinner } from './loading';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isSignedIn, isLoading } = useAuth();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <LoadingSpinner 
        fullHeight
        message="Checking authentication..."
        sx={{ minHeight: '100vh' }}
      />
    );
  }

  // Show sign-in page if not authenticated
  if (!isSignedIn) {
    return <SignInPage />;
  }

  // Render protected content if authenticated
  return <>{children}</>;
};

export default ProtectedRoute;