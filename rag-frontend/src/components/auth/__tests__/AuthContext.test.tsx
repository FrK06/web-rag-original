// src/components/auth/__tests__/AuthContext.test.tsx
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../AuthContext';
import { loginUser } from '../authService';

// Mock the auth service
jest.mock('../authService', () => ({
  loginUser: jest.fn(),
  registerUser: jest.fn(),
  logoutUser: jest.fn(),
  getCurrentUser: jest.fn(),
  refreshToken: jest.fn(),
  requestPasswordReset: jest.fn(),
  resetPassword: jest.fn(),
  getCsrfToken: jest.fn().mockResolvedValue('mock-csrf-token')
}));

// Test component that uses auth context
const TestComponent = () => {
  const { isAuthenticated, login, logout } = useAuth();
  return (
    <div>
      <div data-testid="auth-status">{isAuthenticated ? 'Authenticated' : 'Not authenticated'}</div>
      <button onClick={() => login('test@example.com', 'password')}>Login</button>
      <button onClick={() => logout()}>Logout</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('provides authentication status correctly', () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    expect(screen.getByTestId('auth-status')).toHaveTextContent('Not authenticated');
  });

  test('login sets authenticated state', async () => {
    // Mock successful login
    (loginUser as jest.Mock).mockResolvedValueOnce({
      user: { id: '123', name: 'Test User', email: 'test@example.com' },
      token: 'mock-token',
      refreshToken: 'mock-refresh-token'
    });
    
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    // Click login button
    userEvent.click(screen.getByText('Login'));
    
    // Assert authentication status changes
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
    });
    
    // Check tokens are stored
    expect(localStorage.getItem('auth_token')).toBe('mock-token');
    expect(localStorage.getItem('refresh_token')).toBe('mock-refresh-token');
  });
});