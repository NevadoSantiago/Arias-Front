import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { useAuthStore, type AuthUser } from '../store/authStore';

const baseUser: AuthUser = {
  id: 1,
  email: 'ana@example.com',
  firstName: 'Ana',
  lastName: null,
  role: 'EMPLOYEE',
  companyId: null,
  companyName: null,
  categoryId: null,
  emailVerified: true,
  profileComplete: true,
};

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/orders/today"
          element={
            <ProtectedRoute>
              <p>Página protegida</p>
            </ProtectedRoute>
          }
        />
        <Route path="/complete-profile" element={<p>Completá tu perfil</p>} />
        <Route path="/login" element={<p>Login</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute — guard de perfil incompleto', () => {
  afterEach(() => {
    useAuthStore.setState({ accessToken: null, user: null, bootstrapping: false });
  });

  it('redirects an authenticated user with an incomplete profile to /complete-profile', () => {
    useAuthStore.setState({
      accessToken: 'token',
      user: { ...baseUser, profileComplete: false },
      bootstrapping: false,
    });

    renderAt('/orders/today');

    expect(screen.getByText('Completá tu perfil')).toBeInTheDocument();
  });

  it('renders the protected content when the profile is complete', () => {
    useAuthStore.setState({ accessToken: 'token', user: baseUser, bootstrapping: false });

    renderAt('/orders/today');

    expect(screen.getByText('Página protegida')).toBeInTheDocument();
  });

  it('redirects an unauthenticated visitor to /login', () => {
    renderAt('/orders/today');

    expect(screen.getByText('Login')).toBeInTheDocument();
  });
});
