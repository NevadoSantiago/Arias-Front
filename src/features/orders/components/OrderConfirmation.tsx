import { useEffect } from 'react';
import pedidoConfirmado from '@/assets/illustrations/Confirmado2.svg';

interface Props {
  message: string;
  onComplete: () => void;
  duration?: number;
}

export function OrderConfirmation({ message, onComplete, duration = 2500 }: Props) {
  useEffect(() => {
    const timer = setTimeout(onComplete, duration);
    return () => clearTimeout(timer);
  }, [onComplete, duration]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative">
        <img
          src={pedidoConfirmado}
          alt=""
          className="w-40 h-auto sm:w-52 animate-bounce-in select-none pointer-events-none"
        />
        <div className="absolute -top-2 -right-2 w-10 h-10 sm:w-12 sm:h-12 bg-green-500 rounded-full flex items-center justify-center animate-pop-in shadow-lg">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 sm:w-6 sm:h-6">
            <polyline points="20 6 9 17 4 12" className="animate-draw-check" />
          </svg>
        </div>
      </div>
      <p className="font-display text-foreground text-xl sm:text-2xl font-bold text-center mt-6 animate-in slide-in-from-bottom-4 duration-500">
        {message}
      </p>
    </div>
  );
}
