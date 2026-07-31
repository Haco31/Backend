# Sistema de Etiquetas

API REST para que pequeños emprendedores (bazares, bodegas, tiendas de barrio) gestionen su catálogo de productos y generen etiquetas adhesivas imprimibles con código de barras, nombre, precio y empresa.

## Stack tecnológico

- **Node.js + Express** — API REST
- **PostgreSQL** — base de datos relacional
- **Docker & Docker Compose** — contenedores para la API y la base de datos, con persistencia de datos en disco
- **bwip-js** — generación de imágenes de código de barras (Code128)

## Arquitectura

Dos servicios independientes orquestados con Docker Compose:

- **`db`** — contenedor de PostgreSQL 16, con los datos persistidos en una carpeta local (`pgdata`) para que sobrevivan a reinicios del contenedor.
- **`api`** — contenedor de Node/Express, que se conecta a `db` a través de la red interna de Docker Compose (usando el nombre del servicio como host).

## Modelo de datos

El sistema modela empresas que venden productos con variantes (subproductos), y registra ventas con el detalle de qué se vendió.

```
EMPRESA ──< COLABORADOR
EMPRESA ──< PRODUCTO ──< SUBPRODUCTO
CATEGORIA ──< PRODUCTO
EMPRESA ──< VENTA ──< DETALLE_VENTA >── SUBPRODUCTO
```

- **`empresa`** — negocio dueño del catálogo (nombre)
- **`categoria`** — categoría de productos (nombre)
- **`colaborador`** — empleados de una empresa
- **`producto`** — ficha general de un artículo (nombre, empresa, categoría)
- **`subproducto`** — variante vendible de un producto (nombre, precio, código de barras). Todo lo que se vende pasa por aquí, incluso productos "simples" que reciben una única variante por defecto.
- **`venta`** — encabezado de una venta (cliente, fecha, empresa)
- **`detalle_venta`** — tabla intermedia que resuelve la relación muchos-a-muchos entre `venta` y `subproducto` (qué se vendió, cantidad, precio unitario al momento de la venta)

Los códigos de barras se generan con una `SEQUENCE` de PostgreSQL (`codigo_barras_seq`) en formato `B-00001`, `B-00002`, etc., garantizando unicidad incluso con borrados o escrituras concurrentes.

## Cómo levantar el proyecto

1. Clona el repositorio.
2. Crea un archivo `.env` en la raíz con:
   ```
   DB_USER=admin
   DB_PASSWORD=tu_contraseña
   DB_NAME=etiquetas
   ```
3. Levanta los contenedores:
   ```bash
   docker compose up -d --build
   ```
4. Crea las tablas ejecutando el script SQL (`schema.sql`) dentro del contenedor de la base de datos:
   ```bash
   docker exec -it etiquetas_db psql -U admin -d etiquetas -f /ruta/al/schema.sql
   ```
5. La API queda disponible en `http://localhost:3000`.

## Endpoints

Todas las rutas devuelven JSON, excepto la del código de barras (imagen PNG).

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/productos` | Lista todos los productos |
| GET | `/productos/:id` | Detalle de un producto |
| POST | `/productos` | Crea un producto junto con su subproducto por defecto (transacción) |
| PUT | `/productos/:id` | Actualiza un producto |
| DELETE | `/productos/:id` | Elimina un producto (rechazado si tiene subproductos asociados) |
| GET | `/subproductos` | Lista todos los subproductos |
| GET | `/subproductos/:id` | Detalle de un subproducto |
| GET | `/subproductos/:id/completo` | Subproducto con nombre de empresa incluido (JOIN de 2 tablas) |
| GET | `/subproductos/:id/codigo-barras` | Imagen PNG del código de barras |
| POST | `/subproductos` | Crea una variante de un producto existente |
| PUT | `/subproductos/:id` | Actualiza un subproducto |
| DELETE | `/subproductos/:id` | Elimina un subproducto (rechazado si tiene ventas asociadas) |
| GET / POST / PUT / DELETE | `/empresa`, `/empresa/:id` | CRUD de empresas |
| GET / POST / PUT / DELETE | `/categoria`, `/categoria/:id` | CRUD de categorías |
| GET / POST / PUT / DELETE | `/colaborador`, `/colaborador/:id` | CRUD de colaboradores |

## Seguridad implementada

- **Credenciales fuera del código**: usuario y contraseña de la base de datos viven en `.env` (excluido de Git vía `.gitignore`), inyectados como variables de entorno en ambos contenedores.
- **Consultas parametrizadas** (`$1, $2...`) en todas las rutas — previene inyección SQL.
- **Validación de entrada** en cada `POST`/`PUT`: campos de texto no vacíos, campos numéricos con tipo y rango verificados, antes de tocar la base de datos.
- **Transacciones** (`BEGIN`/`COMMIT`/`ROLLBACK`) en operaciones que escriben en más de una tabla a la vez, para evitar registros a medio crear.
- **Manejo específico de errores de Postgres** (violación de llave foránea, etc.) traducido a respuestas HTTP claras (`404`, `409`) en vez de errores crípticos.

## Pendiente / roadmap

- Autenticación (login por empresa, para que cada una solo acceda a sus propios datos)
- PDF con múltiples etiquetas por hoja, listo para imprimir
- Frontend para gestionar el catálogo visualmente
- Migración de datos previa a cualquier `DROP COLUMN` en producción
