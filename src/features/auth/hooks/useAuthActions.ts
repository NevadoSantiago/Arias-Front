import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { login, firstLogin, logout, me, type FirstLoginPayload, type LoginPayload } from '../services/authApi';
import { homeForRole } from '../components/ProtectedRoute';

/**
 * Centraliza el flujo completo de login/first-login/logout para mantener
 * los componentes de auth desacoplados del store y de la navegación.
 */
export function useAuthActions() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const clear = useAuthStore((s) => s.clear);

  /** Login completo: token → me → store → navigate al home según rol. */
  const performLogin = async (payload: LoginPayload) => {
    const token = await login(payload);
    // El token debe estar en el store ANTES de llamar /me, porque /me usa Bearer
    useAuthStore.getState().setAccessToken(token);
    const user = await me();
    setAuth(token, user);
    navigate(homeForRole(user.role), { replace: true });
  };

  const performFirstLogin = async (payload: FirstLoginPayload) => {
    const token = await firstLogin(payload);
    useAuthStore.getState().setAccessToken(token);
    const user = await me();
    setAuth(token, user);
    // first-login solo aplica a EMPLOYEE (los admins se crean ya con password),
    // pero igual usamos homeForRole por consistencia
    navigate(homeForRole(user.role), { replace: true });
  };

  /** Logout: revoca cookie en backend, limpia store, navega a /login. */
  const performLogout = async () => {
    try {
      await logout();
    } catch {
      // Si el backend falla, igual limpiamos local — el peor caso es un token huérfano
    }
    clear();
    navigate('/login', { replace: true });
  };

  return { performLogin, performFirstLogin, performLogout };
}
