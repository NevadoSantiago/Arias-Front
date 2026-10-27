import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EmailStep } from './EmailStep';
import { checkEmail } from '../services/authApi';

vi.mock('@/features/auth/services/authApi', () => ({
  checkEmail: vi.fn(),
  googleLogin: vi.fn(),
  me: vi.fn(),
}));

const onFirstLogin = vi.fn();
const onPassword = vi.fn();

function renderStep(props: { initialEmail?: string; initialNotice?: 'NOT_FOUND' | 'GOOGLE' } = {}) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <EmailStep onFirstLogin={onFirstLogin} onPassword={onPassword} {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function submit(email: string) {
  fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: email } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
}

const NOT_FOUND_TITLE = 'No encontramos una cuenta con ese email';

describe('EmailStep — sign-up link', () => {
  it('links to /register with "Creá tu cuenta" under a "¿No tenés cuenta?" divider', () => {
    renderStep();

    expect(screen.getByText('¿No tenés cuenta?')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Creá tu cuenta' })).toHaveAttribute('href', '/register');
  });

  it('carries the typed email in the sign-up link when it is valid', () => {
    renderStep();

    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'ana+1@example.com' } });

    expect(screen.getByRole('link', { name: 'Creá tu cuenta' })).toHaveAttribute(
      'href',
      '/register?email=ana%2B1%40example.com',
    );
  });

  it('does not carry the email in the sign-up link while it is invalid', () => {
    renderStep();

    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'ana@' } });

    expect(screen.getByRole('link', { name: 'Creá tu cuenta' })).toHaveAttribute('href', '/register');
  });
});

describe('EmailStep — account status', () => {
  beforeEach(() => {
    vi.mocked(checkEmail).mockReset();
    onFirstLogin.mockReset();
    onPassword.mockReset();
  });

  it('goes to the password step on PASSWORD', async () => {
    vi.mocked(checkEmail).mockResolvedValueOnce({ requiresFirstLogin: false, status: 'PASSWORD' });
    renderStep();

    submit('ana@example.com');

    await waitFor(() => expect(onPassword).toHaveBeenCalledWith('ana@example.com'));
    expect(onFirstLogin).not.toHaveBeenCalled();
  });

  it('goes to the first-login step on FIRST_LOGIN', async () => {
    vi.mocked(checkEmail).mockResolvedValueOnce({ requiresFirstLogin: true, status: 'FIRST_LOGIN' });
    renderStep();

    submit('ana@empresa.com');

    await waitFor(() => expect(onFirstLogin).toHaveBeenCalledWith('ana@empresa.com'));
    expect(onPassword).not.toHaveBeenCalled();
  });

  it('falls back to requiresFirstLogin when the backend sends no status', async () => {
    vi.mocked(checkEmail).mockResolvedValueOnce({ requiresFirstLogin: true });
    renderStep();

    submit('ana@empresa.com');

    await waitFor(() => expect(onFirstLogin).toHaveBeenCalledWith('ana@empresa.com'));
  });

  it('falls back to the password step when the backend sends no status and no first login', async () => {
    vi.mocked(checkEmail).mockResolvedValueOnce({ requiresFirstLogin: false });
    renderStep();

    submit('ana@example.com');

    await waitFor(() => expect(onPassword).toHaveBeenCalledWith('ana@example.com'));
  });

  it('shows the no-account notice on NOT_FOUND, replacing Continuar and the bottom block', async () => {
    vi.mocked(checkEmail).mockResolvedValueOnce({ requiresFirstLogin: false, status: 'NOT_FOUND' });
    renderStep();

    submit('nuevo+1@example.com');

    expect(await screen.findByText(NOT_FOUND_TITLE)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Si es tu primera vez en Arias, creá tu cuenta.');
    expect(screen.getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute(
      'href',
      '/register?email=nuevo%2B1%40example.com',
    );
    expect(screen.queryByRole('button', { name: 'Continuar' })).not.toBeInTheDocument();
    expect(screen.queryByText('¿No tenés cuenta?')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Creá tu cuenta' })).not.toBeInTheDocument();
    expect(screen.queryByText(/corregir el email/i)).not.toBeInTheDocument();
    expect(onPassword).not.toHaveBeenCalled();
    expect(onFirstLogin).not.toHaveBeenCalled();
  });

  it('clears the no-account notice when the email is edited', async () => {
    vi.mocked(checkEmail).mockResolvedValueOnce({ requiresFirstLogin: false, status: 'NOT_FOUND' });
    renderStep();
    submit('nuevo@example.com');
    await screen.findByText(NOT_FOUND_TITLE);

    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'nuevo@example.co' } });

    expect(screen.queryByText(NOT_FOUND_TITLE)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeInTheDocument();
    expect(screen.getByText('¿No tenés cuenta?')).toBeInTheDocument();
  });

  it('shows the Google notice on GOOGLE and keeps Continuar available', async () => {
    vi.mocked(checkEmail).mockResolvedValueOnce({ requiresFirstLogin: false, status: 'GOOGLE' });
    renderStep();

    submit('ana@gmail.com');

    expect(await screen.findByText('Tu cuenta entra con Google')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'La creaste con Google, así que no tiene contraseña. Tocá el botón Continuar con Google de arriba y elegí este email.',
    );
    expect(onPassword).not.toHaveBeenCalled();
  });

  it('clears the Google notice when the email is edited', async () => {
    vi.mocked(checkEmail).mockResolvedValueOnce({ requiresFirstLogin: false, status: 'GOOGLE' });
    renderStep();
    submit('ana@gmail.com');
    await screen.findByText('Tu cuenta entra con Google');

    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'ana@gmail.co' } });

    expect(screen.queryByText('Tu cuenta entra con Google')).not.toBeInTheDocument();
  });

  it('renders the notice from initialNotice (deep link) with the email filled in', () => {
    renderStep({ initialEmail: 'nuevo@example.com', initialNotice: 'NOT_FOUND' });

    expect(screen.getByLabelText(/^email$/i)).toHaveValue('nuevo@example.com');
    expect(screen.getByText(NOT_FOUND_TITLE)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute(
      'href',
      '/register?email=nuevo%40example.com',
    );
  });
});
