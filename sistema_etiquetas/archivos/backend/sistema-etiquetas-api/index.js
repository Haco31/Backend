import express from 'express';
import pool from './db.js';
import bwipjs from 'bwip-js';

const app = express();
const PORT = 3000;
app.use(express.json());

app.get('/', (req, res) => {
    res.send('API de etiquetas funcionando');
});


//--------------------ZONA DEL PRODUCTO-----------------------


app.get('/productos', async (req, res) => {
    const resultado = await pool.query('SELECT * FROM producto');
    const productos = resultado.rows;
    res.json(productos);
});

app.get('/productos/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const resultado = await pool.query(
            'SELECT * FROM producto WHERE id = $1',
            [id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        res.json(resultado.rows[0]);
    } catch (error) {
        console.error('Error al buscar prodcuto', error);
        res.status(500).json({ error: 'Error al buscar el producto' });
    }
});

app.post('/productos', async (req,res) => {
    const { nombreGeneral, nombreSub, precio, empresa_id, categoria_id } = req.body;

    if (!nombreGeneral || typeof nombreGeneral !== 'string' || nombreGeneral.trim() === '' || !nombreSub || typeof nombreSub !== 'string' || nombreSub.trim() === '') {
        return res.status(400).json({ error: 'El nombre es obligatorio y debe ser un texto válido'});
    }

    if (!precio || typeof precio !== 'number' || precio <0) {
        return res.status(400).json({ error: 'El precio debe ser mayor o igual a 0'})
    }

    if (!empresa_id || typeof empresa_id !== 'number' || empresa_id <=0 || !categoria_id || typeof categoria_id !== 'number' || categoria_id <=0) {
        return res.status(400).json({ error: 'El campo ingresado debe ser mayor que 0'})
    }

    try {
        await pool.query('BEGIN');

        const resultadoProducto = await pool.query(
            'INSERT INTO producto (nombre, empresa_id, categoria_id) VALUES ($1, $2, $3) RETURNING id',
            [nombreGeneral, empresa_id, categoria_id]
        );
        const productoId = resultadoProducto.rows[0].id;

        const resultadoSubproducto = await pool.query(
            `INSERT INTO subproducto (nombre, precio, codigo_barras, producto_id)
            VALUES ($1, $2, 'B-' || LPAD(nextval('codigo_barras_seq')::text,5, '0'), $3)
            RETURNING id, codigo_barras`,
            [nombreSub, precio, productoId]
        );

        await pool.query('COMMIT');

        res.status(201).json({
            producto_id: productoId,
            subproducto_id: resultadoSubproducto.rows[0].id,
            codigo_barras: resultadoSubproducto.rows[0].codigo_barras,
        });
    }   catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error al crear producto:', error);
        res.status(500).json({ error: 'No se pudo crear el producto' });
    }
});

app.put('/productos/:id', async (req,res) => {
    const { id } = req.params;
    const { nombre, empresa_id, categoria_id } = req.body;

    if (!nombre || typeof nombre !== 'string' || nombre.trim() === '') {
        return res.status(400).json({ error: 'El nombre es obligatorio y debe ser un texto válido'});
    }

    if (!empresa_id || typeof empresa_id !== 'number' || empresa_id <=0 || !categoria_id || typeof categoria_id !== 'number' || categoria_id <=0) {
        return res.status(400).json({ error: 'El campo ingresado debe ser mayor que 0'})
    }

    try {
        const resultado = await pool.query(
            'UPDATE producto SET nombre = $1, empresa_id = $2, categoria_id = $3 WHERE id = $4 RETURNING *',
            [nombre, empresa_id, categoria_id, id]
        );

        if (resultado.rowCount === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        res.json(resultado.rows[0]);
    } catch (error) {
        console.error('Error al actualizar prodcuto', error);
        res.status(500).json({ error: 'Error al buscar el producto' });
    }

});

app.delete('/productos/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const resultado = await pool.query(
            'DELETE FROM producto WHERE id = $1  RETURNING id',
            [id]
        );

        if (resultado.rowCount === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        res.json({ mensaje: 'Producto eliminado correctamente '});
    } catch (error) {
        if (error.code === '23503') {
            return res.status(409).json({
                error: 'No se puede eliminar: este producto tiene subproductos asociados. Elimínalos primero.',
            });
        }
        console.error('Error al eliminar producto: ', error);
        res.status(500).json({ error: 'Error al emininar el producto' });
    }
});

//--------------- ZONA DEL SUBPRODUCTO -----------------------

app.get('/subproductos', async (req, res) => {
    const resultado = await pool.query('SELECT * FROM subproducto');
    const subproductos = resultado.rows;
    res.json(subproductos);
});

app.get('/subproductos/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const resultado = await pool.query(
            'SELECT * FROM subproducto WHERE id = $1',
            [id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'Subproducto no encontrado' });
        }

        res.json(resultado.rows[0]);
    } catch (error) {
        console.error('Error al buscar el subprodcuto', error);
        res.status(500).json({ error: 'Error al buscar el subproducto' });
    }
});

app.get('/subproductos/:id/completo', async (req, res) => {
    const { id } = req.params;

    try {
        const resultado = await pool.query(
            'SELECT subproducto.nombre AS nombre_subproducto, subproducto.precio, subproducto.codigo_barras, empresa.nombre AS nombre_empresa FROM subproducto JOIN producto ON subproducto.producto_id = producto.id JOIN empresa ON producto.empresa_id = empresa.id WHERE subproducto.id = $1',
            [id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'Subproducto no encontrado' });
        }

        res.json(resultado.rows[0]);
    } catch (error) {
        console.error('Error al buscar el subprodcuto', error);
        res.status(500).json({ error: 'Error al buscar el subproducto' });
    }
});

app.get('/subproductos/:id/codigo-barras', async (req, res) => {
    const { id } = req.params;

    try {
        const resultado = await pool.query(
            'SELECT codigo_barras FROM subproducto WHERE id = $1',
            [id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'Subproducto no encontrado '});
        }

        const codigo = resultado.rows[0].codigo_barras;

        const png = await bwipjs.toBuffer({
            bcid:  'code128',
            text: codigo,
            scale: 3,
            height: 10,
            includetext: true,
            textalign: 'center',
            padding: 3,
        });

        res.set('Content-Type', 'image/png');
        res.send(png);
    } catch (error) {
        console.error('Error al generar código de barras', error);
        res.sttus(500).json({ error: 'No se pudo generar el código de barras' });
    }
});

app.post('/subproductos', async (req,res) => {
    const { nombre, precio, codigo_barras, producto_id } = req.body;

    if (!nombre|| typeof nombre !== 'string' || nombre.trim() === '') {
        return res.status(400).json({ error: 'El nombre es obligatorio y debe ser un texto válido'});
    }

    if (!precio || typeof precio !== 'number' || precio <0) {
        return res.status(400).json({ error: 'El precio debe ser mayor o igual a 0'})
    }

    if (!producto_id || typeof producto_id !== 'number' || producto_id <=0) {
        return res.status(400).json({ error: 'El campo ingresado debe ser mayor que 0'})
    }

    try {
        const resultadoSubproducto = await pool.query(
            `INSERT INTO subproducto (nombre, precio, codigo_barras, producto_id)
            VALUES ($1, $2, 'B-' || LPAD(nextval('codigo_barras_seq')::text,5, '0'), $3)
            RETURNING id, codigo_barras`,
            [nombre, precio, producto_id]
        );

        res.status(201).json({
            subproducto_id: resultadoSubproducto.rows[0].id,
            codigo_barras: resultadoSubproducto.rows[0].codigo_barras,
        });
    }   catch (error) {
        console.error('Error al crear producto:', error);
        res.status(500).json({ error: 'No se pudo crear el subroducto' });
    }
});

app.put('/subproductos/:id', async (req,res) => {
    const { id } = req.params;
    const { nombre, precio, producto_id } = req.body;

    if (!nombre|| typeof nombre !== 'string' || nombre.trim() === '') {
        return res.status(400).json({ error: 'El nombre es obligatorio y debe ser un texto válido'});
    }

    if (!precio || typeof precio !== 'number' || precio <0) {
        return res.status(400).json({ error: 'El precio debe ser mayor o igual a 0'})
    }

    if (!producto_id || typeof producto_id !== 'number' || producto_id <=0) {
        return res.status(400).json({ error: 'El campo ingresado debe ser mayor que 0'})
    }

    try {
        const resultado = await pool.query(
            `UPDATE subproducto SET nombre = $1, precio = $2 WHERE id = $3 RETURNING *`,
            [nombre, precio, id]
        );

        if (resultado.rowCount === 0) {
            return res.status(404).json({ error: 'Subproducto no encontrado' });
        }

        res.json(resultado.rows[0]);
    } catch (error) {
        console.error('Error al actualizar subprodcuto', error);
        res.status(500).json({ error: 'Error al buscar el subproducto' });
    }

});

app.delete('/subproductos/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const resultado = await pool.query(
            'DELETE FROM subproducto WHERE id = $1  RETURNING id',
            [id]
        );

        if (resultado.rowCount === 0) {
            return res.status(404).json({ error: 'Subroducto no encontrado' });
        }

        res.json({ mensaje: 'Subroducto eliminado correctamente '});
    } catch (error) {
        if (error.code === '23503') {
            return res.status(409).json({
                error: 'No se puede eliminar: este subproducto tiene ventas asociadas. Elimínalos primero.',
            });
        }
        console.error('Error al eliminar el subroducto: ', error);
        res.status(500).json({ error: 'Error al emininar el subproducto' });
    }
});

//-------------------- ZONA DE EMPRESA ----------------------

app.get('/empresa', async (req, res) => {
    const resultado = await pool.query('SELECT * FROM empresa');
    const empresa = resultado.rows;
    res.json(empresa);
});

app.get('/empresa/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const resultado = await pool.query(
            'SELECT * FROM empresa WHERE id = $1',
            [id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'Empresa no encontrada' });
        }

        res.json(resultado.rows[0]);
    } catch (error) {
        console.error('Error al buscar la empresa', error);
        res.status(500).json({ error: 'Error al buscar la empresa' });
    }
});

app.post('/empresa', async (req,res) => {
    const { nombre } = req.body;

    if (!nombre|| typeof nombre !== 'string' || nombre.trim() === '') {
        return res.status(400).json({ error: 'El nombre es obligatorio y debe ser un texto válido'});
    }

    try {
        const resultadoEmpresa = await pool.query(
            `INSERT INTO empresa (nombre)
            VALUES ($1)
            RETURNING id`,
            [nombre]
        );

        res.status(201).json({
            empresa_id: resultadoEmpresa.rows[0].id,
        });
    }   catch (error) {
        console.error('Error al crear la empresa:', error);
        res.status(500).json({ error: 'No se pudo crear la empresa' });
    }
});

app.put('/empresa/:id', async (req,res) => {
    const { id } = req.params;
    const { nombre } = req.body;

    if (!nombre|| typeof nombre !== 'string' || nombre.trim() === '') {
        return res.status(400).json({ error: 'El nombre es obligatorio y debe ser un texto válido'});
    }

    try {
        const resultado = await pool.query(
            'UPDATE empresa SET nombre = $1 WHERE id = $2 RETURNING *',
            [nombre, id]
        );

        if (resultado.rowCount === 0) {
            return res.status(404).json({ error: 'Empresa no encontrada' });
        }

        res.json(resultado.rows[0]);
    } catch (error) {
        console.error('Error al actualizar la empresa', error);
        res.status(500).json({ error: 'Error al buscar la empresa' });
    }

});

app.delete('/empresa/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const resultado = await pool.query(
            'DELETE FROM empresa WHERE id = $1  RETURNING id',
            [id]
        );

        if (resultado.rowCount === 0) {
            return res.status(404).json({ error: 'Empresa no encontrada' });
        }

        res.json({ mensaje: 'Empresa eliminada correctamente.'});
    } catch (error) {
        if (error.code === '23503') {
            return res.status(409).json({
                error: 'No se puede eliminar: esta empresa tiene información importante, revisar bien antes de eliminar.',
            });
        }
        console.error('Error al eliminar la empresa: ', error);
        res.status(500).json({ error: 'Error al emininar la empresa' });
    }
});

//------------------ ZONA CATEGORÍA -------------------------


app.get('/categoria', async (req, res) => {
    const resultado = await pool.query('SELECT * FROM categoria');
    const categoria = resultado.rows;
    res.json(categoria);
});

app.get('/categoria/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const resultado = await pool.query(
            'SELECT * FROM categoria WHERE id = $1',
            [id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'Categoría no encontrada' });
        }

        res.json(resultado.rows[0]);
    } catch (error) {
        console.error('Error al buscar la categoría', error);
        res.status(500).json({ error: 'Error al buscar la categoría' });
    }
});

app.post('/categoria', async (req,res) => {
    const { nombre } = req.body;

    if (!nombre|| typeof nombre !== 'string' || nombre.trim() === '') {
        return res.status(400).json({ error: 'El nombre es obligatorio y debe ser un texto válido'});
    }

    try {
        const resultadoCategoria = await pool.query(
            `INSERT INTO categoria (nombre)
            VALUES ($1)
            RETURNING id`,
            [nombre]
        );

        res.status(201).json({
            categoria_id: resultadoCategoria.rows[0].id,
        });
    }   catch (error) {
        console.error('Error al crear la categoría:', error);
        res.status(500).json({ error: 'No se pudo crear la categoría' });
    }
});

app.put('/categoria/:id', async (req,res) => {
    const { id } = req.params;
    const { nombre } = req.body;

    if (!nombre|| typeof nombre !== 'string' || nombre.trim() === '') {
        return res.status(400).json({ error: 'El nombre es obligatorio y debe ser un texto válido'});
    }

    try {
        const resultado = await pool.query(
            'UPDATE categoria SET nombre = $1 WHERE id = $2 RETURNING *',
            [nombre, id]
        );

        if (resultado.rowCount === 0) {
            return res.status(404).json({ error: 'Categoría no encontrada' });
        }

        res.json(resultado.rows[0]);
    } catch (error) {
        console.error('Error al actualizar la categoría', error);
        res.status(500).json({ error: 'Error al buscar la categoría' });
    }

});

app.delete('/categoria/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const resultado = await pool.query(
            'DELETE FROM categoria WHERE id = $1  RETURNING id',
            [id]
        );

        if (resultado.rowCount === 0) {
            return res.status(404).json({ error: 'Categoría no encontrada' });
        }

        res.json({ mensaje: 'Categoría eliminada correctamente '});
    } catch (error) {
        if (error.code === '23503') {
            return res.status(409).json({
                error: 'No se puede eliminar: esta categoría tiene ventas productos registrados. Elimínalos primero.',
            });
        }
        console.error('Error al eliminar la categoría: ', error);
        res.status(500).json({ error: 'Error al emininar la categoría' });
    }
});

//------------------- ZONA COLABORADOR -------------------------

app.get('/colaborador', async (req, res) => {
    const resultado = await pool.query('SELECT * FROM colaborador');
    const colaborador = resultado.rows;
    res.json(colaborador);
});

app.get('/colaborador/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const resultado = await pool.query(
            'SELECT * FROM colaborador WHERE id = $1',
            [id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'Colaborador no encontrado' });
        }

        res.json(resultado.rows[0]);
    } catch (error) {
        console.error('Error al buscar colaborador', error);
        res.status(500).json({ error: 'Error al buscar colaborador' });
    }
});

app.post('/colaborador', async (req,res) => {
    const { nombre, empresa_id } = req.body;

    if (!nombre|| typeof nombre !== 'string' || nombre.trim() === '') {
        return res.status(400).json({ error: 'El nombre es obligatorio y debe ser un texto válido'});
    }

    if (!empresa_id || typeof empresa_id !== 'number' || empresa_id <=0) {
        return res.status(400).json({ error: 'El campo ingresado debe ser mayor que 0'})
    }

    try {
        const resultadoColaborador = await pool.query(
            'INSERT INTO colaborador (nombre, empresa_id) VALUES ($1, $2) RETURNING id',
            [nombre, empresa_id]
        );

        res.status(201).json({
            colaborador_id: resultadoColaborador.rows[0].id,
        });
    }   catch (error) {
        console.error('Error al crear colaborador', error);
        res.status(500).json({ error: 'No se pudo crear colaborador' });
    }
});

app.put('/colaborador/:id', async (req,res) => {
    const { id } = req.params;
    const { nombre, empresa_id } = req.body;

    if (!nombre|| typeof nombre !== 'string' || nombre.trim() === '') {
        return res.status(400).json({ error: 'El nombre es obligatorio y debe ser un texto válido'});
    }

    if (!empresa_id || typeof empresa_id !== 'number' || empresa_id <=0) {
        return res.status(400).json({ error: 'El campo ingresado debe ser mayor que 0'})
    }

    try {
        const resultado = await pool.query(
            `UPDATE colaborador SET nombre = $1, empresa_id = $2 WHERE id = $3 RETURNING *`,
            [nombre, empresa_id, id]
        );

        if (resultado.rowCount === 0) {
            return res.status(404).json({ error: 'Colaborador no encontrado' });
        }

        res.json(resultado.rows[0]);
    } catch (error) {
        console.error('Error al actualizar colabaorador', error);
        res.status(500).json({ error: 'Error al buscar colaborador' });
    }

});

app.delete('/colaborador/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const resultado = await pool.query(
            'DELETE FROM colaborador WHERE id = $1  RETURNING id',
            [id]
        );

        if (resultado.rowCount === 0) {
            return res.status(404).json({ error: 'Colaborador no encontrado' });
        }

        res.json({ mensaje: 'Colaborador eliminado correctamente '});
    } catch (error) {
        if (error.code === '23503') {
            return res.status(409).json({
                error: 'No se puede eliminar: Colaborador tiene registros realizados, revisas antes.',
            });
        }
        console.error('Error al eliminar colaborador: ', error);
        res.status(500).json({ error: 'Error al emininar colaborador' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});



