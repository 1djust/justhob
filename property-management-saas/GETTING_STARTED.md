# Getting Started with Property Management SaaS

Follow these steps to set up and run the application locally.

## Prerequisites

- **Node.js**: version 18 or higher.
- **PostgreSQL**: A running instance (local, Docker, or Cloud like Supabase/Neon).

## 0. Getting your DATABASE_URL

The `DATABASE_URL` format is: `postgresql://USER:PASSWORD@HOST:PORT/DATABASE`

### Option A: Cloud (Recommended for speed, 100% Free)
Create a free project on [Neon](https://neon.tech), [Supabase](https://supabase.com), or [Railway](https://railway.app). They all offer **generous free tiers** that require **$0 upfront** and are perfect for development. They will provide you with a connection string immediately.

### Option B: Local Installation
If you have Postgres installed locally:
- **USER**: your system username (often `postgres`)
- **PASSWORD**: the password you set during installation
- **HOST**: `localhost`
- **PORT**: `5432`
- **DATABASE**: any name (e.g., `property_mgmt`). *Note: You may need to create this database first using `psql` or a GUI like pgAdmin.*

Example: `postgresql://postgres:mysecretpassword@localhost:5432/property_mgmt`

### Option C: Docker
Run this command to start a local Postgres container:
```bash
docker run --name pg-mgmt -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres
```
Your URL: `postgresql://postgres:password@localhost:5432/postgres`

---

## 💡 Zero Cost Recommendation

If you want to keep costs at **strictly $0 forever** with no platform limits:
1.  **Install PostgreSQL locally** (Search for "PostgreSQL download" for Windows).
2.  **Use Docker** (if you have Docker Desktop installed).

Both options run on your own hardware, so they are completely free!

## 1. Environment Configuration

You need to create `.env` files for the database and the API.

### Database (`packages/database/.env`)
Create a file at `packages/database/.env`:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/property_mgmt"
```

### API (`apps/api/.env`)
Create a file at `apps/api/.env`:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/property_mgmt"
JWT_SECRET="your-secret-key-here"
FRONTEND_URL="http://localhost:3000"
COOKIE_SECRET="another-secret-key-here"
```

## 2. Installation

Install all dependencies from the root directory:
```bash
npm install
```

## 3. Database Sync

Push the schema to your PostgreSQL database:
```bash
# From the root
npm run push --workspace=@property-management/database
```
*Note: This will create the tables in your database.*

## 4. Run the Application

Start both the backend API and the frontend web app using Turbo:
```bash
npm run dev
```

- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:3001](http://localhost:3001)

## 5. First Steps

1. Go to [http://localhost:3000/register](http://localhost:3000/register) and create an account.
2. Registration will automatically create a default workspace for you.
3. You can then start adding properties, tenants, and recording rent payments from the dashboard.
