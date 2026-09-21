# Especificación: credits-ui

## Purpose

Presentar en la interfaz la contraparte visual de las capacidades de dominio `credit-ledger` y
`credit-pack-purchase`, ambas responsabilidad del repositorio backend
(`C:\Arias\backend\openspec\changes\b2c-credits-pivot\specs\{credit-ledger,credit-pack-purchase}\spec.md`).
Esta capacidad no define ninguna regla de negocio nueva: solo especifica cómo la UI muestra el saldo,
el catálogo de paquetes y el estado de una compra, consumiendo los endpoints que el backend expone
(ver "Contrato con el backend" en `design.md` de este repositorio).

## Requirements

### Requirement: Visualización del saldo AVAILABLE y COMMITTED por separado
El sistema MUST mostrar al usuario su saldo de almuerzos AVAILABLE y COMMITTED como dos cifras
distintas, sin sumarlas en un único total, reflejando el modelo de dos buckets del libro mayor del
backend.

#### Scenario: Billetera con ambos saldos visibles
- GIVEN un usuario con 5 almuerzos AVAILABLE y 2 COMMITTED, según `GET /api/v1/credits/wallet`
- WHEN abre su billetera
- THEN la UI muestra "5 disponibles" y "2 comprometidos" como valores separados

### Requirement: Catálogo de paquetes con precio y descuento
El sistema MUST mostrar los paquetes de créditos habilitados (día/semana/mes) con su precio y su
descuento por volumen tal como los devuelve la API, sin recalcularlos en el cliente.

#### Scenario: Listado de paquetes
- GIVEN el catálogo de paquetes que devuelve `GET /api/v1/credits/packs`
- WHEN el usuario visita la sección de compra de paquetes
- THEN la UI muestra cada paquete con el precio y el descuento informados por la API

### Requirement: La página de retorno del checkout nunca afirma acreditación anticipada
El sistema MUST mostrar un estado de "procesando" en la página de retorno del checkout mientras el
estado de la compra reportado por la API sea `PENDING`, y MUST NOT mostrar un mensaje de éxito ni dar
por acreditados los créditos hasta que la API reporte `APPROVED`.

#### Scenario: Retorno antes de la confirmación del backend
- GIVEN un usuario que vuelve del checkout de Mercado Pago mediante `back_urls`
- WHEN la UI consulta `GET /api/v1/credits/purchases/{id}` y el estado es `PENDING`
- THEN la UI muestra "procesando" y sigue haciendo polling, sin afirmar que los créditos ya están
  disponibles

#### Scenario: Confirmación tras el webhook
- GIVEN una compra cuyo estado pasó a `APPROVED` en el backend
- WHEN la UI vuelve a consultar el estado de la compra
- THEN la UI muestra la confirmación de acreditación

### Requirement: Historial de movimientos legible
El sistema MUST presentar el historial de movimientos de créditos del usuario (`GET
/api/v1/credits/movements`) en orden cronológico, mostrando el tipo y la cantidad de cada movimiento
tal como los devuelve la API.

#### Scenario: Consulta del historial
- GIVEN un usuario con movimientos previos de distinto tipo
- WHEN abre su historial de compras/consumos
- THEN la UI lista cada movimiento con su tipo y cantidad, en orden cronológico
