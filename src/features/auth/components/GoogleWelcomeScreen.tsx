import type { GoogleSignIn } from '../hooks/useGoogleSignIn';
import { WelcomeLunchScreen } from './WelcomeLunchScreen';

/** Felicitación por el almuerzo de bienvenida tras un alta con Google (compartida por login y registro). */
export function GoogleWelcomeScreen({ google }: { google: GoogleSignIn }) {
  return (
    <WelcomeLunchScreen
      description="Iniciaste sesión con Google y te regalamos 1 almuerzo de bienvenida 🎉"
      onContinue={google.continueAfterWelcome}
    />
  );
}
