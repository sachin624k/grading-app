# Grading App — Backend Learning Notes

A collection of study notes documenting how to build a modern backend using **TypeScript**, **PostgreSQL**, **Prisma ORM**, and **Hono**. The example project used throughout is a **grading/course management app** — covering users, courses, tests, test results, and enrollments.

These notes are written as a practical, from-scratch walkthrough: project setup → data modeling → schema design → migrations → seeding → building a REST API → validation → testing.

---

## Notes Index

| Part                                                     | Topic                                    | Covers                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Part 1](./notes/part-1-setup-modeling-prisma-basics.md) | **Setup, Data Modeling & Prisma Basics** | Project setup, TypeScript config, PostgreSQL database creation, Prisma initialization, data modeling for the grading system, Prisma schema fundamentals, one-to-many & many-to-many relations, migrations, generating the Prisma Client, seeding data, nested writes (`create` vs `connect`), Prisma Studio, and aggregation (`aggregate()` / `groupBy()`)                                                                                                            |
| [Part 2](./notes/part-2-rest-api-validation-testing.md)  | **REST API, Validation & Testing**       | Building a REST API with **Hono** on top of the Part 1 database, REST concepts (endpoints, HTTP methods, status codes), designing the API's routes, Prisma-in-context middleware, configuring the Hono app vs starting the server, a health-check status route, testing with **Vitest** + `app.request()`, request validation with **Zod**, and full CRUD (`POST`/`GET`/`PUT`/`DELETE`) for the `User` resource including the `.partial()` pattern for update schemas |
| Part 3                                                   | _Coming soon_                            | _(To be added)_                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

> More parts will be added here as the notes grow — each part builds on the concepts introduced before it. Read them in order if you're new to this stack.

---

## Tech Stack

| Layer         | Technology                                                     |
| ------------- | -------------------------------------------------------------- |
| Language      | **TypeScript**                                                 |
| Database      | **PostgreSQL** (via Prisma Postgres, a managed/cloud database) |
| ORM           | **Prisma ORM** (schema, migrations, type-safe client)          |
| Web framework | **Hono** (routing, middleware, testing helper)                 |
| Validation    | **Zod** (request body & URL parameter validation)              |
| Testing       | **Vitest**                                                     |
| Dev runner    | **tsx** (runs `.ts` files directly, with watch mode)           |

---

## Project Structure (as covered in the notes)

```
grading-app/
├── prisma/
│   ├── schema.prisma           # Database models & relations            (Part 1)
│   ├── seed.ts                   # Seed script for sample data            (Part 1)
│   └── migrations/                # Auto-generated SQL migrations         (Part 1)
├── generated/
│   └── prisma/                     # Generated Prisma Client                (Part 1)
├── src/
│   ├── app.ts                       # Hono app config + middleware           (Part 2)
│   ├── index.ts                     # Starts the HTTP server                 (Part 2)
│   ├── lib/
│   │   └── prisma.ts                  # Prisma Client + withPrisma middleware  (Part 2)
│   └── routes/
│       ├── status.ts                   # Health-check route                    (Part 2)
│       └── users.ts                    # User CRUD routes + Zod schemas        (Part 2)
├── tests/
│   └── status.test.ts                   # Example Vitest test                    (Part 2)
├── .env                             # Environment variables (DATABASE_URL)
├── prisma.config.ts                  # Prisma project configuration
├── tsconfig.json                      # TypeScript configuration
└── package.json
```

---

## How to Use These Notes

Each part is self-contained but builds on earlier ones. Read them in order if you're new to Prisma/PostgreSQL/Hono. If you already know the basics, use the table of contents inside each part to jump to a specific topic (e.g. relations, migrations, validation, testing).
