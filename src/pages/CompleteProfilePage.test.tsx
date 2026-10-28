import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/store/authStore';
import { completeProfile } from '@/features/auth/services/authApi';
import { CompleteProfilePage } from './CompleteProfilePage';

vi.mock('@/features/auth/services/authApi', () => ({
  login: vi.fn(),
  firstLogin: vi.fn(),
  logout: vi.fn(),
  me: vi.fn(),
  register: vi.fn(),
  verifyEmail: vi.fn(),
  resendVerification: vi.fn(),
  googleLogin: vi.fn(),
  completeProfile: vi.fn(),
}));

describe('CompleteProfilePage layout', () => {
  afterEach(() => {
    useAuthStore.setState({ accessToken: null, user: null, bootstrapping: false });
  });

  it('aligns the form card to the top instead of centering it vertically', () => {
    useAuthStore.setState({
      user: {
        id: 1,
        email: 'a@b.com',
        firstName: 'Ana',
        lastName: null,
        nickname: null,
        displayName: 'Ana',
        role: 'EMPLOYEE',
        companyId: null,
        companyName: null,
        categoryId: null,
        emailVerified: true,
        profileComplete: false,
      },
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <CompleteProfilePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const wrapper = screen.getByRole('heading', { name: /completá tu perfil/i }).closest('.flex-1');
    expect(wrapper).toHaveClass('items-start', 'pt-4', 'lg:pt-12');
    expect(wrapper).not.toHaveClass('items-center');
  });
});

describe('CompleteProfilePage — welcome lunch after saving the profile', () => {
  const incompleteUser = {
    id: 1,
    email: 'a@b.com',
    firstName: 'Ana',
    lastName: null,
    nickname: null,
    displayName: 'Ana',
    role: 'EMPLOYEE' as const,
    companyId: null,
    companyName: null,
    categoryId: null,
    emailVerified: true,
    profileComplete: false,
  };

  function renderPage() {
    useAuthStore.setState({ accessToken: 'tok', user: incompleteUser });
    return render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/complete-profile']}>
          <Routes>
            <Route path="/complete-profile" element={<CompleteProfilePage />} />
            <Route path="/orders/today" element={<p>Home empleado</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  function submitForm() {
    fireEvent.change(screen.getByLabelText(/^celular$/i), { target: { value: '1159876547' } });
    fireEvent.change(screen.getByLabelText(/cómo querés que te llamemos/i), { target: { value: 'Anita' } });
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
  }

  afterEach(() => {
    useAuthStore.setState({ accessToken: null, user: null, bootstrapping: false, pendingWelcomeLunch: false });
    vi.mocked(completeProfile).mockReset();
  });

  it('shows the welcome screen after saving when the lunch is pending, and Continuar goes home and clears the flag', async () => {
    vi.mocked(completeProfile).mockResolvedValueOnce({ ...incompleteUser, profileComplete: true, nickname: 'Anita' });
    renderPage();
    useAuthStore.getState().setPendingWelcomeLunch(true);

    submitForm();

    expect(await screen.findByText(/¡listo, bienvenido a arias!/i)).toBeInTheDocument();
    expect(
      screen.getByText('Completaste tu perfil y te regalamos 1 almuerzo de bienvenida 🎉'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Home empleado')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^celular$/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));

    expect(await screen.findByText('Home empleado')).toBeInTheDocument();
    expect(useAuthStore.getState().pendingWelcomeLunch).toBe(false);
  });

  it('shows no gift screen and redirects normally when the welcome lunch was not granted', async () => {
    vi.mocked(completeProfile).mockResolvedValueOnce({ ...incompleteUser, profileComplete: true, nickname: 'Anita' });
    renderPage();
    // What performGoogleLogin arms when the response says welcomeLunchGranted=false.
    useAuthStore.getState().setPendingWelcomeLunch(false);

    submitForm();

    expect(await screen.findByText('Home empleado')).toBeInTheDocument();
    expect(screen.queryByText(/te regalamos/i)).not.toBeInTheDocument();
  });

  it('goes straight to the home when no welcome lunch is pending', async () => {
    vi.mocked(completeProfile).mockResolvedValueOnce({ ...incompleteUser, profileComplete: true, nickname: 'Anita' });
    renderPage();

    submitForm();

    await waitFor(() => expect(screen.getByText('Home empleado')).toBeInTheDocument());
    expect(screen.queryByText(/¡listo, bienvenido a arias!/i)).not.toBeInTheDocument();
  });
});
