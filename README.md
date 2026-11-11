# Finanzas

App para el móvil (PWA) que responde a una pregunta: **¿cuánto puedo gastar?** Apuntas lo que entra, los gastos fijos se restan solos cada mes y el resto se reparte entre impuestos, colchón, ahorro y gasto. Tres ámbitos separados: Acceler SL, autónomo y personal.

La puesta en marcha para Alfonso está en `GUIA.pdf` (fuente: `docs/guia.html`).

## Qué hace y qué no

- Registra y reparte. No se conecta al banco, no mueve dinero, no emite facturas, no presenta impuestos y no da consejo de inversión.
- Las cifras de impuestos son una estimación (un porcentaje por ámbito que pone el usuario).

## Cómo está hecha

| Parte | Dónde | Notas |
|---|---|---|
| Reparto (cálculo puro, en céntimos) | `src/logica/reparto.js` | Sin estado guardado: todo sale de ingresos, gastos y fijos |
| Historial de gastos fijos | `src/logica/fijos.js` | Cambiar un importe cierra el fijo antiguo y abre uno nuevo desde este mes |
| Datos de prueba (sin Supabase) | `src/datos/demo.js` | localStorage; arranca así si no hay `.env.local` |
| Datos reales | `src/datos/supa.js` | Solo clave pública + sesión del usuario |
| Esquema y aislamiento | `supabase/01_esquema.sql` | RLS por pertenencia al ámbito (`miembros`) |
| Alta de ámbitos y accesos | `supabase/02_usuarios.sql` | Alfonso en los tres, el socio solo en la SL |
| Pantallas | `src/vistas.jsx`, `src/hojas.jsx` | Una pregunta por vista |

## Aislamiento entre usuarios

Se impone en la base de datos, no en la interfaz: cada fila lleva `ambito_id` y las políticas RLS solo dejan leer o escribir filas de ámbitos de los que el usuario es miembro. Crear ámbitos o repartir accesos no es posible desde la app (sin permisos de escritura sobre `ambitos` ni `miembros`).

`tests/aislamiento.test.js` carga los mismos archivos SQL en un Postgres real (PGlite) y ataca como el socio, como un usuario sin ámbitos y sin sesión: lecturas, sumas, escrituras, mover filas de ámbito y autoconcederse acceso. Si se añade una tabla sin RLS, falla.

## Comandos

```bash
npm run dev        # desarrollo, http://localhost:8801
npm test           # reparto + aislamiento
npm run build      # genera dist/
npm run publicar   # build + subida a la rama gh-pages (GitHub Pages)
npm run verificar  # contra el Supabase real: sin sesión no se lee ni se escribe
npm run copia      # copia de todos los datos a copias/ (necesita .env.copia)
```

## Publicación

- Enlace: https://acceler-mkt.github.io/finanzas/ (GitHub Pages, rama `gh-pages`; el código va en `main`).
- Publicada el 11-11-2026 con datos de prueba. Con `.env.local` presente, `npm run publicar` la publica conectada a Supabase; la URL del proyecto y la clave pública quedan visibles en el bundle, que es lo previsto.

## Pendiente

- Crear el proyecto de Supabase y volver a publicar (pasos en `GUIA.pdf`). La ruta de datos reales no se ha podido probar de extremo a extremo hasta que exista el proyecto.
- Aparcado por decisión de Alfonso (10-11-2026): conexión bancaria, categorías, lectura de facturas, enlace con el ERP.
