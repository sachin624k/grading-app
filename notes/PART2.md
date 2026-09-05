## Part 2 — REST API, Validation & Testing

In Part 2, we build a **REST API** on top of the Prisma + PostgreSQL database from [Part 1](./PART1.md). By the end, you'll have a running HTTP server with CRUD endpoints, input validation, and an automated test suite covering them.

---

### Table of Contents

1. [Prerequisites](#prerequisites)
2. [Technologies](#technologies)
3. [What We'll Build](#what-well-build)
4. [REST API Concepts](#rest-api-concepts)
5. [API Endpoints in Our Grading System](#api-endpoints-in-our-grading-system)
6. [Hono](#hono)
7. [Installation](#installation)
8. [Making Prisma Client Available with Middleware](#making-prisma-client-available-with-middleware)
9. [Creating the Server](#creating-the-server)
10. [Status Route](#status-route)
11. [Testing the Status Route](#testing-the-status-route)
12. [User Routes — CRUD](#user-routes--crud)

- [Create User (POST)](#1-defining-the-user-routes)
- [Get User (GET)](#get-user-route)
- [Delete User (DELETE)](#delete-user-route)
- [Update User (PUT)](#update-user-route)

13. [Quick Reference / Cheat Sheet](#quick-reference--cheat-sheet)

---

### Prerequisites

This part assumes you've already completed [Part 1](./PART1.md) and have:

- A working `schema.prisma` with the `User`, `Course`, `Test`, `TestResult`, and `CourseEnrollment` models
- A generated Prisma Client (`npx prisma generate`)
- A working `DATABASE_URL` in `.env`
- Basic familiarity with `async`/`await` in TypeScript

---

### Technologies

| Technology        | Role                                                                           |
| ----------------- | ------------------------------------------------------------------------------ |
| **Hono**          | Builds the HTTP/REST API server                                                |
| **Prisma Client** | Performs database operations                                                   |
| **PostgreSQL**    | Stores the data                                                                |
| **Zod**           | Validates incoming request data                                                |
| **Vitest**        | Tests API endpoints                                                            |
| **TypeScript**    | Type-safe backend development                                                  |
| **Prisma 7**      | `prisma-client`, `prisma.config.ts`, and driver adapters (as set up in Part 1) |

---

### What We'll Build

1. **REST API** → CRUD endpoints for our models
2. **Middleware** → makes the Prisma Client available to every Hono route
3. **Validation** → uses Zod to check user input before it reaches the database
4. **Testing** → tests endpoints using Vitest + Hono's `app.request`
5. **CRUD** → `GET`, `POST`, `PUT`, `DELETE` operations

---

### REST API Concepts

| Term                                        | Meaning                                                                             |
| ------------------------------------------- | ----------------------------------------------------------------------------------- |
| **API** (Application Programming Interface) | Rules that allow different programs to communicate                                  |
| **REST**                                    | A set of conventions for exposing data/operations through HTTP requests             |
| **Endpoint / Route**                        | A specific entry point of an API (the terms are used interchangeably in this guide) |

#### An Endpoint Has 3 Main Parts

| Part            | Meaning                         | Example                        |
| --------------- | ------------------------------- | ------------------------------ |
| **Path**        | URL used to access the resource | `/users`                       |
| **HTTP Method** | Operation to perform            | `GET`, `POST`, `PUT`, `DELETE` |
| **Handler**     | Code that processes the request | A TypeScript function          |

#### Common HTTP Methods

| Method   | Purpose         |
| -------- | --------------- |
| `GET`    | Read/fetch data |
| `POST`   | Create data     |
| `PUT`    | Update data     |
| `DELETE` | Delete data     |

#### HTTP Status Codes

Status codes tell the client what happened. The ones used throughout this guide:

| Code  | Meaning                                                      |
| ----- | ------------------------------------------------------------ |
| `200` | OK — request succeeded (typically for `GET`/`PUT`)           |
| `201` | Created — resource created successfully (`POST`)             |
| `204` | No Content — request succeeded, nothing to return (`DELETE`) |
| `400` | Bad Request — invalid input / validation error               |
| `404` | Not Found — the requested resource doesn't exist             |

---

### API Endpoints in Our Grading System

The API is organized around these resources:

#### User

```
POST   /users                  → Create user
GET    /users                  → Get all users
GET    /users/{userId}         → Get one user
PUT    /users/{userId}         → Update user
DELETE /users/{userId}         → Delete user
```

#### Course Enrollment

```
GET    /users/{userId}/courses
POST   /users/{userId}/courses
DELETE /users/{userId}/courses/{courseId}
```

Used to view, create, and delete a user's course enrollment.

#### Course

```
POST   /courses
GET    /courses
GET    /courses/{courseId}
PUT    /courses/{courseId}
DELETE /courses/{courseId}
```

Used for CRUD operations on courses.

#### Test

```
POST   /courses/{courseId}/tests
GET    /courses/tests/{testId}
PUT    /courses/tests/{testId}
DELETE /courses/tests/{testId}
```

Used to manage tests belonging to courses.

#### Test Result

```
GET    /users/{userId}/test-results
POST   /courses/tests/{testId}/test-results
GET    /courses/tests/{testId}/test-results
PUT    /courses/tests/test-results/{testResultId}
DELETE /courses/tests/test-results/{testResultId}
```

Used to create, read, update, and delete test results.

#### Dynamic Parameters `{}`

`{userId}`, `{courseId}`, `{testId}`, etc. are **URL parameters** — placeholders that get filled in with a real value at request time.

```
Path pattern:    /users/{userId}
Actual request:  /users/13
Resolved as:     userId = 13
```

This lets a single route definition handle a request for _any_ user, course, or test — the handler reads the actual value out of the URL at runtime.

---

### Hono

**Hono** is a small, fast JavaScript/TypeScript web framework used to build our REST API. It provides:

- Routing
- Middleware
- TypeScript support
- A testing helper (`app.request`)
- Support for Node.js, Bun, Deno, Cloudflare Workers, etc.

For our project, the request flow is:

```
Client → Hono → Prisma → PostgreSQL
```

| Package               | Purpose                                        |
| --------------------- | ---------------------------------------------- |
| `hono`                | Build the REST API / web server                |
| `@hono/node-server`   | Run Hono on Node.js                            |
| `zod`                 | Type-safe input validation                     |
| `@hono/zod-validator` | Use Zod validation directly inside Hono routes |
| `dotenv`              | Load `.env` variables                          |
| `vitest`              | Test the API/application                       |

> `--save-dev` for Vitest means it's needed for development/testing only, not for running the production application.

---

### Installation

```bash
npm install hono @hono/node-server zod @hono/zod-validator dotenv
npm install vitest --save-dev
```

---

### Making Prisma Client Available with Middleware

#### Why do we need this?

Our Hono route handlers need to use the Prisma Client to communicate with PostgreSQL. Instead of creating a _new_ Prisma Client for every single request (which would be wasteful and slow), we:

1. Create **one** Prisma Client instance, once, when the app starts.
2. Put it into Hono's **context** using middleware.
3. Access it inside any route using `c.get("prisma")`.

**`src/lib/prisma.ts`**

```ts
import "dotenv/config";
import type { Context, Next } from "hono";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
```

| Import          | Meaning                                                                        |
| --------------- | ------------------------------------------------------------------------------ |
| `dotenv/config` | Loads `.env` variables                                                         |
| `Context`       | Hono's request context type                                                    |
| `Next`          | Type of the function used to continue to the next step in the request pipeline |
| `PrismaPg`      | PostgreSQL driver adapter                                                      |
| `PrismaClient`  | The generated Prisma Client                                                    |

#### 1. Get the Database URL

```ts
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}
```

Reads `DATABASE_URL` from `.env`. If it doesn't exist, the application stops immediately with a clear error — this is safer than letting the app start and fail confusingly later on the first database call.

#### 2. Create the Prisma Client Once

```ts
const adapter = new PrismaPg({
  connectionString: databaseUrl,
});
export const prisma = new PrismaClient({ adapter });
```

`export` allows other files to import and reuse this **same** `prisma` instance, instead of each file creating its own connection.

#### 3. Tell TypeScript About Prisma in Context

```ts
export type AppEnv = {
  Variables: {
    prisma: PrismaClient;
  };
};
```

This tells TypeScript: _"Our Hono context will contain a variable named `prisma`, and its type is `PrismaClient`."_ Because of this, `c.get("prisma")` is understood by TypeScript as returning a `PrismaClient` — giving us autocomplete and type safety anywhere we call it.

#### 4. The `withPrisma` Middleware

```ts
export function withPrisma(c: Context<AppEnv>, next: Next) {
  if (!c.get("prisma")) {
    c.set("prisma", prisma);
  }
  return next();
}
```

**Parameters**

- `c: Context<AppEnv>` → `c` is Hono's context object; `Context<AppEnv>` tells TypeScript what variables that context can contain.
- `next: Next` → a function that tells Hono _"continue to the next middleware/route."_

**`c.set()` vs `c.get()`**

```ts
c.set("prisma", prisma); // PUT into context
c.get("prisma"); // GET from context
```

**Why the `if` check?**

```ts
if (!c.get("prisma")) {
  c.set("prisma", prisma);
}
```

Read this as: _"If Prisma is not already in the context, put it in."_ This guards against accidentally overwriting an existing value (useful in tests where you might want to inject a different Prisma instance).

**`next()`**

```ts
return next();
```

Means: _"This middleware is finished — continue to the route handler."_ Every middleware in Hono must call `next()` (or return a response directly) to keep the request moving through the pipeline.

---

### Creating the Server

#### 1. `src/app.ts` — Configure the Hono App

```ts
import { Hono } from "hono";
import { withPrisma, type AppEnv } from "./lib/prisma";
import status from "./routes/status";
import users from "./routes/users";

const app = new Hono<AppEnv>();

app.use("*", withPrisma);

app.route("/", status);
app.route("/", users);

export default app;
```

**What's happening:**

- `new Hono<AppEnv>()` → creates a Hono app that follows our `AppEnv` type.
- `app.use("*", withPrisma)` → applies the Prisma middleware to **every** route (`"*"` matches all paths).
- `app.route("/", status)` → mounts the status routes at the root path.
- `app.route("/", users)` → mounts the user routes at the root path.
- `export default app` → exports the configured app so it can be used by the server _and_ by tests.

**Important idea — separate configuration from startup:**

```
app.ts
→ Configure Hono
→ Middleware
→ Routes
```

Keeping `app.ts` free of any actual server-starting code is deliberate: tests can `import app from "../src/app"` and call `app.request(...)` directly, without starting a real server or occupying a network port. This makes tests fast and isolated.

#### 2. `src/index.ts` — Start the Server

```ts
import { serve } from "@hono/node-server";
import app from "./app";

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
```

**Important parts:**

- `serve()` → starts the Hono app on Node.js.
- `app.fetch` → lets Hono handle incoming HTTP requests.
- `port: 3000` → the server listens on port 3000.
- The callback function runs after the server starts successfully and prints the URL.

#### 3. `package.json` Scripts

```json
"scripts": {
  "dev": "tsx watch src/index.ts",
  "start": "tsx src/index.ts",
  "test": "vitest run"
}
```

| Command       | Effect                                                                   |
| ------------- | ------------------------------------------------------------------------ |
| `npm run dev` | Starts the development server and automatically restarts on code changes |
| `npm start`   | Starts the server normally, without watch mode                           |
| `npm test`    | Runs the test suite using Vitest                                         |

---

### Status Route

A minimal "is the server alive?" endpoint — useful as a health check and as a first thing to get working end-to-end before building anything more complex.

Create: `src/routes/status.ts`

```ts
import { Hono } from "hono";
import type { AppEnv } from "../lib/prisma";

const status = new Hono<AppEnv>();

status.get("/", (c) => {
  return c.json({ up: true }, 200);
});

export default status;
```

- `status.get("/")` → handles a `GET` request to `/`.
- `c` → the Hono context.
- `c.json()` → sends a JSON response.
- `{ up: true }` → tells us the server is running.
- `200` → request was successful.
- `export default status` → allows `app.ts` to mount this route.

Run the server and check it manually:

```bash
npm run dev
```

Then open: `http://localhost:3000/`

---

### Testing the Status Route

We use **Vitest** + Hono's `app.request()` to test our status endpoint **without starting the actual server**. `app.request()` sends a request directly to the Hono app in-process and returns a normal `Response` object — this is significantly faster than spinning up a real HTTP server for every test.

Create: `tests/status.test.ts`

```ts
import { describe, test, expect } from "vitest";
import app from "../src/app";

describe("Status route", () => {
  test("GET / returns 200 and { up: true }", async () => {
    const res = await app.request("/");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ up: true });
  });
});
```

**Important concepts:**

| Function                 | Meaning                                                      |
| ------------------------ | ------------------------------------------------------------ |
| `describe()`             | Groups related tests together                                |
| `test()`                 | Defines an individual test case                              |
| `app.request("/")`       | Sends a `GET /` request directly to the Hono app, in-process |
| `res.status`             | Checks the response's HTTP status code                       |
| `res.json()`             | Reads the response body as JSON                              |
| `expect()`               | Compares the actual result against the expected result       |
| `.toBe(200)`             | Asserts the status is _exactly_ `200`                        |
| `.toEqual({ up: true })` | Asserts the JSON body is _exactly_ `{ up: true }`            |

Run the test:

```bash
npm test
```

---

### User Routes — CRUD

#### 1. Defining the User Routes

We create a separate route module for the `User` resource.

File: `src/routes/users.ts`

```ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppEnv } from "../lib/prisma";

const users = new Hono<AppEnv>();

export default users;
```

**Important points:**

- `Hono` → used to create our route/app.
- `z` → used to create Zod validation schemas.
- `zValidator` → connects Zod validation with Hono routes.
- `AppEnv` → tells TypeScript that our Hono context contains `prisma`.
- `new Hono<AppEnv>()` → creates a Hono router where `c.get("prisma")` is available inside handlers.

#### 2. Create User Schema with Zod

```ts
const userSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.email(),

  social: z
    .object({
      bluesky: z.string().optional(),
      linkedin: z.string().optional(),
      website: z.string().optional(),
    })
    .optional(),
});
```

`userSchema` defines what a **valid** user request should look like.

**Why validation?**

TypeScript checks your code during _development_, but API request data arrives at _runtime_, from a client you don't control — TypeScript's compile-time types can't protect you from a malformed or malicious request body. Zod bridges that gap by validating the data as it comes in:

```
Client sends JSON
       ↓
Zod validates it
       ↓
Valid?   → Prisma → Database
Invalid? → 400 Bad Request
```

#### 3. Create User Route

```ts
users.post("/users", zValidator("json", userSchema), async (c) => {
  const prisma = c.get("prisma");

  const data = c.req.valid("json");

  const createdUser = await prisma.user.create({
    data,
    select: { id: true },
  });

  return c.json(createdUser, 201);
});
```

- `users.post("/users", ...)` → when a client sends a `POST` request to `/users`, run this handler.
- `zValidator("json", userSchema)` → validation middleware; rejects the request with `400` before the handler even runs if the JSON body doesn't match `userSchema`.
- `async (c) => { ... }` → the route handler. It's `async` because it performs a database operation with `await`.
- `const prisma = c.get("prisma")` → retrieves the Prisma Client that our earlier middleware placed into Hono's context.
- `const data = c.req.valid("json")` → retrieves the _already-validated_ JSON data, instead of manually parsing and re-checking the raw request body.
- `prisma.user.create({ data, select: { id: true } })` → creates a new row in the `User` table, using the validated `data`. `select: { id: true }` means only the newly created user's `id` is returned, instead of the full user object.
- `return c.json(createdUser, 201)` → sends a JSON response with status `201 Created`.

---

### Get User Route

#### 1. TDD (Test-Driven Development)

**TDD** means writing the test _first_, then implementing the actual route:

```
Write Test → Implement Route → Run Test → Pass
```

This lets you quickly verify changes as you build, and gives you a safety net that immediately tells you if something breaks later.

#### 2. GET User Tests

**User doesn't exist → 404**

```ts
test("GET /users/:userId returns 404 for a non-existent user", async () => {
  const res = await app.request("/users/999999");
  expect(res.status).toBe(404);
});
```

- `app.request()` → sends a request directly to the Hono app; no need to start a real server.
- `/users/999999` → `999999` is a non-existent user ID.
- `expect(res.status).toBe(404)` → since the user isn't found, a `404 Not Found` is expected.

**User exists → 200**

```ts
test("GET /users/:userId returns the user", async () => {
  const res = await app.request(`/users/${userId}`);
  expect(res.status).toBe(200);

  const user = await res.json();
  expect(user.id).toBe(userId);
});
```

- `userId` → an existing ID, obtained from an earlier "create user" test.
- `200` → the request succeeded.
- `res.json()` → converts the response body into a JavaScript object.
- `user.id === userId` → confirms the _correct_ user was returned.

#### 3. Validate the URL Parameter

```ts
const userIdParam = z.object({
  userId: z.coerce.number().int(),
});
```

In a URL like `/users/10`, the `"10"` segment initially arrives as a **string**.

- `z.object()` → defines the expected shape of the URL parameters.
- `z.coerce.number()` → converts the string `"10"` into the number `10`.
- `.int()` → the value must be an integer.

#### 4. GET Route

```ts
users.get(
  "/users/:userId",
  zValidator("param", userIdParam),
  async (c) => {
```

Any request matching this path pattern will hit this handler.

`zValidator("param", userIdParam)` is validation middleware:

- `"param"` → validate the URL parameters.
- `userIdParam` → the schema/rules to validate against.

If the parameter is invalid, the request never reaches the handler or the database — Hono returns a `400` automatically.

#### 5. Get Prisma & the Validated ID

```ts
const prisma = c.get("prisma");
const { userId } = c.req.valid("param");
```

- `c.get("prisma")` → retrieves the Prisma Client from the middleware-populated context.
- `c.req.valid("param")` → returns the validated _and_ converted URL parameter (a real `number`, not a string).

#### 6. Find the User

```ts
const user = await prisma.user.findUnique({
  where: { id: userId },
});
```

#### 7. Handle 404

```ts
if (!user) {
  return c.body(null, 404);
}
```

#### 8. Return the User

```ts
return c.json(user, 200);
```

---

### Delete User Route

Endpoint: `DELETE /users/:userId` — deletes a user using their `userId`.

#### 1. Tests

**Invalid ID → 400**

```ts
test("DELETE /users/:userId fails with 400 for an invalid id", async () => {
  const res = await app.request("/users/aa22", { method: "DELETE" });
  expect(res.status).toBe(400);
});
```

- `aa22` → an invalid ID (not a number), so Zod validation fails.
- `400` → Bad Request.

**Valid ID → 204**

```ts
test("DELETE /users/:userId deletes the user", async () => {
  const res = await app.request(`/users/${userId}`, { method: "DELETE" });
  expect(res.status).toBe(204);
});
```

- `userId` → a previously created user's ID.
- `204` → deletion succeeded, with no response content.

#### 2. Route

```ts
users.delete("/users/:userId", zValidator("param", userIdParam), async (c) => {
  const prisma = c.get("prisma");
  const { userId } = c.req.valid("param");

  await prisma.user.delete({
    where: { id: userId },
  });

  return c.body(null, 204);
});
```

`c.body(null, 204)` sends an empty response body with status `204 No Content` — the conventional response for a successful `DELETE`.

---

### Update User Route

#### 1. Update Endpoint

```
PUT /users/:userId
```

Used to update an existing user.

> **Test order matters:** `CREATE → UPDATE → DELETE`, because `DELETE` removes the user, so `UPDATE` must run _before_ `DELETE` in your test file (otherwise you'd be trying to update a user that no longer exists).

#### 2. Update Tests

**Invalid ID**

```ts
test("PUT /users/:userId fails with 400 for an invalid id", async () => {
  const res = await app.request("/users/aa22", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ firstName: "x" }),
  });

  expect(res.status).toBe(400);
});
```

**Valid Update**

```ts
test("PUT /users/:userId updates the user", async () => {
  const res = await app.request(`/users/${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      firstName: "test-first-name-UPDATED",
      lastName: "test-last-name-UPDATED",
    }),
  });

  expect(res.status).toBe(200);

  const user = await res.json();

  expect(user.firstName).toBe("test-first-name-UPDATED");
  expect(user.lastName).toBe("test-last-name-UPDATED");
});
```

This test checks two things:

1. The request succeeded → `200`
2. The user was actually updated → checks `firstName` and `lastName` in the response

#### 3. `.partial()` — An Important Concept

Recall the create schema:

```ts
const userSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.email(),
  social: z
    .object({
      bluesky: z.string().optional(),
      linkedin: z.string().optional(),
      website: z.string().optional(),
    })
    .optional(),
});
```

For **CREATE**, most fields are required. But for **UPDATE**, a client might only want to change _one_ field (e.g. just `firstName`) — requiring every field on every update would be inconvenient and unnecessary.

**Solution:**

```ts
const updateUserSchema = userSchema.partial();
```

`.partial()` makes every field on the schema **optional**.

**Before:**

```ts
{
  firstName: string,
  lastName: string,
  email: string,
  social?: object
}
```

**After:**

```ts
{
  firstName?: string,
  lastName?: string,
  email?: string,
  social?: object
}
```

So now a request body containing just one of these fields is valid.

**Why `.partial()` is useful:**

Instead of manually writing a separate, duplicate schema for updates, we reuse the create schema:

```ts
const updateUserSchema = userSchema.partial();
```

This follows the **DRY principle** (Don't Repeat Yourself) — if `userSchema` ever changes (a field is renamed, a new validation rule is added), `updateUserSchema` automatically inherits the same rules, with zero extra maintenance.

#### 4. PUT Route

```ts
users.put(
  "/users/:userId",

  zValidator("param", userIdParam),

  zValidator("json", updateUserSchema),

  async (c) => {
    const prisma = c.get("prisma");

    const { userId } = c.req.valid("param");

    const data = c.req.valid("json");

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data,
    });

    return c.json(updatedUser, 200);
  },
);
```

Note that this route chains **two** validators — one for the URL parameter (`param`) and one for the request body (`json`) — both must pass before the handler runs. `prisma.user.update()` then applies only the fields present in `data`, leaving any omitted fields untouched.

---

### Quick Reference / Cheat Sheet

**HTTP methods → CRUD mapping**

| Method   | CRUD Operation | Typical Success Status |
| -------- | -------------- | ---------------------- |
| `POST`   | Create         | `201 Created`          |
| `GET`    | Read           | `200 OK`               |
| `PUT`    | Update         | `200 OK`               |
| `DELETE` | Delete         | `204 No Content`       |

**Common status codes used in this API**

| Code  | Meaning                         |
| ----- | ------------------------------- |
| `200` | OK                              |
| `201` | Created                         |
| `204` | No Content                      |
| `400` | Bad Request (validation failed) |
| `404` | Not Found                       |

**Hono context helpers**

| Call                      | Purpose                                      |
| ------------------------- | -------------------------------------------- |
| `c.get("prisma")`         | Retrieve the Prisma Client from context      |
| `c.set("prisma", prisma)` | Store the Prisma Client in context           |
| `c.req.valid("param")`    | Get validated + coerced URL parameters       |
| `c.req.valid("json")`     | Get validated JSON request body              |
| `c.json(data, status)`    | Send a JSON response                         |
| `c.body(null, status)`    | Send an empty response body (e.g. for `204`) |

**Zod patterns used**

| Pattern                    | Purpose                                                                 |
| -------------------------- | ----------------------------------------------------------------------- |
| `z.object({...})`          | Define an object schema                                                 |
| `z.string()` / `z.email()` | Field-level type validation                                             |
| `.optional()`              | Marks a single field as optional                                        |
| `z.coerce.number().int()`  | Converts a string URL param into an integer                             |
| `schema.partial()`         | Makes **every** field in a schema optional (great for update endpoints) |

**Testing patterns**

| Call                       | Purpose                                                      |
| -------------------------- | ------------------------------------------------------------ |
| `app.request(path, init?)` | Sends a request directly into the Hono app, no server needed |
| `describe()` / `test()`    | Group and define test cases (Vitest)                         |
| `expect(x).toBe(y)`        | Assert exact primitive equality                              |
| `expect(x).toEqual(y)`     | Assert deep/object equality                                  |
