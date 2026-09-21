# Especificación: public-landing

## Purpose

Dividir la landing pública en un recorrido B2C (historia → registro) como contenido principal, trasladando la sección corporativa existente a `/corporate` sin perder ningún contenido.

## Requirements

### Requirement: Landing B2C como entrada principal
El sistema MUST presentar, en la landing pública raíz, un recorrido orientado al consumidor final que narra la propuesta y conduce al registro (autorregistro).

#### Scenario: Visita a la landing pública
- GIVEN un visitante sin autenticar que accede a la landing pública
- WHEN carga la página
- THEN el sistema muestra el contenido orientado a B2C con una llamada a la acción hacia el registro

### Requirement: Contenido corporativo trasladado a /corporate
El sistema MUST conservar íntegramente el contenido corporativo existente (propuesta B2B, formulario de contacto/cotización) en la ruta `/corporate`, accesible sin autenticación.

#### Scenario: Acceso al contenido corporativo
- GIVEN un visitante que busca información para empresas
- WHEN navega a `/corporate`
- THEN el sistema muestra el contenido corporativo existente sin pérdida de información respecto de la landing anterior

#### Scenario: Contenido corporativo ya no está en la raíz
- GIVEN la nueva landing B2C publicada en la raíz
- WHEN un visitante carga la raíz del sitio
- THEN el sistema no muestra el contenido corporativo directamente en esa página
