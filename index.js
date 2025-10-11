// boilerplate code
let express = require('express');
let path = require('path');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();
const { DATABASE_URL } = process.env;

let app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
        require: true,
    },
});

async function getPostgresVersion() {
    const client = await pool.connect();
    try {
        const response = await client.query('SELECT version()');
        console.log(response.rows[0]);
    } finally {
        client.release();
    }
}

getPostgresVersion();


// endpoint
app.get('/users', async (req, res) => {
    const client = await pool.connect();

    try {
        const users = await client.query('SELECT * FROM users;');
        res.json(users);
    } catch (error) {
        console.log('Error:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});


// boilerplate code
app.get('/', (req, res) => {
    res.status(200).json({ message: 'BersihGo API' });
});

app.listen(PORT, () => {
    console.log(`App is listening on port ${PORT}`);
});