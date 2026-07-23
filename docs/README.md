# SQL Studio Pro — Documentation Index

> The most powerful SQLite database manager and SQL IDE for Android.

## Project Overview

SQL Studio Pro is a production-grade, offline-first Android application for managing SQLite databases, writing SQL queries, viewing results, importing/exporting data, and analyzing database performance — comparable to desktop tools like DB Browser for SQLite and DBeaver, purpose-built for mobile.

---

## Documentation Structure

| Folder | Contents |
|--------|----------|
| [00-governance](./00-governance/) | Contributing, Code of Conduct, Roles, Governance |
| [01-product](./01-product/) | Strategy, PRD, Feature Specs, Module Specs, Workflows |
| [02-research](./02-research/) | Competitive Analysis, User Research |
| [03-architecture](./03-architecture/) | Architecture, Design Patterns, State, Navigation |
| [04-ui](./04-ui/) | Design System, UI Guidelines, Color, Typography, Flows |
| [05-database](./05-database/) | Database Design, ER Diagrams, SQL Schema |
| [06-api](./06-api/) | SQL Editor, Parser, Query Engine, Result Grid, Search |
| [07-security](./07-security/) | Security Model, Permission Model |
| [08-testing](./08-testing/) | Test Plans, QA Checklists |
| [09-release](./09-release/) | Play Store Release, Changelog, Strategy |
| [10-ai](./10-ai/) | AI Assistant, SQL Generator |
| [11-devops](./11-devops/) | CI/CD, Monitoring, Logging |
| [12-roadmap](./12-roadmap/) | Roadmap, Implementation Phases |
| [13-assets](./13-assets/) | Asset Guide |
| [14-analytics](./14-analytics/) | Analytics Strategy |
| [15-legal](./15-legal/) | Privacy Policy, Terms of Service |
| [16-operations](./16-operations/) | Backup, Restore, Import, Export |
| [17-performance](./17-performance/) | Performance Guide |
| [18-risk](./18-risk/) | Risk Register |
| [19-checklists](./19-checklists/) | Launch & Development Checklists |
| [20-decisions](./20-decisions/) | Architecture Decision Records (ADRs) |

---

## Quick Links

- [Vision & Mission](./VISION.md)
- [Product Requirements](./01-product/PRODUCT_REQUIREMENTS_DOCUMENT.md)
- [Architecture Overview](./03-architecture/ARCHITECTURE.md)
- [UI Design System](./04-ui/DESIGN_SYSTEM.md)
- [Roadmap](./12-roadmap/ROADMAP.md)
- [Security Model](./07-security/SECURITY_MODEL.md)
- [Changelog](./09-release/CHANGELOG.md)

---

## App Modules

```
Dashboard       — Home screen with stats, recent DBs, quick actions
Databases       — Create, open, manage SQLite databases
Database Detail — Explore tables, views, indexes, triggers
Table Viewer    — Browse data, view structure (columns, types, PKs)
SQL Editor      — Write and execute SQL queries
Result Viewer   — Display query results in a scrollable grid
History         — Query execution history with reuse
Settings        — App preferences and data management
AI Templates    — SQL template library and query scaffolds
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Platform | React Native + Expo SDK 54 |
| Language | TypeScript 5.9 |
| Database | expo-sqlite (native SQLite) |
| State | React Context + AsyncStorage |
| Navigation | Expo Router (file-based) |
| UI | React Native StyleSheet + @expo/vector-icons |
| Animation | react-native-reanimated |
| Fonts | Inter (Google Fonts) |

---

## Getting Started (Developer)

```bash
# Install dependencies
pnpm install

# Run dev server
pnpm --filter @workspace/mobile run dev

# Scan QR in Expo Go (Android/iOS) to test on device
```

---

*Last updated: 2026-07-22 | Version: 1.0.0*
