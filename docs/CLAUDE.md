# CLAUDE.md

## Project Overview

This repository contains the internal PMS project for Hôtel Makarim in Tétouan, Morocco, a 3-star hotel with 24 rooms.[cite:31] The product is not a multi-hotel SaaS platform. It is a modular in-house property management system built specifically for this hotel and its real operational workflows.[cite:31]

The goal of the project is to replace fragmented operational processes with a production-grade system that supports front desk operations, reservations, check-in/check-out, room status, housekeeping, guest records, folios, invoicing, company accounts, stock and linen management, reporting, and audit.[cite:30][cite:45][cite:91][cite:118]

This is a real production project, not a UI demo. Architectural integrity, data consistency, traceability, and progressive delivery matter more than superficial completeness.[cite:134][cite:35]

## Business Scope

The PMS must support the core hotel lifecycle:
- reservations
- arrivals and departures
- stays in progress
- room assignment and room status
- housekeeping workflows
- guest records
- folios, charges, split billing, and payments
- company accounts with deferred billing
- reporting and audit.[cite:30][cite:73][cite:91]

The system must also support specific operational requirements already validated in project discussions:
- minimum-night restrictions for high-demand periods, aligned with the general logic used by Booking.com partner tools.[web:22]
- posting extras such as restaurant charges to a guest stay and optionally separating accommodation invoices from service invoices.[cite:91][web:89]
- split billing between guest and company on the same stay.[cite:91][web:83]
- company accounts with credit, debt, deferred payment terms such as 30 days, and a city-ledger style tracking model.[web:102][web:110]
- stock and linen management tied to housekeeping workflows, room par levels, stock movements, and manager control views.[cite:118][web:124][web:127]

## Non-Negotiable Architecture Decisions

Do not undo or flatten these decisions:

1. The system is modular by domain (“briques”), not a monolithic screen-first build.[cite:31][cite:35]
2. Reservation, stay, guest, folio, invoice, and payment are distinct concepts and must remain distinct in the data model and API design.[cite:73][cite:91]
3. A stay is the main operational object once a guest is checked in.[cite:73][web:82]
4. A stay may have multiple folios.[cite:91][web:86]
5. Charges and payments must belong to explicit folios and remain traceable.[web:93][web:95]
6. Company billing must support direct billing / city ledger logic rather than being modeled as a simple guest note.[web:102][web:106]
7. Stock must be movement-based, not only a manually edited quantity field.[cite:118][web:124]
8. Linen must be modeled as a reusable asset flow across states and locations, not as a simple consumable.[web:124][web:129]
9. Backend business rules are the source of truth. Do not push critical rules only into the frontend.[cite:35]
10. This project targets production deployment on a VPS with a real MySQL database, not a local-only mock app.[cite:31][cite:134]

## Tech Stack

### Backend
- Node.js
- NestJS with TypeScript
- Prisma ORM
- MySQL 8.[cite:31]

### Frontend
- React
- TypeScript
- Vite
- TailwindCSS
- shadcn/ui.[cite:31]

### Infrastructure
- Hostinger VPS
- Ubuntu
- Docker Compose
- Nginx
- Certbot / TLS.[cite:31][cite:35]

## Repository Direction

Expected project direction:
- backend and frontend are separated cleanly
- domain modules mirror business modules
- documentation lives in `/docs`
- migrations are versioned
- environment variables are explicit and documented
- production and staging concerns must be kept in mind from the start.[cite:35][cite:44]

Suggested module areas:
- auth
- users
- settings
- rooms
- reservations
- stays
- customers
- companies
- folios
- invoices
- payments
- housekeeping
- stock / inventory
- reports
- audit.[cite:30][cite:31]

## Current Product Priorities

The validated MVP direction is:
1. settings base
2. users and roles
3. rooms and room types
4. reservations
5. check-in / stays / check-out
6. guest records
7. folios, manual charges, payments, invoices
8. company accounts and deferred billing
9. housekeeping base
10. stock and linen base
11. reports and audit.[cite:30][cite:35][cite:91][cite:118]

Do not prioritize advanced integrations before the core operational model is stable. OTA automation, external company portal, advanced POS integration, and card payment integration are later-phase features.[cite:33][cite:45][web:110]

## Core Domain Model Guidelines

At minimum, the project is expected to include concepts equivalent to:
- RoomType
- Room
- Reservation
- Stay
- Guest / Customer
- Company
- CompanyAccount
- Folio
- FolioLine
- Payment
- Invoice
- HousekeepingTask
- StockItem
- StockLocation
- StockMovement
- RoomParLevel
- AuditLog.[cite:31][cite:91][cite:118]

Important domain rules:
- A reservation can exist without an active stay.[cite:73]
- Check-in creates or activates the stay context.[cite:73]
- A stay can generate multiple folios for billing separation.[cite:91][web:83]
- Accommodation and extras may be invoiced together or separately.[web:89][cite:91]
- A company may cover all or part of a stay.[cite:91]
- Company balances may be prepaid, current, or overdue.[web:109][web:110]
- Stock balances should derive from movements whenever possible.[cite:100][cite:118]
- Housekeeping interactions can trigger stock and linen movements.[cite:45][web:124]

## Stock and Housekeeping Rules

The Stock & Linen module is operational, not just administrative.[cite:118]

Required logic:
- distinguish reusable linen, consumables, and equipment.[web:124]
- track locations such as central store, clean laundry, dirty laundry, housekeeping cart, and room.[web:124][web:127]
- support room par levels / standard room allocations.[web:133]
- support housekeeping-related movements during stay cleaning and checkout cleaning.[web:124]
- support lost, damaged, discarded, and adjusted stock events.[web:129]
- provide manager-facing alerts and dashboards.[cite:118][web:127]

Do not design the stock module as a flat CRUD inventory list only.[cite:118][web:124]

## Coding Rules

When implementing:
- preserve modular boundaries
- prefer explicit service-layer logic over hidden side effects
- make DTOs and validation explicit
- keep naming aligned with business meaning
- do not introduce fake/demo data paths into production modules unless clearly isolated
- avoid “quick fixes” that collapse multiple domain concepts into one table or one screen
- when a rule is uncertain, document the assumption instead of silently inventing behavior.[web:146][cite:35]

## Working Style Expected From Claude

For any substantial feature or module:
1. read relevant docs first
2. summarize understanding
3. identify assumptions and risks
4. propose design before large implementation
5. implement in small coherent steps
6. explain what was changed and what remains open.[web:141][web:147]

Do not jump straight into coding a large module without first confirming architecture and scope.[web:147]

## What To Read First

At the beginning of a session, read these files if they exist:
- `CLAUDE.md`
- `docs/00-overview/cahier-des-charges.md`
- `docs/00-overview/architecture-technique.md`
- `docs/00-overview/roadmap.md`
- the module document relevant to the current task.[web:141][web:143]

## Current State

The functional scope has been heavily refined and the cahier des charges is considered validated by the project owner.[cite:31] The next practical phase is implementation for production, starting with project structure, domain model, module planning, and Claude Code execution in a disciplined order.[cite:35][cite:134]

The project should now move from planning to controlled implementation. The correct order is not “build everything at once,” but “establish repo structure, then core models, then MVP modules in sequence.”[cite:35][web:145]

## Do Not Assume

Do not assume this project is:
- a SaaS multi-tenant PMS
- a mock/demo-only frontend
- a restaurant-first POS system
- an OTA-first platform
- a simplified invoicing app.

It is an operational PMS for a real hotel, with future extensibility but immediate production constraints.[cite:31][cite:134]
