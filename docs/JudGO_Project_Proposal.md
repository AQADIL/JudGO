# Project Proposal: JudGO
## 1. Executive Summary
JudGO is a high-performance competitive programming platform designed with a focus on Real-Time Duels (PVP) and modern Developer Experience (DX). Unlike traditional platforms that focus on solitary problem solving, JudGO gamifies the learning process by allowing developers to compete 1v1 in real-time environments.
Built on a robust Go (Golang) backend with Firebase Realtime Database, the platform ensures millisecond-latency synchronization for matches. The frontend (planned) aims to deliver a premium, "Apple-style" aesthetic using Glassmorphism and smooth micro-interactions, setting a new standard for educational tool UI.
## 2. Problem & Relevance
Current market leaders in algorithmic training (e.g., LeetCode, Codeforces) suffer from two main issues:
Outdated UX: Interfaces often feel clunky, "academic," or intimidating to new users.
Lack of Social Engagement: Solving problems is a lonely experience. Existing "contest" modes are usually large-scale and impersonal, lacking the adrenaline of a direct 1v1 face-off.
JudGO solves this by combining the speed of a modern Go execution engine with the engagement of competitive gaming.


## 3. Target Audience
Computer Science Students: For preparing for exams and labs in a gamified way.
Junior/Middle Developers: For keeping algorithmic skills sharp via quick 10-minute duels.
Interview Preppers: Simulating time-pressure environments similar to technical interviews.
## 5. Planned Key Features
### ⚔️ Core: Real-Time Duel Mode (PVP)
The flagship feature of JudGO.
Room System: Users can generate a unique Match Code (e.g., X7K-9P) or an Invite Link to challenge a friend.
Synchronized Start: Both players see a synchronized countdown.
Live Status: Progress bars update in real-time via Firebase, showing the opponent's status (Coding / Compiling / Passed) without revealing their code.
### 🤖 Bot Mode (PVE)
For solo practice with competitive pressure.
Simulated Opponent: Players compete against a "Ghost Bot" that solves the problem within a randomized time range based on the problem's difficulty.
Dynamic Difficulty: The bot adapts its speed based on the user's winning streak.
### ⚡ Technical Excellence
Sandboxed Execution: User code (Go, Python, C++) is executed in an isolated environment (Docker-ready architecture) to ensure security.
Modern UI (Planned): A React-based interface featuring Monaco Editor (VS Code engine), dark mode, and glassmorphism effects for a premium feel.
## 6. Technical Architecture (Milestone 1)
For this assignment, the focus is on the Backend Monolith and Architecture Design.
Language: Go (Golang) 1.23+
Architecture: Modular Monolith (Clean Architecture: Domain, Service, Repository layers).
Database: Firebase Realtime Database (for match states) + Firestore (for user profiles/tasks).
Protocol: REST API (initially) with potential upgrade to WebSockets for the judge engine.


## Tables

| Competitor | Strengths | Weaknesses | How JudGO Wins |
| --- | --- | --- | --- |
| LeetCode | Huge problem database, industry standard. | Boring UI, mostly solitary, no direct PVP invites. | Duel Mode: Direct 1v1 challenges via link/code. |
| Codeforces | Hardcore community, difficult problems. | UI from 2010, very high entry barrier. | UX: Modern, "Clean" interface & lower entry barrier. |
| Codewars | Gamification (Kyus). | Slow execution, no real-time sync between players. | Real-Time: Firebase RTDB ensures instant state updates. |
