# DocPoint Backend Service

A professional, production-ready backend service for **DocPoint** built with **Express**, **TypeScript**, and **MongoDB (Mongoose)**.

## Project Structure

```
DocPointBackend/
├── src/
│   ├── config/             # DB configuration and environment parsing
│   ├── controllers/        # Express handlers (orchestrate request flows)
│   ├── middlewares/        # Express request/response logic guards
│   ├── models/             # Database schemas
│   ├── routes/             # Endpoint path mappings
│   ├── services/           # Reusable business logic/workflows
│   ├── utils/              # General helper modules (AppError, logger)
│   ├── validations/        # Zod request validators
│   ├── app.ts              # Express middleware setups
│   └── server.ts           # Server start entrypoint
├── .env                    # System variables configuration (ignored by Git)
├── tsconfig.json           # TS Compiler preferences
└── package.json            # Manifest file
```

---

## Setup Instructions

### Prerequisites
* **Node.js** (v18.x or above recommended)
* **MongoDB** (Local instance or MongoDB Atlas URI)

### 1. Install Dependencies
Run the following command inside `DocPointBackend` to install the node packages:
```bash
npm install
```

### 2. Environment Variables Configuration
The database connection string and application variables are loaded from the `.env` file. We have set up a default `.env` for you. 

```env
PORT=5001
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/docpoint
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=30d

# Email OTP (required for production email verification)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
APP_URL=http://localhost:5001

# Optional: also send OTP via SMS
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
```

When SMTP is not configured, OTP codes are logged to the server console and returned as `devCode` in API responses for development.

### 3. Run Development Server
To launch the server with hot-reloading:
```bash
npm run dev
```

### 4. Build and Start for Production
To compile typescript into javascript and execute the compiled code:
```bash
npm run build
npm start
```

---

## API Endpoints List

### Health check
* **GET** `/api/health` -> Confirms if the backend server is reachable.

### Authentication
* **POST** `/api/auth/register` -> Creates a new user record.
  * *Request Body:*
    ```json
    {
      "name": "John Doe",
      "email": "john.doe@example.com",
      "password": "strongpassword123"
    }
    ```
* **POST** `/api/auth/login` -> Authenticates and returns a JWT token.
  * *Request Body:*
    ```json
    {
      "email": "john.doe@example.com",
      "password": "strongpassword123"
    }
    ```
* **GET** `/api/auth/me` -> Retrieves the logged-in user profile (requires validation).
  * *Headers:* `Authorization: Bearer <your_jwt_token>`
