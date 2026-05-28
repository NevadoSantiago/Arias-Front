/**
 * Tipos del feature de orders.
 * Estos matchean (en su forma serializada) lo que vamos a recibir del backend.
 */

export type SideType = 'GUARNICION' | 'SALSA';

export interface Category {
  id: number;
  nombre: string;
  parentId: number | null;
}

/** Sección gastronómica del menú (independiente del tier de acceso) */
export interface MenuSection {
  id: number;
  nombre: string;
  ordenDisplay: number;
}

export interface Side {
  id: number;
  nombre: string;
  tipo: SideType;
  enabled: boolean;
}

export interface Dish {
  id: number;
  nombre: string;
  descripcion: string;
  fotoUrl: string | null;
  category: Category; // tier de acceso (Premium/Básico/etc.) — uso interno
  menuSection: MenuSection; // sección visual (Pastas/Carnes/etc.) — la que ve el empleado
  /** Si es null, el plato no lleva ningún acompañamiento */
  sideType: SideType | null;
  /** Sides permitidos para este plato (filtrados por sideType del lado del back) */
  allowedSides: Side[];
  stockActual: number;
  especial: boolean;
}

export type OrderEstado = 'PENDIENTE' | 'CONFIRMADO' | 'COMANDADO' | 'ENTREGADO';

export interface DailyChoice {
  id: number;
  fecha: string; // ISO date "2026-05-21"
  estado: OrderEstado;
  dishId: number;
  dishNombre: string;
  dishCategoria: string;
  sideId: number | null;
  sideNombre: string | null;
  notas: string | null;
  /** Hora de entrega para la empresa del usuario (snapshot al confirmar) */
  horaEntrega: string; // "12:30"
  /** Estado actual del plato/side — si alguno es false, el pedido necesita modificación */
  dishEnabled: boolean;
  sideEnabled: boolean | null; // null cuando el pedido no tiene side
}

export interface RestaurantConfig {
  horaCorte: string; // "10:00"
}
