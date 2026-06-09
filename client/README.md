# TalentMatch - AI-Powered Resume Matching

**TPF Software Inc** - Intelligent Candidate Ranking System

## Overview

TalentMatch is an AI-powered resume matching application that helps HR teams efficiently screen and rank candidates against job requirements. Built with React, Node.js, and OpenAI.

## Features

- 🤖 **AI-Powered Matching** - Semantic analysis using OpenAI GPT-4
- 🔒 **Privacy-First** - Automatic data anonymization before sending to OpenAI
- 📊 **Dual Matching Engines** - Choose between AI or NLP matching
- 📈 **Analytics Dashboard** - Track hiring metrics and trends
- 🎯 **Smart Scoring** - Weighted scoring for skills, experience, education
- 💼 **Job Management** - Create and manage job postings
- 👥 **Candidate Pipeline** - Track candidates through hiring stages

## Quick Start

### Frontend
```bash
cd client
npm install
npm run dev
```

### Backend
```bash
cd server
npm install
npm start
```

## Configuration

Edit `server/.env`:
```env
OPENAI_API_KEY=your-key-here
COMPANY_NAME=TPF Software Inc
ENABLE_ANONYMIZATION=true
```

## Documentation

- [Privacy & Data Protection](../PRIVACY.md)
- [Data Anonymization Guide](../DATA-ANONYMIZATION-SUMMARY.md)

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, Zustand
- **Backend**: Node.js, Express, SQLite
- **AI**: OpenAI GPT-4, Natural Language Processing
- **Font**: Poppins

---

© 2025 TPF Software Inc. All rights reserved.
