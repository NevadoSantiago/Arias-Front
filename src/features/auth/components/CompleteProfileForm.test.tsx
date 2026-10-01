import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CompleteProfileForm } from './CompleteProfileForm';
import { completeProfile } from '../services/authApi';

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
    <QueryClientProvider client={new QueryClient()}>
    <MemoryRouter>
      <CompleteProfileForm />
    </MemoryRouter>
    </QueryClientProvider>,
  );
}

function submit(phone: string) {
  fireEvent.change(screen.getByLabelText(/^teléfono$/i), { target: { value: phone } });
  fireEvent.change(screen.getByLabelText(/cómo querés que te llamemos/i), { target: { value: 'Anita' } });
  fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
}

describe('CompleteProfileForm — phone', () => {
  beforeEach(() => {
    vi.mocked(completeProfile).mockReset();
  });

  it('asks for a 10-digit mobile with a numeric keyboard', () => {
    renderForm();

    const input = screen.getByLabelText(/^teléfono$/i);
    expect(input).toHaveAttribute('placeholder', '1159876547');
    expect(input).toHaveAttribute('inputmode', 'numeric');
    expect(screen.getByText(/sin 0 ni 15/i)).toBeInTheDocument();
  });

  it('sends only the 10 digits when the phone is typed with spaces and dashes', async () => {
    vi.mocked(completeProfile).mockResolvedValueOnce({ role: 'EMPLOYEE' } as never);
    renderForm();

    submit('11 5987-6547');

    await waitFor(() => expect(completeProfile).toHaveBeenCalledTimes(1));
    expect(completeProfile).toHaveBeenCalledWith({ phone: '1159876547', nickname: 'Anita' });
  });

  it.each(['115987654', '11598765478', '+54 9 11 5987-6547'])('rejects %s', async (phone) => {
    renderForm();

    submit(phone);

    expect(await screen.findByText('Ingresá los 10 dígitos de tu celular')).toBeInTheDocument();
    expect(completeProfile).not.toHaveBeenCalled();
  });
});
