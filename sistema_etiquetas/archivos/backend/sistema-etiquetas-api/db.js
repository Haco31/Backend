import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
    host: 'db',
    port: 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

export default pool;

