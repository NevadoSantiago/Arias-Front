import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { UserMenu } from './UserMenu';
import { useAuthStore, type AuthUser } from '../store/authStore';
import { updateNickname } from '../services/authApi';
import { mockMatchMedia } from '@/test/matchMedia';

const performLogout = vi.fn();

vi.mock('../hooks/useAuthActions', () => ({ useAuthActions: () => ({ performLogout }) }));
vi.mock('../services/authApi', () => ({ updateNickname: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const user: AuthUser = {
  id: 1,
  email: 'lucia@example.com',
  firstName: 'Lucía',
  lastName: 'Ferreyra',
  nickname: 'Lu',
  displayName: 'Lu',
  role: 'SUPER_ADMIN',
  companyId: null,
  companyName: null,
  categoryId: null,
  emailVerified: true,
  profileComplete: true,
};

let media: ReturnType<typeof mockMatchMedia>;

const u = {
  click: (el: HTMLElement) => fireEvent.click(el),
  clear: (el: HTMLElement) => fireEvent.change(el, { target: { value: '' } }),
  type: (el: HTMLElement, text: string) => {
    const enter = text.endsWith('{Enter}');
    const value = (el as HTMLInputElement).value + text.replace('{Enter}', '');
    fireEvent.change(el, { target: { value } });
    if (enter) fireEvent.keyDown(el, { key: 'Enter' });
  },
  keyboard: (key: string) => fireEvent.keyDown(document.activeElement ?? document.body, { key: key.replace(/[{}]/g, '') }),
};

async function openMenu() {
  render(<UserMenu />);
  u.click(screen.getByRole('button', { name: 'Cuenta' }));
  return u;
}

describe('UserMenu', () => {
  beforeEach(() => {
    media = mockMatchMedia(true);
    useAuthStore.setState({ accessToken: 't', user, bootstrapping: false });
  });
  afterEach(() => {
    media.restore();
    useAuthStore.setState({ accessToken: null, user: null, bootstrapping: true });
    vi.clearAllMocks();
  });

  it('shows only the icon trigger until opened', () => {
    render(<UserMenu />);
    expect(screen.getByRole('button', { name: 'Cuenta' })).toBeInTheDocument();
    expect(screen.queryByText('lucia@example.com')).not.toBeInTheDocument();
  });

  it('renders the alias and the email once opened', async () => {
    await openMenu();
    expect(screen.getByText('Lu')).toBeInTheDocument();
    expect(screen.getByText('lucia@example.com')).toBeInTheDocument();
  });

  it('offers "Agregar alias" when the user has no nickname', async () => {
    useAuthStore.setState({ user: { ...user, nickname: null, displayName: 'Lucía Ferreyra' } });
    await openMenu();
    expect(screen.getByText('Agregar alias')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar alias' })).toBeInTheDocument();
  });

  it('saves a new alias, updates the store and toasts', async () => {
    vi.mocked(updateNickname).mockResolvedValue({ ...user, nickname: 'Luli', displayName: 'Luli' });
    await openMenu();
    u.click(screen.getByRole('button', { name: 'Editar alias' }));
    const input = screen.getByRole('textbox', { name: 'Alias' });
    expect(input).toHaveValue('Lu');
    u.clear(input);
    u.type(input, '  Luli  ');
    u.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(useAuthStore.getState().user?.nickname).toBe('Luli'));
    expect(updateNickname).toHaveBeenCalledWith('Luli');
    expect(useAuthStore.getState().user?.displayName).toBe('Luli');
    expect(toast.success).toHaveBeenCalledWith('Alias actualizado');
    expect(screen.queryByRole('textbox', { name: 'Alias' })).not.toBeInTheDocument();
  });

  it('saves with Enter and cancels with Escape without closing the menu', async () => {
    vi.mocked(updateNickname).mockResolvedValue({ ...user, nickname: 'Nuevo', displayName: 'Nuevo' });
    await openMenu();
    u.click(screen.getByRole('button', { name: 'Editar alias' }));
    u.keyboard('{Escape}');
    expect(screen.queryByRole('textbox', { name: 'Alias' })).not.toBeInTheDocument();
    expect(screen.getByText('lucia@example.com')).toBeInTheDocument();
    expect(updateNickname).not.toHaveBeenCalled();

    u.click(screen.getByRole('button', { name: 'Editar alias' }));
    const input = screen.getByRole('textbox', { name: 'Alias' });
    u.clear(input);
    u.type(input, 'Nuevo{Enter}');
    await waitFor(() => expect(updateNickname).toHaveBeenCalledWith('Nuevo'));
  });

  it('cancels with the Cancelar button keeping the alias', async () => {
    await openMenu();
    u.click(screen.getByRole('button', { name: 'Editar alias' }));
    u.type(screen.getByRole('textbox', { name: 'Alias' }), 'xyz');
    u.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByText('Lu')).toBeInTheDocument();
    expect(updateNickname).not.toHaveBeenCalled();
  });

  it('rejects an alias that is too short or too long without calling the server', async () => {
    await openMenu();
    u.click(screen.getByRole('button', { name: 'Editar alias' }));
    const input = screen.getByRole('textbox', { name: 'Alias' });
    u.clear(input);
    u.type(input, ' a ');
    u.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('entre 2 y 50');
    u.clear(input);
    u.type(input, 'x'.repeat(51));
    u.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('entre 2 y 50');
    expect(updateNickname).not.toHaveBeenCalled();
  });

  it('shows the server error and keeps editing when saving fails', async () => {
    vi.mocked(updateNickname).mockRejectedValue(new Error('boom'));
    await openMenu();
    u.click(screen.getByRole('button', { name: 'Editar alias' }));
    u.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar el alias');
    expect(screen.getByRole('textbox', { name: 'Alias' })).toBeInTheDocument();
    expect(useAuthStore.getState().user?.nickname).toBe('Lu');
  });

  it('disables the actions while saving', async () => {
    let resolve!: (u: AuthUser) => void;
    vi.mocked(updateNickname).mockReturnValue(new Promise<AuthUser>((r) => (resolve = r)));
    await openMenu();
    u.click(screen.getByRole('button', { name: 'Editar alias' }));
    u.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    resolve({ ...user });
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Alias' })).not.toBeInTheDocument());
  });

  it('logs out through performLogout', async () => {
    await openMenu();
    u.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(performLogout).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape when not editing', async () => {
    await openMenu();
    u.keyboard('{Escape}');
    expect(screen.queryByText('lucia@example.com')).not.toBeInTheDocument();
  });

  it('renders the same content in a bottom sheet on mobile', async () => {
    media.set(false);
    await openMenu();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('lucia@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
  });
});
