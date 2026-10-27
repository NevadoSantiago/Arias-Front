import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

function renderForm(entry = '/register') {
  return render(
    <QueryClientProvider client={new QueryClient()}>
    <MemoryRouter initialEntries={[entry]}>
      <RegisterForm />
    </MemoryRouter>
    </QueryClientProvider>,
  );
}

function fillValidFormExceptPassword() {
  fireEvent.change(screen.getByLabelText(/^nombre$/i), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'ana@example.com' } });
  fireEvent.change(screen.getByLabelText(/^celular$/i), { target: { value: '1159876547' } });
  fireEvent.change(screen.getByLabelText(/cómo querés que te llamemos/i), { target: { value: 'Anita' } });
}

describe('RegisterForm', () => {
  beforeEach(() => {
    vi.mocked(register).mockReset();
  });

  it('pre-fills the email from ?email= and keeps it editable', () => {
    renderForm('/register?email=nuevo%2B1%40example.com');

    const email = screen.getByLabelText(/^email$/i);
    expect(email).toHaveValue('nuevo+1@example.com');
    fireEvent.change(email, { target: { value: 'otro@example.com' } });
    expect(email).toHaveValue('otro@example.com');
  });

  it('leaves the email empty without ?email=', () => {
    renderForm();

    expect(screen.getByLabelText(/^email$/i)).toHaveValue('');
  });

  it('validates the password length client-side before submitting', async () => {
    renderForm();
    fillValidFormExceptPassword();
    fireEvent.change(screen.getByLabelText(/^nueva contraseña$/i), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText(/^repita la contraseña$/i), { target: { value: 'short' } });

    fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));

    expect(await screen.findByText(/al menos 8 caracteres/i)).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('shows a mismatch error and does not submit when the passwords differ', async () => {
    renderForm();
    fillValidFormExceptPassword();
    fireEvent.change(screen.getByLabelText(/^nueva contraseña$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/^repita la contraseña$/i), { target: { value: 'password124' } });

    fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));

    expect(await screen.findByText('Las contraseñas no coinciden')).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('gives each password field its own show/hide toggle', () => {
    renderForm();

    const toggles = screen.getAllByRole('button', { name: 'Mostrar contraseña' });
    expect(toggles).toHaveLength(2);

    fireEvent.click(toggles[1]);
    expect(screen.getByLabelText(/^repita la contraseña$/i)).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText(/^nueva contraseña$/i)).toHaveAttribute('type', 'password');
  });

  it('navigates to the verify-email step and never logs the user in on success', async () => {
    vi.mocked(register).mockResolvedValueOnce(undefined);
    renderForm();
    fillValidFormExceptPassword();
    fireEvent.change(screen.getByLabelText(/^nueva contraseña$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/^repita la contraseña$/i), { target: { value: 'password123' } });

    fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));

    await vi.waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    expect(register).toHaveBeenCalledWith({
      firstName: 'Ana',
      lastName: undefined,
      email: 'ana@example.com',
      phone: '+5491159876547',
      nickname: 'Anita',
      password: 'password123',
    });
    expect(vi.mocked(register).mock.calls[0][0]).not.toHaveProperty('confirmPassword');
  });

  it('accepts a 10-digit phone typed with spaces and dashes and sends it as E.164', async () => {
    vi.mocked(register).mockResolvedValueOnce(undefined);
    renderForm();
    fillValidFormExceptPassword();
    fireEvent.change(screen.getByLabelText(/^celular$/i), { target: { value: '11 5987-6547' } });
    fireEvent.change(screen.getByLabelText(/^nueva contraseña$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/^repita la contraseña$/i), { target: { value: 'password123' } });

    fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));

    await vi.waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    expect(vi.mocked(register).mock.calls[0][0].phone).toBe('+5491159876547');
  });

  it('sends the E.164 number of the selected country', async () => {
    vi.mocked(register).mockResolvedValueOnce(undefined);
    renderForm();
    fillValidFormExceptPassword();
    expect(screen.getByLabelText('País')).toHaveValue('AR');
    fireEvent.change(screen.getByLabelText('País'), { target: { value: 'UY' } });
    fireEvent.change(screen.getByLabelText(/^celular$/i), { target: { value: '99 123 456' } });
    fireEvent.change(screen.getByLabelText(/^nueva contraseña$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/^repita la contraseña$/i), { target: { value: 'password123' } });

    fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));

    await vi.waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    expect(vi.mocked(register).mock.calls[0][0].phone).toBe('+59899123456');
  });

  it('attaches a server phone error to the number field', async () => {
    vi.mocked(register).mockRejectedValueOnce(new Error('Ese teléfono ya está asociado a una cuenta'));
    renderForm();
    fillValidFormExceptPassword();
    fireEvent.change(screen.getByLabelText(/^nueva contraseña$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/^repita la contraseña$/i), { target: { value: 'password123' } });

    fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));

    expect(await screen.findByText(/ese teléfono ya está asociado/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^celular$/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it.each(['+54 9 11 5987-6547', 'abc123'])(
    'rejects the phone %s client-side',
    async (phone) => {
      renderForm();
      fillValidFormExceptPassword();
      fireEvent.change(screen.getByLabelText(/^celular$/i), { target: { value: phone } });
      fireEvent.change(screen.getByLabelText(/^nueva contraseña$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/^repita la contraseña$/i), { target: { value: 'password123' } });

      fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));

      expect(await screen.findByText('Usá solo números')).toBeInTheDocument();
      expect(register).not.toHaveBeenCalled();
    },
  );

  it('highlights the specific field reported by the backend without losing the other values', async () => {
    vi.mocked(register).mockRejectedValueOnce(new Error('phone: must not be blank'));
    renderForm();
    fillValidFormExceptPassword();
    fireEvent.change(screen.getByLabelText(/^nueva contraseña$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/^repita la contraseña$/i), { target: { value: 'password123' } });

    fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));

    expect(await screen.findByText(/revisá el teléfono ingresado/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^nombre$/i)).toHaveValue('Ana');
    expect(screen.getByLabelText(/^email$/i)).toHaveValue('ana@example.com');
    expect(screen.getByLabelText(/cómo querés que te llamemos/i)).toHaveValue('Anita');
  });
});
