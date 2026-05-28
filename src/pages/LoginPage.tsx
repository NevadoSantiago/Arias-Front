import { useState } from 'react';
import { EmailStep } from '@/features/auth/components/EmailStep';
import { PasswordStep } from '@/features/auth/components/PasswordStep';
import { FirstLoginStep } from '@/features/auth/components/FirstLoginStep';
import bienvenidaIZ from '@/assets/illustrations/BienvenidaIZ.svg';
import bienvenidaDE from '@/assets/illustrations/BienvenidaDE.svg';

type Step =
  | { kind: 'email' }
  | { kind: 'password'; email: string }
  | { kind: 'first-login'; email: string };

export function LoginPage() {
  const [step, setStep] = useState<Step>({ kind: 'email' });
  const [lastEmail, setLastEmail] = useState('');

  const handleBack = () => {
    setStep({ kind: 'email' });
  };

  return (
    <div className="h-[100dvh] flex flex-col items-center justify-center bg-background lg:h-auto lg:min-h-screen lg:block">
      <header className="text-center shrink-0 lg:pt-20 lg:pb-4">
        <h1 className="font-display text-primary text-6xl lg:text-7xl font-bold leading-none mb-2">
          ARIAS
        </h1>
        <p className="font-sans text-primary text-sm tracking-brand uppercase font-medium">
          Bodegón &middot; Parrilla
        </p>
        <p className="font-sans text-xs tracking-brand uppercase text-muted-foreground mt-2">
          Familia Mazzariello &middot; Desde 2015
        </p>
      </header>

      <div className="shrink-0 w-full px-6 mt-4 lg:mt-0 lg:flex-1 lg:flex lg:flex-row lg:items-stretch">
        <aside
          className="hidden lg:flex lg:flex-1 lg:items-end lg:justify-end px-4 xl:px-8"
          aria-hidden="true"
        >
          <img
            src={bienvenidaIZ}
            alt=""
            className="w-full max-w-sm xl:max-w-md h-auto select-none pointer-events-none"
          />
        </aside>

        <section className="lg:flex-1 lg:flex lg:items-center lg:justify-center lg:px-8 lg:py-8 lg:-mt-[14rem]">
          <div className="w-full max-w-md mx-auto">
            <div className="bg-card rounded-lg border border-border p-8 shadow-sm">
              {step.kind === 'email' && (
                <EmailStep
                  initialEmail={lastEmail}
                  onPassword={(email) => {
                    setLastEmail(email);
                    setStep({ kind: 'password', email });
                  }}
                  onFirstLogin={(email) => {
                    setLastEmail(email);
                    setStep({ kind: 'first-login', email });
                  }}
                />
              )}

              {step.kind === 'password' && (
                <PasswordStep email={step.email} onBack={handleBack} />
              )}

              {step.kind === 'first-login' && (
                <FirstLoginStep email={step.email} onBack={handleBack} />
              )}
            </div>
          </div>
        </section>

        <aside
          className="hidden lg:flex lg:flex-1 lg:items-end lg:justify-start px-4 xl:px-8"
          aria-hidden="true"
        >
          <img
            src={bienvenidaDE}
            alt=""
            className="w-full max-w-sm xl:max-w-md h-auto select-none pointer-events-none"
          />
        </aside>
      </div>
    </div>
  );
}
