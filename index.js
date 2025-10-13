// boilerplate code
let express = require('express');
let path = require('path');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
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

// AUTH ENDPOINT
// admin or user option
// let options = '';

// app.get('/options', async (req, res) => {
//     const client
// })

// user sign up endpoint
app.post('/:options/signup', async (req, res) => {
    const { options } = req.params;
    const client = await pool.connect();

    try {
        const { username, email, phone_number, password } = req.body;
    
        const hashedPassword = await bcrypt.hash(password, 12);

        // const adminExists = await client.query('SELECT * FROM admins WHERE username = $1 OR email = $2 OR phone_number = $3', [username, email, phone_number]);
    
        const adminUserExists = await client.query(`SELECT * FROM ${options}s WHERE username = $1 OR email = $2 OR phone_number = $3`, [username, email, phone_number]);
    
        if (adminUserExists.rows.length > 0) {
            // res.json(adminUserExists.rows[0]);
            res.status(400).json({ message: `This ${options} already exist` }, adminUserExists.rows[0]);
        }

        await client.query(`INSERT INTO ${options}s (username, email, phone_number, password, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *`, [username, email, phone_number, hashedPassword]);

        res.status(200).json({ message: `The ${options} has been registered successfully` });
    } catch (error) {
        console.log('Error:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});



// REQUEST ENDPOINT
// endpoint
app.get('/users', async (req, res) => {
    const client = await pool.connect();

    try {
        const users = await client.query('SELECT * FROM users;');
        res.json(users.rows);
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