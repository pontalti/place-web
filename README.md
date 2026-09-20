# 🚀 PlaceWeb

Welcome to **PlaceWeb**! This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 20.1.5.

It is the Angular front end for the [Place](https://github.com/pontalti/place) API
(branch `feature/springboot`), and runs with server-side rendering (SSR).

---

## ✨ Features

* **Live Reload:** The application automatically reloads when you change any of the source files.
* **Code Scaffolding:** Easily generate new components, directives, pipes, and more.
* **Optimized Builds:** Production builds are optimized for speed and performance.
* **Integrated Testing:** Run unit and end-to-end tests with simple commands.
* **Server-side rendering:** Served by an Express server that also forwards `/api` to the backend.

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

* [Node.js](https://nodejs.org/) (which includes npm)
* [Angular CLI](https://angular.io/cli)
* [Docker](https://docs.docker.com/) — only for the Docker Compose setup

---

## 🏁 Getting Started

To get a local copy up and running, follow these simple steps.

### **Installation**

1.  **Clone the repo:**
    ```bash
    git clone https://github.com/your_username/PlaceWeb.git
    ```
2.  **Navigate to the project directory:**
    ```bash
    cd PlaceWeb
    ```
3.  **Install NPM packages:**
    ```bash
    npm install
    ```

---

## 🐳 Running with Docker

Compose builds both containers: the backend is cloned and built from the
`feature/springboot` branch of the API repository, and the front end is built
from this one. The front end waits for the backend's health check, so the
first `up` takes a few minutes.

**1. Build the Docker compose (without cache):**
```bash
docker compose build --no-cache
```

**2. Running the Docker compose:**
```bash
docker compose up -d
```

**3. Checking the Docker compose log:**
```bash
docker compose logs -f
```

**4. Stopping everything:**
```bash
docker compose down
```

### 🌐 Where to access it

| | |
| :--- | :--- |
| **Application** ...... | http://localhost:4200 |
| **Place list** ...... | http://localhost:4200/place/list |
| **New place** ...... | http://localhost:4200/place/new |
| **API (direct)** ...... | http://localhost:8080/api/v1/place |
| **Swagger UI** ...... | http://localhost:8080/swagger-ui/index.html |
| **H2 console** ...... | http://localhost:8080/h2 |
| **Remote debug (JVM)** ...... | localhost:8000 |

The SSR server listens on port 4000 inside its container and is published on
**4200**, so the address is the same one used by `ng serve`.

### 🔌 How the front end reaches the API

The browser always calls the relative path `/api/v1/...`, never the backend
directly. What resolves it differs per environment:

| | |
| :--- | :--- |
| **`ng serve`** ...... | `proxy.conf.json` → `http://localhost:8080` |
| **Docker / SSR** ...... | `src/api-proxy.ts`, mounted in `src/server.ts` → `$API_TARGET` (`http://api:8080`) |

Because both are served from a single origin, CORS never comes into play. To
point the SSR server somewhere else, set `API_TARGET` on the `web` service in
`docker-compose.yml`.

---

## Development server

Start the backend first (or `docker compose up -d api`), then:

```bash
ng serve --open
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

---
