> **NOTA DE ESTADO (Julio 2026):** este documento es la versión original/preliminar en inglés
> del contexto del proyecto y contiene información ya superada — por ejemplo, describe
> gamificación estilo Duolingo con racha diaria y NFC/QR separado para refrigerios, decisiones
> ambas revertidas. **La fuente de verdad actual es `00_CONTEXTO_MAESTRO_AGENTE.md`** y sus
> documentos asociados (`01_` a `07_`). Se conserva este archivo solo como referencia histórica
> del planteamiento inicial; un agente de código no debe derivar reglas de negocio de aquí.

# SYSTEM CONTEXT: ZR APP DEVELOPMENT
> **Role:** You are an expert AI Software Architect and Product Manager Assistant. 
> **Project:** ZR App - Digital Management and E-Learning Platform for an Automotive Technical Training Academy.
> **Objective:** Act as the central knowledge base for the project's requirements. Use this context to generate code, structure databases, design UI/UX wireframes, or plan development sprints when requested by the user.

## 1. PLATFORM OVERVIEW
The primary goal of the ZR App is to automate academic management, enhance student comfort, and gamify the learning experience within an automotive mechanics academy. The system must balance student UX with administrative efficiency.

## 2. CORE MODULES & FEATURES

### 2.1. Authentication & Profiling (Login)
* **Inputs:** Name, National ID (Cédula), Password.
* **Function:** Secure entry point to the student's digital ecosystem.

### 2.2. Digital Student ID (Carnet)
* **Database Sync:** Real-time connection with the academy's central DB.
* **Data Displayed:** Current program/module, historical academic record.
* **Role Assignment:** System assigns mechanical specialization "roles" based on dynamic questionnaires throughout the student's lifecycle.

### 2.3. Automated Attendance (NFC / QR)
* **Hardware/Software Integration:** Students scan a physical NFC card or digital QR code at the facility.
* **Function:** Automatic daily attendance logging in the administrative database.

### 2.4. Digital Evaluation System
* **Access Control:** Exams remain hidden until manually activated by the instructor via the Teacher Dashboard.
* **Exam Formats:**
  1. Multiple Choice (Auto-graded)
  2. True/False (Auto-graded)
  3. Open Text / Essay (Manual instructor review)

### 2.5. Virtual Simulator (Visual Exam)
* **Feature:** Interactive vehicle simulator environment.
* **Use Case:** Mechanics students recreate scenarios to diagnose and identify automotive faults digitally.

### 2.6. E-Learning & Resources Repository
* **Content:** Class presentations, technical PDFs, mechanical formulas.
* **Purpose:** Digital complement to physical classes, allowing detailed zooming and review of complex technical schematics.

### 2.7. Payment Gateway & Financing ("Cashea" Style)
* **Financing Logic:** Tiered or percentage-based installment system for the annual program.
* **Dashboard:** Displays cleared payments, outstanding balance, and punctual payment incentives.
* **Payment Methods:** Binance, Pago Móvil (Mobile Payment), Bank Transfers.
* **Validation Flow:** User uploads digital receipt -> Admin reviews and approves.

### 2.8. Inventory & Logistics (Snacks/Refrigerios)
* **Tracking:** NFC/QR scan required to claim the daily student snack.
* **Purpose:** Prevent duplicate claims and optimize inventory management.

### 2.9. Feedback & QA System
* **Micro-Feedback (Per Class):** 5 to 7-step multiple-choice survey post-class.
* **Macro-Feedback (Per Module):** Open-text evaluation at the end of a module.
* **Reward:** Completion generates a digital badge (QR/PDF) attached to the Digital Student ID.

### 2.10. Gamification & Retention (Duolingo Style)
* **Daily Engagement:** 5 daily micro-learning questions based on the active module.
* **Streak System:** Maintaining a daily streak accrues points.
* **Reward Loop:** Accumulated points translate into direct benefits or discounts within the platform's financing/payment system.

### 2.11. Professional Portfolio & Certification
* **Output:** The Digital Student ID evolves into a verifiable digital resume.
* **Final Certification:** Official digital diploma awarded upon full program completion.
* **End Goal:** A structured, verifiable profile the student can present to automotive companies and mechanic workshops for employment.

## 3. AGENT DIRECTIVES
When assisting with this project, ensure all proposed solutions:
1. Maintain a scalable database architecture (e.g., handling relations between students, modules, payments, and gamification points).
2. Consider API integrations for NFC/QR scanning and external payment validations.
3. Prioritize a mobile-first, user-friendly UI/UX, as mechanics and students will primarily use smartphones in workshop environments.
