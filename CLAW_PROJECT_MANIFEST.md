# CLAW PROJECT MANIFEST
> **Generated on:** 2026-02-15
> **Project Name:** Business Control System (Miss Chulerías)
> **Version:** 2.7 (Premium Interface)

## 1. Project Overview
**Business Control System** is a comprehensive POS (Point of Sale) and Inventory Management solution designed for "Miss Chulerías". It features a modern, high-fidelity user interface (Glassmorphism/Premium Dark Mode) and a robust backend for managing multiple inventory sites, sales sessions, and user permissions.

### Core Objectives
1.  **Sales Management**: Efficient POS interface with barcode scanning, cart management, and payment processing (Cash/Transfer).
2.  **Inventory Control**: Multi-site support (MCH1, MCH2, Almacén) with real-time stock tracking and adjustments.
3.  **Financial Tracking**: Session-based shifts with automatic wage calculation (5% of profit), expense tracking, and sales reporting.
4.  **Security**: User role management (Admin/Editor/Viewer), session enforcement (Kick/Ban), and account verification.

## 2. Technical Architecture

### 2.1 Backend (`/server`)
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: SQLite (`better-sqlite3`)
    - **Primary DB**: `inventory.db`
    - **Backups**: `backups/` (auto-generated)
- **Authentication**: Custom Bearer Token implementation with session persistence in DB.
- **File Storage**: Local filesystem (`uploads/`) for product images and return evidence.

#### Key Dependencies
- `better-sqlite3`: High-performance synchronous SQLite driver.
- `multer`: Handling `multipart/form-data` for image uploads.
- `cors`: Cross-Origin Resource Sharing.
- `archiver`: Creating zip backups of the system.
- `nodemailer`: Email notifications (configured but currently minimal usage).

### 2.2 Frontend (`/client`)
- **Build Tool**: Vite
- **Framework**: React 19
- **Styling**: Tailwind CSS v4
    - **Theme**: Premium Dark Mode with HSL variables.
    - **Effects**: Glassmorphism (`backdrop-filter`), Gradients, Glow effects.
    - **Icons**: `lucide-react` (migrated from `react-icons`).
- **State Management**: React Context (`CartProvider`) + Local Component State.
- **Routing**: `react-router-dom` v7.

#### Key Dependencies
- `framer-motion`: Complex layout animations and transitions.
- `recharts`: Financial data visualization.
- `axios`: HTTP client for API communication.
- `clsx` / `tailwind-merge`: Dynamic class composition.

## 3. Database Schema (SQLite)

### Inventory & Products
- `products`: Catalog data (`name`, `cost_mx`, `sale_price_manual`, `image`).
- `inventories`: Site definitions (`id` [mch1, mch2, alm], `name`, `color`).
- `product_inventory`: N:N Pivot table tracking stock per site (`product_id`, `inventory_id`, `quantity`).
- `product_images`: Support for multiple images per product.

### Sales & Finance
- `sales_sessions`: Shift tracking (`user_id`, `start_time`, `end_time`, `initial_cash`, `declared_cash`, `total_profit`, `wage_amount`).
- `sales`: Transaction headers (`total`, `payment_method`, `session_id`, `inventory_id`).
- `sale_items`: Line items for each sale (`product_id`, `quantity`, `price`, `cost`).
- `expenses`: Shift-related expenses (`type`, `amount`, `description`).
- `returns`: Product returns management (`reason`, `action` [restock/discard], `evidence_url`).

### Users & Security
- `users`: Accounts (`username`, `email`, `pin`, `role`, `session_token`, `is_banned`).
- `blacklisted_emails`: Prevent re-registration of banned users.
- `system_config`: Global settings (e.g., `allow_registration`).

## 4. API Structure
- **Base URL**: `http://localhost:3001/api`
- **Auth**:
    - `POST /login`: Authenticates user and returns session token.
    - `POST /register`: Creates new user accounts.
- **Operations**:
    - `GET /products`: Fetches catalog with aggregated stock.
    - `POST /sales`: Processes a transaction and updates stock.
    - `POST /sessions/*`: Manages shift lifecycle (open/status/close).
    - `POST /inventory/adjustment`: Manual stock corrections.

## 5. Development Guidelines
- **Project Root**: `d:\J work\Documentos\Miss Chulerías\business_control_system`
- **Running Locally**:
    - **Backend**: `cd server && npm run dev` (Port 3001)
    - **Frontend**: `cd client && npm run dev` (Port 5173)
- **Deployment**: Windows-based local deployment via `INICIAR_SISTEMA.bat`.

## 6. Current Status & Roadmap
- **Recently Completed**:
    - Premium UI Overhaul (Dashboard, Sidebar, POS).
    - Migration to Tailwind v4.
    - POS Interface Redesign (Glassmorphism).
- **Pending/Next**:
    - Complete auditing of remaining legacy components.
    - Enhanced reporting features.
