# Appointment Booking System

## Overview
This is an Express.js-based REST API for an appointment booking system. It allows users to register, log in, and book appointments while ensuring authentication and validation.

## Features
- User authentication (Signup/Login)
- Secure password hashing using bcrypt
- JSON Web Token (JWT) authentication
- Appointment booking with time slot validation
- MySQL database integration
- Error handling and validation

## Technologies Used
- **Node.js** with **Express.js**
- **MySQL** for database
- **bcrypt** for password hashing
- **jsonwebtoken** for authentication
- **dotenv** for environment variables

## Installation

### Prerequisites
- Node.js installed
- MySQL database setup

### Steps
1. Clone the repository:
   ```sh
   git clone https://github.com/your-repo/appointment-booking-system.git
   cd appointment-booking-system
   ```

2. Install dependencies:
   ```sh
   npm install
   ```

3. Create a `.env` file and configure:
   ```ini
   PORT=5000
   JWT_SECRET=your_secret_key
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=appointment_system
   ```

4. Set up MySQL database:
   ```sql
   CREATE DATABASE appointment_system;
   ```

5. Run the server:
   ```sh
   node server.js
   ```

## API Endpoints
### Authentication
- **POST /signup** – Register a new user
- **POST /login** – Authenticate user and return JWT

### Appointments
- **POST /book-appointment** – Book an appointment (requires authentication)
- **GET /appointments** – Get all booked appointments

## Security Considerations
- Passwords are hashed before storing.
- JWT authentication is used for API security.
- SQL queries use parameterized inputs to prevent SQL injection.

## Future Improvements
- Email notifications for appointment confirmation
- Admin panel for managing appointments
- Implement rate limiting for security

## License
This project is licensed under the MIT License.

## Author
sameera

