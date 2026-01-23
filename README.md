# JudGO 🚀

![Go Version](https://img.shields.io/badge/Go-1.23+-00ADD8?style=flat&logo=go)
![Firebase](https://img.shields.io/badge/firebase-RTDB-ffca28?style=flat&logo=firebase)
![Architecture](https://img.shields.io/badge/architecture-clean-green)

**JudGO** is a high-performance competitive programming platform designed to evaluate algorithm solutions in real-time. Built with Go for speed and Firebase Realtime Database for instant updates.

> **University Project:** Advanced Programming 1  
> **Assignment:** 3 - Project Design & Setup Milestone

---

## 🏗 Architecture & Design

The project follows the **Standard Go Project Layout** and **Clean Architecture** principles to ensure scalability and maintainability.

### Structure Overview
* **`cmd/`**: Entry points (Main application).
* **`internal/`**: Private application code (Domain, Services, Repositories).
* **`pkg/`**: Public libraries (Sandbox Runner, Utils).
* **`docs/`**: Project documentation (UML, ERD).

### Key Features (Planned)
* ⚡ **Real-time Judging**: Instant feedback on code submissions.
* 🔒 **Sandboxed Execution**: Safe execution of user code (Go, Python, C++).
* 📊 **Live Leaderboard**: Real-time ranking updates via Firebase.
* 🛡️ **Monolithic Design**: Simplified deployment for the initial MVP.

---

## 🛠 Getting Started

### Prerequisites
* Go 1.22 or higher
* Git

### Installation & Run

1.  **Clone the repository**
    ```bash
    git clone [https://github.com/AQADIL/JudGO.git](https://github.com/AQADIL/JudGO.git)
    cd JudGO
    ```

2.  **Install dependencies**
    ```bash
    go mod tidy
    ```

3.  **Run the application**
    This command starts the HTTP server on port 8080.
    ```bash
    go run cmd/api/main.go
    ```

4.  **Verify**
    Open your browser or use curl:
    ```bash
    curl http://localhost:8080/
    ```

---

## 👥 Team Members

| Name | Role | GitHub |
|------|------|--------|
| **Alish Akadil** | Backend Lead / Architect | [@AQADIL](https://github.com/AQADIL) |
| **Savsikhanov Ildar** | Backend Dev / Auth | [@ILDAR](https://github.com/1B0-d) |
| **Ibyrkhanov Zhanibek** | Backend Dev / Logic | [@ZHANIBEK](https://github.com/ibyrkhanov06-ux) |

---

## 📅 Project Roadmap (Weeks 7-10)

* **Week 7:** Repository Setup & Architecture Design (Current).
* **Week 8:** Auth Service & User Management.
* **Week 9:** Problem Creation & Sandbox Runner Prototype.
* **Week 10:** Submission Pipeline & Frontend Integration.

---
© 2026 JudGO Team. All rights reserved.