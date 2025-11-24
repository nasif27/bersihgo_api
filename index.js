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

///////////////////////////////////// AUTHENTICATION /////////////////////////////////////

// admin & user sign up endpoint
app.post('/:options/signup', async (req, res) => {
    const { options } = req.params;
    const client = await pool.connect();

    try {
        const { username, email, phoneNumber, password } = req.body;
    
        const hashedPassword = await bcrypt.hash(password, 12);

        // const adminExists = await client.query('SELECT * FROM admins WHERE username = $1 OR email = $2 OR phone_number = $3', [username, email, phone_number]);
    
        const adminUserExists = await client.query(`SELECT * FROM ${options}s WHERE username = $1 OR email = $2 OR phone_number = $3`, [username, email, phoneNumber]);
    
        if (adminUserExists.rows.length > 0) {
            // res.json(adminUserExists.rows[0]);
            res.status(400).json({ message: `This ${options} already exist` });
        }

        const registerResult = await client.query(`INSERT INTO ${options}s (username, email, phone_number, password, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *`, [username, email, phoneNumber, hashedPassword]);
        
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
        const { username, email, phoneNumber, password } = req.body;

        // check admin or user existence
        const adminUserExists = await client.query(`SELECT * FROM ${options}s WHERE username = $1 OR email = $2 OR phone_number = $3`, [username, email, phoneNumber]);

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

        // const adminUserCredentials = usernameEmail === ? adminUser.username : adminUser.email;

        let token = '';

        // if password is valid, generate JWT & store in avariable
        if (username === adminUser.username) {
            const generatedToken = jwt.sign(
                // {id: adminUser.id, username: adminUser.username, email: adminUser.email, phone_number: adminUser.phone_number},
                {id: adminUser.id, username: adminUser.username},
                SECRET_KEY,
                { expiresIn: 86400 }    // 86400 ms = 24 hr
            );

            token = generatedToken;

        } else if (email === adminUser.email) {
            const generatedToken = jwt.sign(
                {id: adminUser.id, email: adminUser.email},
                SECRET_KEY,
                { expiresIn: 86400 }
            );

            token = generatedToken;

        } else if (phoneNumber === adminUser.phone_number) {
            const generatedToken = jwt.sign(
                {id: adminUser.id, phoneNumber: adminUser.phone_number},
                SECRET_KEY,
                { expiresIn: 86400 }
            );

            token = generatedToken;
        }



        // const token = username === adminUser.username ? jwt.sign(
        //     {id: adminUser.id, username: adminUser.username},
        //     SECRET_KEY,
        //     { expiresIn: 86400 }
        // ) : jwt.sign(
        //     {id: adminUser.id, email: adminUser.email},
        //     SECRET_KEY,
        //     { expiresIn: 86400 }
        // )



        // const token = jwt.sign(
        //     {id: adminUser.id, email: adminUser.email},
        //     SECRET_KEY,
        //     { expiresIn: 86400 }
        // );

        res.status(200).json({ auth: true, token: token });

    } catch (error) {
        console.log('Error:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// GET(Read) admin or user specific info by id
app.get('/:persons/:id', async (req, res) => {
    const client = await pool.connect();
    const { persons, id } = req.params;

    try {
        const adminUserExists = await client.query(`SELECT * FROM ${persons}s WHERE id = $1`, [id]);
        const adminUser = adminUserExists.rows[0];

        if (!adminUser) {
            return res.status(404).json({ error: `${persons} not found` });
        }

        res.status(200).json(adminUser);
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
app.put('/account/:options/change/:credentials/:id', async (req, res) => {
    const { options, credentials, id } = req.params;
    const client = await pool.connect();

    try {
        const { username, email, phone_number } = req.body;

        const adminUserExists = await client.query(`SELECT * FROM ${options}s WHERE id = $1`, [id]);

        const adminUser = adminUserExists.rows[0];

        const otherAdminUserExists = await client.query(`SELECT * FROM ${options}s WHERE id <> $1;`, [id]);

        const otherAdminUser = otherAdminUserExists.rows;

        // for (const eachPerson of otherAdminUser) {
        //     if (username === eachPerson.username) {
        //         res.status(400).json({ message: 'This username already exist' });
        //     }
        // }

        switch (credentials) {
            case 'username':
                for (const eachPerson of otherAdminUser) {
                    if (username === eachPerson.username) {
                        res.status(400).json({ message: 'This username already exist' });
                    }
                }

                if (username === adminUser.username) {
                    return res.status(400).json({ message: 'Cannot enter same username' });
                }

                await client.query(`UPDATE ${options}s SET ${credentials} = $1 WHERE id = $2`, [username, id]);
                // res.status(200).json({ message: 'Your username successfully changed' });
                break;
            case 'email':
                for (const eachPerson of otherAdminUser) {
                    if (email === eachPerson.email) {
                        res.status(400).json({ message: 'This email already exist' });
                    }
                }

                if (email === adminUser.email) {
                    return res.status(400).json({ message: 'Cannot enter same email' });
                }

                await client.query(`UPDATE ${options}s SET ${credentials} = $1 WHERE id = $2`, [email, id]);
                // res.status(200).json({ message: 'Your email successfully changed' });
                break;
            case 'phone_number':
                for (const eachPerson of otherAdminUser) {
                    if (phone_number === eachPerson.phone_number) {
                        res.status(400).json({ message: 'This phone number already exist' });
                    }
                }

                if (phone_number === adminUser.phone_number) {
                    return res.status(400).json({ message: 'Cannot enter same phone number' });
                }

                await client.query(`UPDATE ${options}s SET ${credentials} = $1 WHERE id = $2`, [phone_number, id]);
                // res.status(200).json({ message: 'Your phone number successfully changed' });
                break;
            default:
                res.status(400).json({ message: 'Invalid credential' });
                break;
        }

        res.status(200).json({ message: `Your ${credentials} successfully changed` });
    } catch (error) {
        console.log('Error:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

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
app.get('/testing/account/:options/:id', async (req, res) => {
    const { options, id } = req.params;
    const client = await pool.connect();

    try {
        const { password, username, email, phone_number } = req.body;
        
        // const adminUserPwd = await client.query(`SELECT password FROM ${options}s WHERE id = $1`, [id]);
        // const hashedPassword = adminUserPwd.rows[0].password;
        // res.status(200).json(hashedPassword);

        const otherAdminUserExists = await client.query(`SELECT * FROM ${options}s WHERE id <> $1;`, [id]);
        const otherAdminUser = otherAdminUserExists.rows;
        for (const eachPerson of otherAdminUser) {
            if (username === eachPerson.username) {
                res.status(200).json(eachPerson);
            }
        }
        
        // res.status(200).json(otherAdminUser);

    } catch (error) {
        console.log('Error:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// REQUEST ENDPOINT
// GET(Read) all users endpoint
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

/////////////////////////////////////// SERVICE ///////////////////////////////////////

// POST(Create) service by admin endpoint
app.post('/service/admin/:id', async (req, res) => {
    const client = await pool.connect();
    const { id } = req.params;
    const { title, description } = req.body;

    try {
        // check admin existence
        const adminExists = await client.query(`SELECT * FROM admins WHERE id = $1`, [id]);

        if (adminExists.rows.length > 0) {
            const post = await client.query(`INSERT INTO services (title, description, created_at, admin_id) VALUES ($1, $2, NOW(), $3) RETURNING *`, [title, description, id]);
            // res.status(200).json({ message: 'Service successfully created' });
            res.status(200).json(post.rows[0]);
        } else {
            return res.status(404).json({ message: 'Admin not found' });
        }
    } catch (error) {
        console.log("Error:", error.message);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// GET(Read) all services created (admin or user)
app.get('/service/:persons/:id', async (req, res) => {
    const client = await pool.connect();
    const { persons, id } = req.params;

    try {
        // check admin/user existence
        const adminUserExists = await client.query(`SELECT * FROM ${persons}s WHERE id = $1`, [id]);
        const adminUser = adminUserExists.rows[0];
        
        if (!adminUser) {
            return res.status(404).json({ message: `${persons} not found`});
        }

        if (persons === 'admin' || persons === 'user') {
            const services = await client.query(`SELECT * FROM services`);
            res.status(200).json(services.rows);
        }
    } catch (error) {
        console.log("Error:", error.message);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// GET(Read) specific service by id (admin or user)
app.get('/service/:id', async (req, res) => {
    const client = await pool.connect();
    const { id } = req.params;

    try {
        const service = await client.query(`SELECT * FROM services WHERE id = $1`, [id]);

        if (service.rows.length > 0) {
            return res.status(200).json(service.rows[0]);
        } else {
            return res.status(404).json({ error: 'Service not found' });
        }
    } catch (error) {
        console.log('Error:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// PUT(Update) specific service (admin)
app.put('/admin/:admin_id/service/:id', async (req, res) => {
    const client = await pool.connect();
    const { admin_id, id } = req.params;

    try {
        const { title, description } = req.body;
        
        // Check admin existence
        const adminUser = await client.query(`SELECT * FROM admins WHERE id = $1`, [admin_id]);
        
        // Check service existence
        const service = await client.query(`SELECT * FROM services WHERE id = $1`, [id]);
        
        // If admin & service exist, allow admin to update/change
        if (adminUser.rows.length > 0 && service.rows.length > 0) {
            const updatedService = await client.query(`UPDATE services SET title = $1, description = $2, updated_at = NOW() WHERE id = $3 RETURNING *`, [title, description, id]);
            res.status(200).json(updatedService.rows[0]);
            // res.status(200).json({ message: 'Service successfully updated' });
        } else {
            return res.status(400).json({ error: 'Admin or service not found' });
        }
    } catch (error) {
        console.log('Error:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// DELETE specific service by id (admin)
app.delete('/admin/:admin_id/service/:id', async (req, res) => {
    const client = await pool.connect();
    const { admin_id, id } = req.params;

    try {
        const adminExists = await client.query(`SELECT * FROM admins WHERE id = $1`, [admin_id]);
        const admin = adminExists.rows[0];

        if (!admin) {
            return res.status(404).json({ error: 'Admin not found' });
        }

        const service = await client.query(`SELECT * FROM services WHERE id = $1`, [id]);
        
        if (service.rows.length > 0) {
            await client.query(`DELETE FROM services WHERE id = $1`, [id]);
            res.status(200).json({ message: 'Service successfully deleted' });
        } else {
            res.status(404).json({ error: 'Service not found' });
        }
    } catch (error) {
        console.log('Error:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

/////////////////////////////////////// BOOKING ///////////////////////////////////////

// POST(Create) booking by user
app.post('/booking/user/:id', async (req, res) => {
    const client = await pool.connect();
    const { id } = req.params;

    try {
        const { service_title, location, booking_date, booking_time, notes, status, created_at, user_id, service_id } = req.body;
        
        // check user's existence
        const userExists = await client.query(`SELECT * FROM users WHERE id = $1`, [id]);
        const user = userExists.rows[0];

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // check same booking (date & time) existence
        // const bookingsExist = await client.query(`SELECT * FROM bookings WHERE user_id = $1`, [id]);
        // const bookings = bookingsExist.rows[0];
        const booking = await client.query(`SELECT * FROM bookings WHERE user_id = $1 AND service_id = $2 AND location = $3 AND booking_date = $4 AND booking_time = $5`, [id, service_id, location, booking_date, booking_time]);

        if (booking.rows.length > 0) {
            return res.status(400).json({ error: 'Booking already exists' });
        } else {
            const serviceTitleExists = await client.query(`SELECT title FROM services WHERE id = $1`, [service_id]);
            const serviceTitle = serviceTitleExists.rows[0].title;
    
            await client.query(`INSERT INTO bookings (service_title, location, booking_date, booking_time, notes, status, created_at, user_id, service_id) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8)`, [serviceTitle, location, booking_date, booking_time, notes, status, id, service_id]);
            res.status(200).json({ message: 'Your booking successfully created' });
        }

    } catch (error) {
        console.log('Error:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// GET(Read) all bookings from all users (admin)
app.get('/bookings/admin/:id', async (req, res) => {
    const client = await pool.connect();
    const { id } = req.params;
    const { booking_id, user_id, service_id, booking_date } = req.body;

    try {
        // check admin's existence
        const adminExists = await client.query(`SELECT * FROM admins WHERE id = $1`, [id]);
        const admin = adminExists.rows[0];

        if (!admin) {
            return res.status(404).json({ error: 'Admin not found' });
        }

        if (!booking_id && !user_id && !service_id && !booking_date) {
            const bookings = await client.query(`SELECT * FROM bookings`);
            res.status(200).json(bookings.rows);
        } else if (booking_id && user_id && service_id && booking_date) {
            return res.status(400).json({ error: 'Access denied' });
        } else if (user_id || service_id || booking_date) {
            const bookings = await client.query(`SELECT * FROM bookings WHERE user_id = $1 OR service_id = $2 OR booking_date = $3`, [user_id, service_id, booking_date]);
            if (bookings.rows.length > 0) {
                res.status(200).json(bookings.rows);
            } else {
                return res.status(404).json({ error: 'Bookings not found' });
            }
        } else if (booking_id) {
            const booking = await client.query(`SELECT * FROM bookings WHERE id = $1`, [booking_id]);
            if (booking.rows.length > 0) {
                res.status(200).json(booking.rows[0]);
            } else {
                return res.status(404).json({ error: 'Booking not found' });
            }
        }
        
    } catch (error) {
        console.log('Error:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// // GET(Read) all bookings from all users
// app.get('/bookings/admin/:id', async (req, res) => {
//     const client = await pool.connect();
//     const { id } = req.params;

//     try {
//         // check admin's existence
//         const adminExists = await client.query(`SELECT * FROM admins WHERE id = $1`, [id]);
//         const admin = adminExists.rows[0];

//         if (!admin) {
//             return res.status(404).json({ error: 'Admin not found' });
//         }
        
//         const bookings = await client.query(`SELECT * FROM bookings`);
//         res.status(200).json(bookings.rows);
//     } catch (error) {
//         console.log('Error:', error.message);
//         res.status(500).json({ error: error.message });
//     } finally {
//         client.release();
//     }
// });


app.get('/bookings/user/:id', async (req, res) => {
    const client = await pool.connect();
    const { id } = req.params;
    const { booking_id, booking_date } = req.body;

    try {
        // check admin's existence
        const userExists = await client.query(`SELECT * FROM users WHERE id = $1`, [id]);
        const user = userExists.rows[0];

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!booking_id && !booking_date) {
            const bookings = await client.query(`SELECT * FROM bookings WHERE user_id = $1`, [id]);
            res.status(200).json(bookings.rows);
        } else if (booking_id && booking_date) {
            return res.status(400).json({ error: 'Access denied' });
        } else if (booking_date) {
            const bookings = await client.query(`SELECT * FROM bookings WHERE booking_date = $1 AND user_id = $2`, [booking_date, id]);
            if (bookings.rows.length > 0) {
                res.status(200).json(bookings.rows);
            } else {
                return res.status(404).json({ error: 'Bookings not found' });
            }
        } else if (booking_id) {
            const booking = await client.query(`SELECT * FROM bookings WHERE id = $1 AND user_id = $2`, [booking_id, id]);
            if (booking.rows.length > 0) {
                res.status(200).json(booking.rows[0]);
            } else {
                return res.status(404).json({ error: 'Booking not found' });
            }
        }
        
    } catch (error) {
        console.log('Error:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});


// // GET(Read) all bookings from specific user (user)
// app.get('/bookings/user/:id', async (req, res) => {
//     const client = await pool.connect();
//     const { id } = req.params;

//     try {
//         // check user's existence
//         const userExists = await client.query(`SELECT * FROM users WHERE id = $1`, [id]);
//         const user = userExists.rows[0];

//         if (!user) {
//             return res.status(404).json({ error: 'User not found' });
//         }

//         const bookings = await client.query(`SELECT * FROM bookings WHERE user_id = `, [id]);
//         res.status(200).json(bookings.rows);
//     } catch (error) {
//         console.log('Error:', error.message);
//         res.status(500).json({ error: error.message });
//     } finally {
//         client.release();
//     }
// });


// PUT(Update) booking by user
app.put('/:person/:person_id/booking/:id', async (req, res) => {
    const client = await pool.connect();
    const { person, person_id, id } = req.params;
    const { booking_status, location, booking_date, booking_time, notes } = req.body;

    try {
        // check admin or user existence
        const adminUserExists = await client.query(`SELECT * FROM ${person}s WHERE id = $1`, [person_id]);
        const adminUser = adminUserExists.rows[0];

        if (!adminUser) {
            return res.status(404).json({ error: `${person} not found` });
        }
        
        // check booking existence (admin)
        const bookingExists = await client.query(`SELECT * FROM bookings WHERE id = $1`, [id]);
        const booking = bookingExists.rows[0];
        
        // check booking existence (user)
        const userbookingExists = await client.query(`SELECT * FROM bookings WHERE id = $1 AND user_id = $2`, [id, person_id]);
        const userBooking = userbookingExists.rows[0];

        switch (person) {
            case 'admin':
                if (!booking) {
                    return res.status(404).json({ error: 'Booking not found' });
                }
                await client.query(`UPDATE bookings SET status = $1, updated_at = NOW() WHERE id = $2`, [booking_status, id]);
                res.status(200).json({ message: 'Booking successfully updated' });
                break;
            case 'user':
                if (!userBooking) {
                    return res.status(404).json({ error: 'Your booking not found' });
                }

                await client.query(`UPDATE bookings SET location = $1, booking_date = $2, booking_time = $3, notes = $4, updated_at = NOW() WHERE id = $5 AND user_id = $6`, [location, booking_date, booking_time, notes, id, person_id]);
                res.status(200).json({ message: 'Your booking successfully updated' });

                break;
            default:
                res.status(400).json({ error: 'Access denied' });
                // break;
        }
        
    } catch (error) {
        console.log('Error:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// DELETE specific booking (admin & user)
app.delete('/:person/:person_id/booking/:id', async (req, res) => {
    const client = await pool.connect();
    const { person, person_id, id } = req.params;

    try {
        // check admin or user existence
        const adminUserExists = await client.query(`SELECT * FROM ${person}s WHERE id = $1`, [person_id]);
        const adminUser = adminUserExists.rows[0];

        if (!adminUser) {
            return res.status(404).json({ error: `${person} not found` });
        }

        // check booking's existence
        switch (person) {
            case 'admin':
                const bookingExists = await client.query(`SELECT * FROM bookings WHERE id = $1`, [id]);
                const booking = bookingExists.rows[0];
                if (!booking) {
                    return res.status(404).json({ error: 'Booking not found' });
                }
                await client.query(`DELETE FROM bookings WHERE id = $1`, [id]);
                res.status(200).json({ message: 'Booking successfully cancelled' });
                break;
            case 'user':
                const userBookingExists = await client.query(`SELECT * FROM bookings WHERE id = $1 AND user_id = $2`, [id, person_id]);
                const userBooking = userBookingExists.rows[0];
                if (!userBooking) {
                    return res.status(404).json({ error: 'Your booking not found' });
                }
                await client.query(`DELETE FROM bookings WHERE id = $1 AND user_id = $2`, [id, person_id]);
                res.status(200).json({ message: 'Your booking successfully cancelled' });
                break;
            default:
                res.status(400).json({ error: 'Access denied' });
        }
    } catch (error) {
        console.log('Error:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// testing booking
app.get('/testing/booking/user/:id', async (req, res) => {
    const client = await pool.connect();
    const { id } = req.params;

    try {
        const { service_title, location, booking_date, booking_time, notes, status, created_at, user_id, service_id } = req.body;
        
        // check same booking (date & time) existence
        const bookingExists = await client.query(`SELECT * FROM bookings WHERE user_id = $1 AND service_id = $2 AND location = $3 AND booking_date = TO_DATE($4, 'DD/MM/YYYY') AND booking_time = $5`, [id, service_id, location, booking_date, booking_time]);
        // const bookingExists = await client.query(`SELECT * FROM bookings WHERE user_id = $1`, [id])
        const booking = bookingExists.rows[0];
        res.status(200).json(booking);

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