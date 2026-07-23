# Governance — SQL Studio Pro

## Decision-Making Structure

SQL Studio Pro uses a **Benevolent Dictator For Now (BDFN)** model for the initial phase, transitioning to a core maintainer committee as the project grows.

---

## Roles

| Role | Responsibilities | Decision Weight |
|------|-----------------|----------------|
| **Lead Maintainer** | Architecture, roadmap, final decisions | Decisive |
| **Core Maintainer** | Code review, feature ownership, releases | High |
| **Contributor** | Bug fixes, feature PRs, documentation | Medium |
| **Community Member** | Issue reports, feedback, discussions | Informational |

---

## Decision Types

### Trivial Decisions
- Bug fixes, typos, minor UX improvements
- Made by any contributor via PR
- Single approving review required

### Standard Decisions
- New features, refactors, dependency changes
- Discussed in GitHub Issues or Discussions
- Two approving reviews from Core Maintainers required

### Strategic Decisions
- Roadmap changes, architecture pivots, monetization strategy
- Discussed openly with community input
- Lead Maintainer makes final call after discussion period

---

## Conflict Resolution

1. Discuss the disagreement openly in the relevant GitHub Issue/PR
2. If unresolved, escalate to Lead Maintainer
3. Lead Maintainer decision is final
4. All decisions logged in [ARCHITECTURE_DECISIONS.md](../20-decisions/ARCHITECTURE_DECISIONS.md)

---

## Release Authority

Only Core Maintainers and above may tag and publish releases. See [RELEASE_STRATEGY.md](../09-release/RELEASE_STRATEGY.md).

---

## Amendments

This document may be amended by the Lead Maintainer with 7 days public notice.

---

*Last reviewed: 2026-07-22*
