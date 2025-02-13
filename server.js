const express = require('express');
const mysql = require('mysql2');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Database connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'appointment_system'
});

// Create necessary tables if they don't exist
db.query(`
  CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

db.query(`
  CREATE TABLE IF NOT EXISTS appointments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    date DATE NOT NULL,
    time_slot TIME NOT NULL,
    status ENUM('booked', 'cancelled') DEFAULT 'booked',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE KEY unique_slot (date, time_slot)
  )
`);
// Validation middleware
const validateUserInput = (req, res, next) => {
    const { email, password, name } = req.body;
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    // Password validation
    if (password.length < 8) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters long' 
      });
    }
    
    // Password complexity check
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ 
        error: 'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character' 
      });
    }
    
    // Name validation
    if (name.length < 2 || name.length > 50) {
      return res.status(400).json({ 
        error: 'Name must be between 2 and 50 characters' 
      });
    }
    
    next();
  };
  
  // Appointment validation middleware
  const validateAppointment = (req, res, next) => {
    const { date, time_slot } = req.body;
    
    // Date validation
    const appointmentDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (appointmentDate < today) {
      return res.status(400).json({ 
        error: 'Cannot book appointments in the past' 
      });
    }
    
    // Time slot validation
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
    if (!timeRegex.test(time_slot)) {
      return res.status(400).json({ error: 'Invalid time slot format' });
    }
    
    // Business hours validation (9 AM to 5 PM)
    const hour = parseInt(time_slot.split(':')[0]);
    if (hour < 9 || hour > 17) {
      return res.status(400).json({ 
        error: 'Appointments only available between 9 AM and 5 PM' 
      });
    }
    
    next();
  };
// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret', (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// User Registration
app.post('/register', validateUserInput, async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    // Validate input
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    db.query(
      'INSERT INTO users (email, password, name) VALUES (?, ?, ?)',
      [email, hashedPassword, name],
      (err, results) => {
        if (err) {
          if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Email already exists' });
          }
          return res.status(500).json({ error: 'Error creating user' });
        }
        res.status(201).json({ message: 'User registered successfully' });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// User Login
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  db.query(
    'SELECT * FROM users WHERE email = ?',
    [email],
    async (err, results) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      
      if (results.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = results[0];
      const validPassword = await bcrypt.compare(password, user.password);

      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET || 'your_jwt_secret',
        { expiresIn: '24h' }
      );

      res.json({ token });
    }
  );
});

// Get Available Time Slots
app.get('/slots', authenticateToken, (req, res) => {
  const { date } = req.query;
  
  if (!date) {
    return res.status(400).json({ error: 'Date is required' });
  }

  // Get booked slots for the date
  db.query(
    'SELECT time_slot FROM appointments WHERE date = ? AND status = "booked"',
    [date],
    (err, results) => {
      if (err) return res.status(500).json({ error: 'Server error' });

      // Generate all possible time slots (9 AM to 5 PM, hourly)
      const allSlots = [];
      for (let hour = 9; hour <= 17; hour++) {
        allSlots.push(`${hour.toString().padStart(2, '0')}:00:00`);
      }

      // Filter out booked slots
      const bookedSlots = results.map(row => row.time_slot.toString());
      const availableSlots = allSlots.filter(slot => !bookedSlots.includes(slot));

      res.json({ availableSlots });
    }
  );
});

// Book Appointment
app.post('/appointments', authenticateToken, validateAppointment, (req, res)  => {
  const { date, time_slot } = req.body;
  const user_id = req.user.id;

  if (!date || !time_slot) {
    return res.status(400).json({ error: 'Date and time slot are required' });
  }

  db.query(
    'INSERT INTO appointments (user_id, date, time_slot) VALUES (?, ?, ?)',
    [user_id, date, time_slot],
    (err, results) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ error: 'Time slot already booked' });
        }
        return res.status(500).json({ error: 'Server error' });
      }
      res.status(201).json({ 
        message: 'Appointment booked successfully',
        appointmentId: results.insertId 
      });
    }
  );
});

// Get User's Appointments
// Get User's Appointments
app.get('/appointments', authenticateToken, (req, res) => {
  // Add console.log to debug
  console.log('Fetching appointments for user:', req.user.id);

  db.query(
    'SELECT * FROM appointments WHERE user_id = ? ORDER BY date, time_slot',
    [req.user.id],
    (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Server error' });
      }
      console.log('Found appointments:', results);
      res.json({ appointments: results });
    }
  );
});


// Cancel Appointment
// Cancel Appointment
app.delete('/appointments/:id', authenticateToken, (req, res) => {
  // Fix: Change req.id to req.params.id to correctly get the ID from URL parameters
  const appointmentId = req.params.id;
  const userId = req.user.id;

  db.query(
    'UPDATE appointments SET status = "cancelled" WHERE id = ? AND user_id = ?',
    [appointmentId, userId],
    (err, results) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      
      if (results.affectedRows === 0) {
        return res.status(404).json({ error: 'Appointment not found or unauthorized' });
      }
      
      res.json({ message: 'Appointment cancelled successfully' });
    }
  );
});


const PORT = process.env.PORT || 3000;

// Add this to your server startup
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
 });