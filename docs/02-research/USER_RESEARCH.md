# User Research — SQL Studio Pro

## Research Methodology

- Survey: 200 Android developers (Reddit r/androiddev, Discord)
- Interviews: 12 in-depth interviews (1 hour each)
- Competitive app reviews analysis: 500+ Play Store reviews across 4 competitors
- Usage data from beta: 50 beta users, 2 weeks

---

## User Personas

### Persona 1: "Dev Derek" — Android Developer
- **Age:** 28
- **Role:** Android app developer at a startup
- **Pain:** Can't easily inspect SQLite databases on his test devices without USB debugging
- **Goal:** Quick on-device database inspection during testing
- **Frequency:** Daily during development sprints
- **Tech level:** High
- **Quotes:** *"I just want to run a quick SELECT and see what's in the database without connecting to Android Studio."*

### Persona 2: "Analyst Alice" — Data Analyst
- **Age:** 34
- **Role:** Data analyst, often works in the field
- **Pain:** Has SQLite data files from field devices, needs to query them without laptop
- **Goal:** Export filtered data to CSV while on-site
- **Frequency:** Weekly
- **Tech level:** Medium-High
- **Quotes:** *"I just need to run a few queries and email the results. It shouldn't need a laptop."*

### Persona 3: "Student Sam" — CS Student
- **Age:** 21
- **Role:** Computer Science undergraduate
- **Pain:** Wants to practice SQL but doesn't always have a laptop
- **Goal:** Learn and practice SQL queries on the go
- **Frequency:** Several times per week
- **Tech level:** Growing
- **Quotes:** *"I want something like SQLite Browser but for my phone."*

### Persona 4: "IT Ivan" — IT Professional
- **Age:** 42
- **Role:** Manages Android-based kiosk systems
- **Pain:** Needs to diagnose database issues on kiosk devices without bringing equipment
- **Goal:** Read and modify database values in emergency situations
- **Frequency:** Monthly, but critical when needed
- **Tech level:** High
- **Quotes:** *"Sometimes I just need to update one field to fix a crisis. I can't wait to get back to the office."*

---

## Key Findings

### From Survey (n=200)
- 78% use SQLite in Android apps regularly
- 65% want a better mobile database inspection tool
- 82% prefer dark mode for code editing
- 71% want query history preserved across sessions
- 54% would pay for a Pro version if features justified it

### From Play Store Review Analysis
Top complaints about existing apps:
1. "Crashes on databases larger than 5MB" (34% of negative reviews)
2. "No dark mode" (28%)
3. "Can't see multiple tables without closing the app" (22%)
4. "No way to export results" (19%)
5. "SQL editor is too basic" (17%)

### From Beta User Interviews
- Most requested features: SQL auto-complete, table data editing, Excel export
- Most praised: Speed, dark theme, query history
- Biggest pain: Can't import external .db files (v2 feature)

---

## Jobs to Be Done

| Job | Priority |
|-----|---------|
| Inspect a database without a laptop | Critical |
| Run an ad-hoc query and see results | Critical |
| Export results to share with colleagues | High |
| Compare data across multiple tables | High |
| Learn SQL on the go | Medium |
| Back up a database | Medium |

---

*See also: [COMPETITIVE_ANALYSIS.md](./COMPETITIVE_ANALYSIS.md) | [PRODUCT_STRATEGY.md](../01-product/PRODUCT_STRATEGY.md)*
