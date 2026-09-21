# Especificación: self-registration (flujo de UI — mitad frontend)

## Purpose

Presentar en la interfaz el recorrido de autorregistro público: el formulario de alta, el botón de
inicio de sesión con Google, la experiencia de verificación de correo pendiente y la pantalla de
felicitación al recibir el almuerzo de bienvenida.

Este documento cubre únicamente los requisitos de **flujo de interfaz**. Los requisitos de
**dominio, API, verificación y otorgamiento del almuerzo de bienvenida** de esta misma capacidad
viven en `C:\Arias\backend\openspec\changes\b2c-credits-pivot\specs\self-registration\spec.md`.
Ningún requisito se duplica entre las dos copias: toda regla de negocio (rechazo de teléfono
duplicado, unicidad del otorgamiento, validez del ID token, etc.) se define y se prueba una sola vez,
en el backend; esta copia solo especifica cómo la interfaz la refleja.

## Requirements

### Requirement: Formulario de registro con datos mínimos
El sistema MUST presentar un formulario público accesible desde el QR que capture nombre, correo
electrónico, teléfono y un apodo para mostrar, y MUST mostrar en el propio formulario los errores de
campos faltantes o inválidos que la API de registro devuelva, sin exponer detalles internos.

#### Scenario: Visitante completa el formulario
- GIVEN un visitante que escaneó el QR y no tiene cuenta previa
- WHEN completa nombre, correo, teléfono y apodo y confirma
- THEN la UI envía la solicitud de registro y navega al paso de verificación de correo

#### Scenario: La UI señala campos faltantes
- GIVEN un visitante completando el formulario de registro
- WHEN el backend rechaza la solicitud por teléfono o apodo faltante
- THEN la UI resalta esos campos específicos sin perder los demás valores ya ingresados

### Requirement: Botón de inicio de sesión con Google como método prioritario
El sistema MUST ofrecer "Iniciar sesión con Google" como la opción más prominente del formulario de
registro, y MUST navegar a la pantalla de completar perfil cuando el backend indique que faltan
teléfono o apodo tras el alta con Google.

#### Scenario: Alta con Google
- GIVEN un visitante sin cuenta previa
- WHEN elige "Iniciar sesión con Google" y autoriza el acceso
- THEN la UI obtiene el ID token y lo envía al backend
- AND si el backend responde que el perfil está incompleto, navega a la pantalla de completar perfil

### Requirement: UX de verificación de correo electrónico
El sistema MUST bloquear en la interfaz las acciones que requieren cuenta verificada (por ejemplo,
pedir) mientras el correo no esté verificado, mostrando un mensaje claro y una opción para reenviar
el correo de verificación.

#### Scenario: Cuenta no verificada intenta pedir
- GIVEN una cuenta recién registrada sin verificar
- WHEN el usuario intenta iniciar un pedido
- THEN la UI muestra que la verificación de correo está pendiente y ofrece reenviarla, en lugar de
  dejarlo avanzar al carrito

#### Scenario: Verificación exitosa
- GIVEN un usuario que abre el enlace o ingresa el código de verificación recibido
- WHEN la API confirma la verificación
- THEN la UI habilita el uso normal de la cuenta

### Requirement: Pantalla de felicitación por el almuerzo de bienvenida
El sistema MUST mostrar una pantalla de felicitación inmediatamente después de que la cuenta quede
validada por primera vez (verificación de correo o alta con Google), indicando que se otorgó 1
almuerzo de bienvenida no transferible.

#### Scenario: Felicitación tras la primera validación
- GIVEN una cuenta que acaba de validarse por primera vez
- WHEN la API confirma el otorgamiento del almuerzo de bienvenida
- THEN la UI muestra la pantalla de felicitación exactamente una vez

### Requirement: El flujo de lista blanca de empresas no se toca
El sistema MUST mantener sin cambios las pantallas existentes `EmailStep`/`FirstLoginStep` del flujo
`first-login` para empleados pre-cargados por una empresa, sin mezclarlas con las pantallas nuevas de
autorregistro.

#### Scenario: Empleado de empresa ve el flujo existente
- GIVEN un empleado pre-cargado por un `COMPANY_ADMIN`
- WHEN inicia sesión por primera vez
- THEN la UI le muestra el flujo `first-login` existente, sin el formulario de autorregistro ni la
  pantalla de felicitación del almuerzo de bienvenida
