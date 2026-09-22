import { useNavigate } from 'react-router-dom';
import { useAuthStore, type Role } from '../store/authStore';
import {
  login,
  firstLogin,
  logout,
  me,
  register,
  verifyEmail,
  resendVerification,
  googleLogin,
  completeProfile,
  type FirstLoginPayload,
  type LoginPayload,
  type RegisterPayload,
  type CompleteProfilePayload,
} from '../services/authApi';
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

  /**
   * Autorregistro: NUNCA loguea — el backend no emite sesión en `/register`
   * (poseer el token del mail de verificación es la prueba de que el correo
   * es propio). Solo navega al paso de "revisá tu correo".
   */
  const performRegister = async (payload: RegisterPayload) => {
    await register(payload);
    navigate(`/verify-email?email=${encodeURIComponent(payload.email)}`, { replace: true });
  };

  /** Reenvío del correo de verificación — no cambia el estado de sesión. */
  const performResendVerification = async (email: string) => {
    await resendVerification(email);
  };

  /**
   * Confirma el correo y establece la sesión. Devuelve el destino calculado
   * (perfil completo vs. `/complete-profile`) en vez de navegar directamente,
   * para que la pantalla de verificación pueda mostrar la felicitación por
   * el almuerzo de bienvenida antes de continuar.
   */
  const performVerifyEmail = async (token: string): Promise<{ profileComplete: boolean; role: Role }> => {
    const { accessToken } = await verifyEmail(token);
    useAuthStore.getState().setAccessToken(accessToken);
    const user = await me();
    setAuth(accessToken, user);
    return { profileComplete: user.profileComplete, role: user.role };
  };

  /** Alta/login con Google: siempre emite sesión; si falta perfil, va a completarlo. */
  const performGoogleLogin = async (idToken: string) => {
    const { accessToken } = await googleLogin(idToken);
    useAuthStore.getState().setAccessToken(accessToken);
    const user = await me();
    setAuth(accessToken, user);
    navigate(user.profileComplete ? homeForRole(user.role) : '/complete-profile', { replace: true });
  };

  /** Completa teléfono/apodo tras un alta por Google y recién ahí deja avanzar a la app. */
  const performCompleteProfile = async (payload: CompleteProfilePayload) => {
    const user = await completeProfile(payload);
    useAuthStore.getState().setUser(user);
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

  return {
    performLogin,
    performFirstLogin,
    performLogout,
    performRegister,
    performResendVerification,
    performVerifyEmail,
    performGoogleLogin,
    performCompleteProfile,
  };
}
