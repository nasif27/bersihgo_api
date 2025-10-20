// boilerplate code
let express = require('express');
let path = require('path');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { DATABASE_URL, SECRET_KEY } = process.env;

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

// admin & user sign up endpoint
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
            res.status(400).json({ message: `This ${options} already exist` });
        }

        const registerResult = await client.query(`INSERT INTO ${options}s (username, email, phone_number, password, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *`, [username, email, phone_number, hashedPassword]);
        
        res.json(registerResult.rows[0]);
        // res.status(200).json({ message: `The ${options} has been registered successfully` });
    } catch (error) {
        console.log('Error:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// admin & user sign in endpoint (PROBLEM AT JWT)
app.post('/:options/signin', async (req, res) => {
    const { options } = req.params;     // admin or user
    const client = await pool.connect();

    try {
        const { username, email, phone_number, password } = req.body;

        // check admin or user existence
        const adminUserExists = await client.query(`SELECT * FROM ${options}s WHERE username = $1 OR email = $2 OR phone_number = $3`, [username, email, phone_number]);

        // if admin or user exists, store in a variable
        const adminUser = adminUserExists.rows[0];

        // if admin or user does not exist, return error
        if (!adminUser) {
            return res.status(400).json({ message: 'Incorrect username or email or phone number' });
        }

        // compare password from client side & DB side (hashed password)
        const passwordIsValid = await bcrypt.compare(password, adminUser.password);

        if (!passwordIsValid) {
            return res.status(400).json({ auth: false, token: null });
        }

        let adminUserCredentials = adminUser.username || adminUser.email;

        // if password is valid, generate JWT & store in avariable
        const token = jwt.sign(
            // {id: adminUser.id, username: adminUser.username, email: adminUser.email, phone_number: adminUser.phone_number},
            {id: adminUser.id, usernameEmail: adminUserCredentials},
            SECRET_KEY,
            { expiresIn: 86400 }    // 86400 ms = 24 hr
        );

        res.status(200).json({ auth: true, token: token });

    } catch (error) {
        console.log('Error:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// forgot password

// change password
app.put('/account/:options/change_password/:id', async (req, res) => {
    const { options, id } = req.params;
    const client = await pool.connect();

    try {
        const { password, newPassword } = req.body;
        const newHashedPassword = await bcrypt.hash(newPassword, 12);
        const adminUserPwd = await client.query(`SELECT password FROM ${options}s WHERE id = $1`, [id]);
        const hashedPassword = adminUserPwd.rows[0].password;
        const passwordIsValid = await bcrypt.compare(password, hashedPassword);

        // check current password validity
        if (!passwordIsValid) {
            return res.status(400).json({ message: 'Invalid password' });
        }

        // update new hashed pwd into DB table
        await client.query(`UPDATE ${options}s SET password = $1 WHERE id = $2`, [newHashedPassword, id]);
        
        res.status(200).json({ message: 'Your password successfully changed' });

    } catch (error) {
        console.log('Error:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// change username/email/phone number

// delete account
app.delete('/account/:options/delete/:id', async (req, res) => {
    const { options, id } = req.params;
    const client = await pool.connect();

    try {
        const { password } = req.body;
        
        const adminUserPwd = await client.query(`SELECT password FROM ${options}s WHERE id = $1`, [id]);

        const hashedPassword = adminUserPwd.rows[0].password;

        const passwordIsValid = await bcrypt.compare(password, hashedPassword);

        if (!passwordIsValid) {
            return res.status(400).json({ message: 'Invalid password' });
        } else {
            await client.query(`DELETE FROM ${options}s WHERE id = $1`, [id]);
            return res.status(200).json({ message: 'Your account successfully deleted' });
        }

    } catch (error) {
        console.log('Error:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// tester
app.get('/account/:options/delete/:id', async (req, res) => {
    const { options, id } = req.params;
    const client = await pool.connect();

    try {
        const { password } = req.body;
        
        const adminUserPwd = await client.query(`SELECT password FROM ${options}s WHERE id = $1`, [id]);

        const hashedPassword = adminUserPwd.rows[0].password;

        res.status(200).json(hashedPassword);

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