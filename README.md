# ASTRA_V1

> **ASTRA** = **A**utonomous **S**ynchronization, **T**ranscription, and **R**esolution **A**ssistant

An intelligent multi-agent meeting management and resolution platform designed for real-time meeting intelligence, constraint-based scheduling, transcript NLU, action item resolution, and persistent cross-meeting memory.

---

## 🌟 Key Features

1. **Autonomous Multi-Agent Orchestrator**
   - Finite State Machine (`CREATED` $\to$ `SCHEDULING` $\to$ `SCHEDULED` $\to$ `AGENDA_GENERATED` $\to$ `TRANSCRIPT_READY` $\to$ `ANALYZING` $\to$ `MINUTES_GENERATED` $\to$ `TASKS_SYNCED` $\to$ `MEMORY_UPDATED` $\to$ `COMPLETED`).
   - Server-Sent Events (SSE) streaming real-time agent progression to the browser.
2. **Constraint-Based Meeting Scheduler**
   - Interval intersection across participant availability matrices.
   - Multi-factor slot scoring: Availability ratio, preference window alignment, date matching, priority weighting, and conflict penalties.
   - Deterministic tie-breaking with plain-language reasoning explanations and ranked alternatives.
3. **Structured Agenda Agent**
   - Autonomous agenda generation validating topic duration budgets strictly against total meeting time.
   - Powered by Gemini 3.8 Flash with deterministic offline template fallbacks.
4. **Multi-Format Transcription Agent**
   - Ingestion and normalization of `.txt`, `.vtt`, `.srt`, and `.json` transcripts.
   - Utterance segmentation and speaker diarization parsing.
5. **Hybrid Minutes & NLU Agent**
   - Dual-engine: Deterministic rule-based NLP extraction (regex automata, modal verb analysis, entity resolution) and Gemini 3.8 Flash structured JSON generation.
   - Extracts formal decisions, open/unresolved questions, and action items with owners and parsed deadlines.
6. **Task Tracker & Calendar Adapters**
   - `MockTaskTrackerAdapter` converts action items into actionable tasks with status workflows (`TODO`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED`, `OVERDUE`).
   - `MockCalendarAdapter` synchronizes virtual calendar events with zero external API dependencies.
7. **Cross-Meeting Persistent Memory & TF-IDF Retrieval**
   - Mathematical TF-IDF and Cosine Similarity search over historical meeting summaries.
   - Autonomous detection of recurring unresolved technical issues across multiple meetings.
   - Autonomous follow-up meeting recommendation engine.
8. **Academic Presentation Mode (`/demo`)**
   - One-click end-to-end lifecycle rehearsal with live visual feedback, algorithmic complexity explanations, and structured minutes export (Markdown / Print).

---

## 🚀 Quick Start

### Running the Full-Stack Application (Port 3000)
```bash
# Install dependencies
npm install

# Start Express + Vite full-stack server
npm run dev
```

Visit **http://localhost:3000** in your browser.

---

## 🏗️ System Architecture

```
User / Evaluator
       ↓
Browser Interface (React + Tailwind + Lucide)
       ↓
REST API & SSE Stream (Express + Vite)
       ↓
Orchestrator Agent
 ├── Scheduler Agent (Constraint Interval Intersections)
 ├── Agenda Agent (Duration-Constrained Topic Allocator)
 ├── Transcription Agent (Speaker Diarization Parser)
 ├── Minutes / NLU Agent (Hybrid Syntactic NLP + Gemini 3.8 Flash)
 ├── Task Tracker Agent (MockTaskTrackerAdapter)
 ├── Calendar Agent (MockCalendarAdapter)
 └── Memory Agent (TF-IDF Vector Space & Recurring Issue Detector)
       ↓
Persistent Database Store (astra_db.json / In-Memory SQLite Models)
```

---

## 📊 Pre-Loaded Academic Demo Corpus

The database initializes with a realistic academic corpus:
- **5 Team Participants**: Chaitali Raut, Vaishnavi, Sakshi, Dipali, Dr. Sharma.
- **8 Historical Meetings**: Architecture reviews, constraint scheduling, database schema, calendar sync, and defense rehearsals.
- **18+ Populated Tasks**: Spanning various priorities, assignees, and workflow statuses.
- **2 Distinct Recurring Issues**:
  1. *OAuth Token Revocation & Cloud Calendar Sync Race Conditions* (detected across Meeting #1, #4, and #7).
  2. *Database Connection Pool Exhaustion under Concurrent Agent Runs* (detected across Meeting #3 and #6).

---

## 📚 Academic Documentation

Complete documentation is located in the `docs/` folder:
- [System Architecture](docs/architecture.md)
- [Algorithms & Mathematical Formulations](docs/algorithms.md)
- [REST API Specification](docs/api.md)
- [Database Schema & ER Models](docs/database.md)
- [Agent Specifications](docs/agents.md)
- [Setup & Execution Guide](docs/setup.md)
- [Testing & Verification](docs/testing.md)
- [Future Scope & Production Roadmap](docs/future-scope.md)
