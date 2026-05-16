Link for presentation: https://canva.link/pb5q7y4k7hm7b6y

# Apeiron — Backend

This is the backend repository for the **Apeiron** project — an application that helps build eco-awareness in children by teaching them about recycling and the responsible use of secondary raw materials. The backend powers the educational experience with AI-driven content generated through the Google Gemini API, delivering interactive lessons, prompts, and feedback to young users.

## Tech Stack

- **[NestJS](https://nestjs.com/)** — progressive Node.js framework for scalable server-side applications
- **TypeScript** — primary language
- **[Google Gemini API](https://ai.google.dev/)** — AI engine for generating educational and interactive content
- **Node.js** — runtime
- **ESLint + Prettier** — code quality and formatting
- **Docker** — containerization for development and deployment

## What We Did

We built the server-side part of Apeiron, including:

- A modular NestJS architecture with controllers, services, and modules
- Integration with the **Gemini API** to generate AI-powered educational content about recycling and eco-awareness
- REST API endpoints consumed by the Angular frontend
- Containerized setup using Docker and `docker-compose` for easy local development and deployment
- CI/CD workflows via GitHub Actions

## Getting Started

### Prerequisites

- **Node.js** (LTS version recommended)
- **npm**
- A valid **Google Gemini API key**

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/Infomatrix-Apeiron/INFOMATRIX2026_BE.git
cd INFOMATRIX2026_BE
npm install
```

### Environment Variables

Create a `.env` file in the project root and add your Gemini API key (and any other required configuration):

```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3000
```

### Run the Server

```bash
# development
npm run start

# watch mode (auto-reload on changes)
npm run start:dev

# production mode
npm run start:prod
```

The server will start on `http://localhost:3000/` by default.

### Run Tests

```bash
# unit tests
npm run test

# e2e tests
npm run test:e2e

# test coverage
npm run test:cov
```

### Run with Docker

The project includes a `Dockerfile` and `docker-compose.yaml`. To run the backend in a container:

```bash
docker-compose up --build
```
