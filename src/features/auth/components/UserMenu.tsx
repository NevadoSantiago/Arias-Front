import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { CircleUser, LogOut, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsDesktop } from '@/lib/useMediaQuery';
import { useAuthActions } from '../hooks/useAuthActions';
import { updateNickname } from '../services/authApi';
import { useAuthStore } from '../store/authStore';

const MIN_LEN = 2;
const MAX_LEN = 50;
const LENGTH_ERROR = `El alias tiene que tener entre ${MIN_LEN} y ${MAX_LEN} caracteres.`;

/** Alias con lápiz → input inline con Guardar/Cancelar. Enter guarda, Escape cancela. */
function NicknameEditor() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (!user) return null;

  const start = () => {
    setDraft(user.nickname ?? '');
    setError(null);
    setEditing(true);
  };
  const cancel = () => {
    setEditing(false);
    setError(null);
  };

  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    if (saving) return;
    const value = draft.trim();
    if (value.length < MIN_LEN || value.length > MAX_LEN) {
      setError(LENGTH_ERROR);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateNickname(value);
      setUser(updated);
      toast.success('Alias actualizado');
      setEditing(false);
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      setError(status === 400 ? LENGTH_ERROR : 'No se pudo guardar el alias. Probá de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      // Cancels the edit only; the menu itself stays open.
      e.stopPropagation();
      if (!saving) cancel();
    }
  };

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-brand text-muted-foreground">Alias</p>
          <p className={user.nickname ? 'truncate text-base font-semibold' : 'text-base text-muted-foreground'}>
            {user.nickname ?? 'Agregar alias'}
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label="Editar alias" onClick={start}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void save(e)} className="flex flex-col gap-2" noValidate>
      <label htmlFor="user-menu-nickname" className="text-[11px] font-semibold uppercase tracking-brand text-muted-foreground">
        Alias
      </label>
      <Input
        id="user-menu-nickname"
        ref={inputRef}
        value={draft}
        disabled={saving}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'user-menu-nickname-error' : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          onKeyDown(e);
          if (e.key === 'Enter') {
            e.preventDefault();
            void save();
          }
        }}
        className="h-11"
      />
      {error && (
        <p id="user-menu-nickname-error" role="alert" className="text-[13px] text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={saving} className="min-h-[44px] flex-1">
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
        <Button type="button" variant="outline" disabled={saving} onClick={cancel} className="min-h-[44px] flex-1">
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function MenuContent() {
  const user = useAuthStore((s) => s.user);
  const { performLogout } = useAuthActions();
  if (!user) return null;
  return (
    <div className="flex flex-col gap-3">
      <NicknameEditor />
      <p className="truncate border-t border-border pt-3 text-sm text-muted-foreground">{user.email}</p>
      <Button
        type="button"
        variant="outline"
        className="min-h-[44px] justify-start gap-2"
        onClick={() => void performLogout()}
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
        Cerrar sesión
      </Button>
    </div>
  );
}

/**
 * Menú de cuenta de los tres layouts: ícono de usuario que abre un popover en
 * escritorio y una hoja inferior en móvil, con alias editable, email y
 * "Cerrar sesión".
 */
export function UserMenu() {
  const desktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !desktop) return;
    const onDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onDown);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onDown);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [open, desktop]);

  const trigger = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-11 w-11"
      aria-label="Cuenta"
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => setOpen((v) => !v)}
    >
      <CircleUser className="h-5 w-5" aria-hidden="true" />
    </Button>
  );

  if (!desktop) {
    return (
      <>
        {trigger}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent closeLabel="Cerrar">
            <SheetHeader>
              <SheetTitle>Tu cuenta</SheetTitle>
              <SheetDescription className="sr-only">Alias, email y cierre de sesión.</SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-6">
              <MenuContent />
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      {trigger}
      {open && (
        <div
          role="dialog"
          aria-label="Tu cuenta"
          className="absolute right-0 top-full z-50 mt-2 w-72 rounded-md border border-border bg-card p-4 shadow-lg"
        >
          <MenuContent />
        </div>
      )}
    </div>
  );
}
