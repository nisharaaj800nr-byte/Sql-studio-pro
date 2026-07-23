# Role Definitions — SQL Studio Pro

## Engineering Roles

### Lead Software Architect / CTO
- Owns system architecture and technical direction
- Reviews all major design decisions
- Approves breaking changes and architectural pivots
- Maintains Architecture Decision Records (ADRs)

### Principal Android Engineer
- Owns mobile app technical quality
- Reviews all React Native / Expo code
- Enforces coding standards and performance guidelines
- Owns performance benchmarking and profiling

### Database Architect
- Owns data model design and SQLite integration
- Reviews all schema changes
- Maintains DATABASE_DESIGN.md and SQL_SCHEMA.md
- Owns migration strategy

### UI/UX Lead
- Owns design system and user experience
- Reviews all UI changes
- Maintains DESIGN_SYSTEM.md and COLOR_SYSTEM.md
- Conducts usability reviews

### Product Manager
- Owns product roadmap and prioritization
- Writes and maintains PRD and Feature Specifications
- Coordinates with all roles for release planning
- Manages stakeholder communication

### QA Lead
- Owns test strategy and quality gates
- Maintains TEST_PLAN.md and QA_CHECKLIST.md
- Approves releases from quality perspective
- Manages bug triage

### Security Engineer
- Owns security model and threat assessment
- Reviews permission model changes
- Maintains SECURITY_MODEL.md and RISK_REGISTER.md
- Conducts periodic security audits

### DevOps Engineer
- Owns CI/CD pipeline and release automation
- Maintains CI_CD.md and MONITORING.md
- Manages build scripts and deployment tooling

### Technical Writer
- Owns all documentation quality and completeness
- Reviews and updates docs on every feature release
- Maintains this documentation index

---

## Responsibility Matrix (RACI)

| Activity | Lead Arch | Product | QA | Security | DevOps |
|----------|-----------|---------|-----|---------|--------|
| Feature design | R/A | C | I | C | I |
| Architecture decisions | R/A | I | I | C | C |
| Security review | C | I | I | R/A | I |
| Release approval | C | A | R | C | C |
| Documentation | C | R | I | I | I |
| Bug triage | C | A | R | C | I |

*R=Responsible, A=Accountable, C=Consulted, I=Informed*
