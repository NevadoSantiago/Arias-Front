import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RegisterForm } from './RegisterForm';
import { register } from '../services/authApi';

vi.mock('../services/authApi', () => ({
  login: vi.fn(),
  firstLogin: vi.fn(),
  logout: vi.fn(),
  me: vi.fn(),
  register: vi.fn(),
  verifyEmail: vi.fn(),
  resendVerification: vi.fn(),
  googleLogin: vi.fn(),
  completeProfile: vi.fn(),
  InvalidCredentialsError: class InvalidCredentialsError extends Error {},
}));

function renderForm() {
  return render(
    <MemoryRouter>
      <RegisterForm />
    </MemoryRouter>,
  );
}

function fillValidFormExceptPassword() {
  fireEvent.change(screen.getByLabelText(/^nombre$/i), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'ana@example.com' } });
  fireEvent.change(screen.getByLabelText(/^teléfono$/i), { target: { value: '+5491112345678' } });
  fireEvent.change(screen.getByLabelText(/cómo querés que te llamemos/i), { target: { value: 'Anita' } });
}

describe('RegisterForm', () => {
  beforeEach(() => {
    vi.mocked(register).mockReset();
  });

  it('validates the password length client-side before submitting', async () => {
    renderForm();
    fillValidFormExceptPassword();
    fireEvent.change(screen.getByLabelText(/^contraseña$/i), { target: { value: 'short' } });

    fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));

    expect(await screen.findByText(/al menos 8 caracteres/i)).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('navigates to the verify-email step and never logs the user in on success', async () => {
    vi.mocked(register).mockResolvedValueOnce(undefined);
    renderForm();
    fillValidFormExceptPassword();
    fireEvent.change(screen.getByLabelText(/^contraseña$/i), { target: { value: 'password123' } });

    fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));

    await vi.waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    expect(register).toHaveBeenCalledWith({
      firstName: 'Ana',
      lastName: undefined,
      email: 'ana@example.com',
      phone: '+5491112345678',
      nickname: 'Anita',
      password: 'password123',
    });
  });

  it('highlights the specific field reported by the backend without losing the other values', async () => {
    vi.mocked(register).mockRejectedValueOnce(new Error('phone: must not be blank'));
    renderForm();
    fillValidFormExceptPassword();
    fireEvent.change(screen.getByLabelText(/^contraseña$/i), { target: { value: 'password123' } });

    fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));

    expect(await screen.findByText(/revisá el teléfono ingresado/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^nombre$/i)).toHaveValue('Ana');
    expect(screen.getByLabelText(/^email$/i)).toHaveValue('ana@example.com');
    expect(screen.getByLabelText(/cómo querés que te llamemos/i)).toHaveValue('Anita');
  });
});
