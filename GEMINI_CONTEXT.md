# GEMINI PROJECT CONTEXT - [Business Control System]

> [!IMPORTANT]
> **INSTRUCTIONS FOR GEMINI WEB:**
> 1. Use the **Google Workspace** extension.
> 2. Read this file and the mentioned source files (like `app.js`) from the user's Google Drive.
> 3. Provide logic, architectural advice, or code snippets based on this context.

## Project Vision
A specialized Point of Sale (POS) and inventory management system for multiple businesses (MCH 1, MCH 2, etc.), featuring a dark premium UI, role-based permissions (Owner, Admin, Seller), and day-closure audit flows.

## Current Project State
The project is currently in **Phase 18: Gemini Integration Bridge**.
All core POS features (Sale registration, editing, deletion, and day closure) are implemented and verified.

## Key Files
- `index.html`: Main structure and theme.
- `app.js`: Core logic, POS rendering, and data management.
- `style.css`: Premium dark styles.
- `data.js`: Product database and inventory constants.

## Recent Changes by Antigravity (Agentic Gemini)
- Fixed structural HTML in `showSaleDetail` modal.
- Standardized date filtering to ISO-8601 strings.
- Implemented "Ventas de Hoy" management with trash/pencil icons for sellers.
- Added permission alerts for unauthorized history deletions.
- Fixed button responsiveness in the POS view.

## Pending Tasks / Known Issues
- Verify multiple business ID consistency across global inventory vs POS.
- Enhance reporting analytics.

---
*Last updated: 2025-12-26 02:38:25*
