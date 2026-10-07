import { Outlet } from 'react-router-dom';
import { TourProvider } from './TourProvider';

/**
 * Layout raíz sin path: monta el tour una sola vez por encima de todas las
 * rutas, así no se desmonta al pasar del pedido a la billetera ni al abrir hojas.
 */
export function TourRoot() {
  return (
    <TourProvider>
      <Outlet />
    </TourProvider>
  );
}
