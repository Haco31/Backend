-- Sistema de Etiquetas — esquema de base de datos
-- Orden de creación respeta las dependencias: primero las tablas sin llaves
-- foráneas, luego las que dependen de ellas.

-- Secuencia usada para generar códigos de barras en formato B-00001, B-00002...
CREATE SEQUENCE codigo_barras_seq START 1;

-- Tablas sin dependencias
CREATE TABLE empresa (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL
);

CREATE TABLE categoria (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL
);

-- Depende de empresa
CREATE TABLE colaborador (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    empresa_id INT,
    FOREIGN KEY (empresa_id) REFERENCES empresa(id)
);

-- Depende de empresa y categoria
CREATE TABLE producto (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    empresa_id INT,
    FOREIGN KEY (empresa_id) REFERENCES empresa(id),
    categoria_id INT,
    FOREIGN KEY (categoria_id) REFERENCES categoria(id)
);

-- Depende de producto. Toda variante vendible (incluida la única variante de
-- un producto "simple") vive aquí, con su propio precio y código de barras.
CREATE TABLE subproducto (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    precio DECIMAL NOT NULL,
    codigo_barras VARCHAR(100) NOT NULL,
    producto_id INT,
    FOREIGN KEY (producto_id) REFERENCES producto(id)
);

-- Depende de empresa
CREATE TABLE venta (
    id SERIAL PRIMARY KEY,
    cliente VARCHAR(100) NOT NULL,
    fecha TIMESTAMP NOT NULL,
    empresa_id INT,
    FOREIGN KEY (empresa_id) REFERENCES empresa(id)
);

-- Tabla intermedia: resuelve la relación muchos-a-muchos entre venta y
-- subproducto (una venta puede tener varios subproductos, y un subproducto
-- puede aparecer en muchas ventas distintas).
CREATE TABLE detalle_venta (
    id SERIAL PRIMARY KEY,
    venta_id INT,
    FOREIGN KEY (venta_id) REFERENCES venta(id),
    subproducto_id INT,
    FOREIGN KEY (subproducto_id) REFERENCES subproducto(id),
    cantidad DECIMAL NOT NULL,
    precio_unidad DECIMAL NOT NULL
);
