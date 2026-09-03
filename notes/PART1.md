# Building a Modern Backend with TypeScript, PostgreSQL & Prisma

A step-by-step guide to setting up a backend project using **TypeScript**, **PostgreSQL**, and **Prisma ORM**, using a grading/course app as the example project.

---

## Table of Contents

1. [Development Setup](#development-setup)
2. [TypeScript Configuration](#typescript-configuration)
3. [Create a PostgreSQL Database](#create-a-postgresql-database)
4. [Initialize Prisma ORM](#initialize-prisma-orm)
5. [Data Modeling — Grading System](#data-modeling--grading-system)
6. [Understanding the Prisma Schema](#understanding-the-prisma-schema)
7. [Relations](#relations)
8. [Migrating the Database](#migrating-the-database)
9. [Generating Prisma Client](#generating-prisma-client)
10. [Seeding the Database](#seeding-the-database)
11. [Nested Writes (create vs connect)](#nested-writes-create-vs-connect)
12. [Prisma Studio](#prisma-studio)
13. [Prisma Aggregation](#prisma-aggregation)

---

## Development Setup

```bash
mkdir grading-app
cd grading-app
npm init -y
```

### Install TypeScript tools

```bash
npm install typescript tsx @types/node --save-dev
```

### Install Prisma + PostgreSQL packages

```bash
npm install prisma@7.9.1 @types/pg --save-dev
npm install @prisma/client@7.9.1 @prisma/adapter-pg pg dotenv
```

| Package              | Purpose                                      |
| -------------------- | -------------------------------------------- |
| `prisma`             | Prisma CLI (`init`, `migrate`, `generate`)   |
| `@prisma/client`     | Query the database using Prisma              |
| `@prisma/adapter-pg` | Connects Prisma to PostgreSQL through `pg`   |
| `pg`                 | PostgreSQL Node.js driver                    |
| `@types/pg`          | TypeScript types for `pg`                    |
| `dotenv`             | Loads `.env` variables                       |
| `tsx`                | Runs `.ts` files directly during development |
| `--save-dev`         | Installs the package as a dev dependency     |

---

## TypeScript Configuration

Create the config file:

```bash
npx tsc --init
```

**`tsconfig.json`:**

```json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ES2023",
    "strict": true,
    "esModuleInterop": true,
    "types": ["node"]
  }
}
```

| Option                        | Meaning                                                        |
| ----------------------------- | -------------------------------------------------------------- |
| `module: "ESNext"`            | Use modern `import`/`export` syntax                            |
| `moduleResolution: "bundler"` | How TypeScript resolves imported modules                       |
| `target: "ES2023"`            | Compile down to modern JavaScript                              |
| `strict: true`                | Enables stronger type checking                                 |
| `esModuleInterop: true`       | CommonJS/ESM import compatibility                              |
| `types: ["node"]`             | Adds Node.js types — needed because `process` is a Node global |

### Enable ESM in `package.json`

```json
{
  "type": "module"
}
```

---

## Create a PostgreSQL Database

This guide uses **Prisma Postgres**, a managed/cloud PostgreSQL database.

```bash
npx create-db
```

This creates a cloud database and prints a `postgres://...` connection string.

---

## Initialize Prisma ORM

```bash
npx prisma init --output ../generated/prisma
```

| Part                           | Meaning                                              |
| ------------------------------ | ---------------------------------------------------- |
| `npx`                          | Run a package command without installing it globally |
| `prisma`                       | Prisma CLI                                           |
| `init`                         | Initialize Prisma in the project                     |
| `--output ../generated/prisma` | Generate the Prisma Client code in this folder       |

This creates:

```
prisma/
└── schema.prisma
.env
prisma.config.ts
```

- **`schema.prisma`** → defines your database models/schema
- **`.env`** → stores environment variables (e.g. `DATABASE_URL`)
- **`prisma.config.ts`** → Prisma project configuration (schema location, migrations, database URL, etc.)

### Set the connection string

Paste the URL printed by `npx create-db` into `.env`:

```env
DATABASE_URL="postgres://<your-connection-string-from-create-db>"
```

---

## Data Modeling — Grading System

**Approach:** First understand the real-world entities and their relationships, _then_ design the tables.

### Entities → Tables

| Entity             | Represents                                          |
| ------------------ | --------------------------------------------------- |
| `User`             | An account/person                                   |
| `Course`           | A learning course                                   |
| `Test`             | A test belonging to a course                        |
| `TestResult`       | A student's test result + the teacher who graded it |
| `CourseEnrollment` | Connects users and courses                          |

### Relationships

**One-to-Many (1:N)**

- `Course` → many `Test`
- `Test` → many `TestResult`
- `User` → many `TestResult` (via `graderId`)
- `User` → many `TestResult` (via `studentId`)

**Many-to-Many (M:N)**

- `User` ↔ `Course` — a user can join many courses, and a course can have many users.

Use a junction table for the M:N relationship:

```
User 1 ─── * CourseEnrollment * ─── 1 Course
```

`CourseEnrollment` contains:

```
userId   → User.id   (FK)
courseId → Course.id (FK)
role
```

> **Key idea:** Understand the problem → identify entities → create tables → determine relationships → add PKs/FKs.

---

## Understanding the Prisma Schema

The Prisma schema is a **declarative definition** of your database tables. It's the single source of truth for:

- The generated Prisma Client
- Prisma Migrate, which creates the actual database schema

### Defining a Model

A `model` = a database table. Each Prisma model maps to one PostgreSQL table.

```prisma
model User {
  id        Int     @id @default(autoincrement())
  email     String  @unique
  firstName String
  lastName  String
  social    Json?
}
```

### `Json` fields

`Json` stores flexible, structured data where fields can vary between records.

```json
{ "github": "sachin624k", "linkedin": "sachin", "portfolio": "sachin.dev" }
```

Another user could have just:

```json
{ "github": "rahul-dev" }
```

- No database schema change is needed when adding/removing JSON fields.
- Useful for: social links, settings, preferences, metadata, etc.
- **Don't** use `Json` for normal relationships — use proper tables and relations instead.

### Full Model Set

```prisma
model User {
  id        Int     @id @default(autoincrement())
  email     String  @unique
  firstName String
  lastName  String

  social    Json?
}

model Course {
  id            Int     @id @default(autoincrement())
  name          String
  courseDetails String?
}

model Test {
  id        Int      @id @default(autoincrement())
  updatedAt DateTime @updatedAt
  name      String
  date      DateTime
}

model TestResult {
  id        Int      @id @default(autoincrement())
  createdAt DateTime @default(now())
  result    Int
}
```

---

## Relations

### One-to-Many

A 1:N relation is represented using three parts:

1. **Relation scalar** — the actual foreign key (FK)
2. **Relation field on the MANY side** — points to one related model
3. **Relation field on the ONE side** — points to many records

**Example: `Test` → `TestResult`**

```prisma
model Test {
  id          Int           @id @default(autoincrement())
  testResults TestResult[]
}

model TestResult {
  id     Int  @id @default(autoincrement())
  testId Int
  test   Test @relation(fields: [testId], references: [id])
}
```

```
Test 1 ───────── * TestResult
```

| Field                      | Meaning                                                 |
| -------------------------- | ------------------------------------------------------- |
| `testId Int`               | Relation scalar + FK                                    |
| `test Test`                | Relation field — one `TestResult` belongs to one `Test` |
| `testResults TestResult[]` | Relation field — one `Test` has many `TestResult`s      |
| `fields: [testId]`         | FK field in the current model                           |
| `references: [id]`         | Referenced field in the related model                   |
| `[]`                       | Denotes "many" records                                  |

> **Remember:** `fields` → FK in _this_ model. `references` → PK/unique field in the _other_ model.

### Many-to-Many

```
User * ───────── * Course
```

#### 1. Implicit Many-to-Many

Prisma automatically manages the relation table for you.

```prisma
model User {
  id      Int      @id @default(autoincrement())
  courses Course[]
}

model Course {
  id      Int    @id @default(autoincrement())
  members User[]
}
```

Use this when you only need the relationship itself, with no extra data attached to it.

#### 2. Explicit Many-to-Many

Define the relation table yourself — needed when the relationship carries extra information (e.g. a `role`).

```
User ─── Course
       ↑
      role
```

A given user might be a `STUDENT` in one course and a `TEACHER` in another, so `role` belongs to the _relationship_, not to `User` or `Course` alone.

```prisma
model CourseEnrollment {
  createdAt DateTime @default(now())
  role      UserRole

  userId   Int
  user     User @relation(fields: [userId], references: [id])

  courseId Int
  course   Course @relation(fields: [courseId], references: [id])

  @@id([userId, courseId])
  @@index([userId, role])
}

enum UserRole {
  STUDENT
  TEACHER
}
```

This turns the single M:N relationship into two 1:N relationships:

```
User 1 ─── * CourseEnrollment * ─── 1 Course
```

#### Composite / Multi-Field Primary Key

```prisma
@@id([userId, courseId])
```

This means `userId` + `courseId` **together** form ONE primary key (not two separate ones).

| userId | courseId | Valid?       |
| ------ | -------- | ------------ |
| 1      | 101      | ✅           |
| 1      | 102      | ✅           |
| 2      | 101      | ✅           |
| 1      | 101      | ❌ duplicate |

This guarantees a user can only be enrolled in the same course once.

- Why not `userId` alone as PK? A user can join _multiple_ courses.
- Why not `courseId` alone as PK? A course can have _multiple_ users.
- So: `userId + courseId` = unique combination.

#### Enums

```prisma
enum UserRole {
  STUDENT
  TEACHER
}
```

An enum restricts a field to a predefined set of values — `role` can only ever be `STUDENT` or `TEACHER`.

#### Indexes

```prisma
@@index([userId, role])
```

Creates a database index on `userId` + `role`, telling PostgreSQL:

> "I'll often search using `userId` and `role`, so create an index to make those lookups faster."

This helps queries like _"find all teachers/students for a particular user"_ run efficiently.

> You don't need to deeply understand index optimization yet — just remember: **index → faster lookups/queries.**

---

## Migrating the Database

Once your models are defined in `schema.prisma`, use Prisma Migrate to create/update the actual PostgreSQL tables.

```bash
npx prisma migrate dev --name init
```

**What it does:**

1. **Creates a migration** — Prisma compares your schema to the database and generates the required SQL.
2. **Saves the migration** — the SQL is saved to:

   ```
   prisma/
   └── migrations/
       └── 20260829120000_init/
           └── migration.sql
   ```

3. **Runs the migration** — Prisma executes that SQL against your PostgreSQL database.

```
schema.prisma
      ↓
Generate migration.sql
      ↓
Run SQL
      ↓
PostgreSQL database updated
```

### `migrate` vs `generate`

| Command                              | Purpose                       |
| ------------------------------------ | ----------------------------- |
| `npx prisma migrate dev --name init` | Updates the **database**      |
| `npx prisma generate`                | Updates the **Prisma Client** |

- **`migrate`** → _"Update my PostgreSQL database according to my schema."_ Creates and runs `prisma/migrations/.../migration.sql`.
- **`generate`** → _"Update the Prisma Client so my TypeScript code knows about my latest models."_

---

## Generating Prisma Client

Prisma Client is a **type-safe database client** generated from `schema.prisma`, giving TypeScript autocomplete and type checking against your database.

```bash
npx prisma generate
```

```
schema.prisma
      ↓
npx prisma generate
      ↓
Generated Prisma Client
      ↓
Use in TypeScript
```

With Prisma 7, the generated client is placed in your configured output folder — e.g. `generated/prisma/`.

> Whenever you change your Prisma schema, re-run `npx prisma generate`.

**Remember:**

- `migrate` → updates the PostgreSQL database
- `generate` → updates the Prisma Client for your TypeScript code

---

## Seeding the Database

Seeding means inserting initial/sample data into the database using Prisma Client.

### 1. Register the Seed Script

In `prisma.config.ts`:

```ts
migrations: {
  path: "prisma/migrations",
  seed: "tsx prisma/seed.ts",
}
```

This tells the Prisma CLI how to run the seed file.

### 2. Create a Prisma Client in `seed.ts`

```ts
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });
```

| Part            | Meaning                                           |
| --------------- | ------------------------------------------------- |
| `dotenv/config` | Loads `.env`                                      |
| `PrismaPg`      | PostgreSQL adapter                                |
| `PrismaClient`  | Generated client used for database queries        |
| `adapter`       | Connects Prisma Client to PostgreSQL through `pg` |
| `DATABASE_URL`  | PostgreSQL connection string                      |

#### What does `!` mean?

```ts
process.env.DATABASE_URL!;
```

The `!` is TypeScript's **non-null assertion operator**. It tells TypeScript: _"I know `DATABASE_URL` exists — don't complain that it might be `undefined`."_ It does **not** create or validate the variable itself.

### 3. Seed Structure

```ts
async function main() {
  // seed operations
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
```

- `main()` → contains all seed operations
- `$disconnect()` → closes the database connection
- `.catch()` → handles errors

### 4. Create Data

```ts
const grace = await prisma.user.create({
  data: {
    email: "grace@hey.com",
    firstName: "Grace",
    lastName: "Bell",
    social: {
      bluesky: "gracebell",
      linkedin: "gracebell",
    },
  },
});
```

```
prisma.user.create()
       ↓
PostgreSQL User table
       ↓
New row created
       ↓
Created User returned → grace
```

The operation creates a row in the `User` table and returns the created user, including the auto-generated `id`. The returned `grace` value is fully typed — the `User` type is exported from your generated client:

```ts
import type { User } from "../generated/prisma/client";
```

### 5. Run the Seed

```bash
npx prisma db seed
```

This executes `prisma/seed.ts` and inserts the sample data.

### 6. Clear Data Before Re-seeding

Running the seed multiple times can hit `@unique` constraint errors, so delete existing data first. **Delete dependent/child records first** because of foreign keys:

```ts
await prisma.testResult.deleteMany({});
await prisma.courseEnrollment.deleteMany({});
await prisma.test.deleteMany({});
await prisma.user.deleteMany({});
await prisma.course.deleteMany({});
```

Deletion order: `TestResult` → `CourseEnrollment` → `Test` → `User` → `Course`.

`deleteMany({})` deletes **all** rows from that table.

---

## Nested Writes (`create` vs `connect`)

A **nested write** lets Prisma create a record and its related records in a single operation.

### Example: Create a Course with Tests and a Teacher Enrollment

```ts
// 1. Calculate future dates
const weekFromNow = addDays(new Date(), 7);
const twoWeeksFromNow = addDays(new Date(), 14);
const monthFromNow = addDays(new Date(), 28);
```

`addDays(date, days)` returns a new `Date` after adding the given number of days.

```ts
// 2. Create Course + Tests + Enrollment
const course = await prisma.course.create({
  data: {
    name: "CRUD with Prisma",

    tests: {
      create: [
        { date: weekFromNow, name: "First test" },
        { date: twoWeeksFromNow, name: "Second test" },
        { date: monthFromNow, name: "Final exam" },
      ],
    },

    members: {
      create: {
        role: "TEACHER",
        user: {
          connect: { email: grace.email },
        },
      },
    },
  },

  include: {
    tests: true,
  },
});
```

**What happens in one operation:**

```
Course
  │
  ├── Test 1
  ├── Test 2
  ├── Test 3
  │
  └── CourseEnrollment
        ├── user → Grace
        └── role → TEACHER
```

- 1 row → `Course`
- 3 rows → `Test`
- 1 row → `CourseEnrollment`

### `create` vs `connect`

| Operation                         | Meaning                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `create: { name: "First test" }`  | Create a **new** database row                                           |
| `connect: { email: grace.email }` | Find an **existing** row and link to it (does _not_ create Grace again) |

`create` and `connect` are **not alternatives** — they can be combined because they do different jobs, as in the `members` block above:

```
Existing User
    Grace
      │
      │ connect
      ↓
CourseEnrollment
    role = TEACHER
      │
      ↓
New Course
```

### `include`

```ts
include: {
  tests: true,
}
```

`include` tells Prisma: _after creating the course, also return its related tests in the result._

- Without `include` → you mainly get the created `Course`.
- With `include: { tests: true }` → you get the `Course` **plus** its `Test`s.

### Creating a Second User and Enrolling Them

```ts
const shakuntala = await prisma.user.create({
  data: {
    email: "devi@prisma.io",
    firstName: "Shakuntala",
    lastName: "Devi",

    courses: {
      create: {
        role: "STUDENT",

        course: {
          connect: { id: course.id },
        },
      },
    },
  },
});
```

In the `User` model, `courses` represents `CourseEnrollment[]`, not `Course[]`. So:

- `courses: { create: { ... } }` → creates a new row in `CourseEnrollment` for the new user.
- `role: "STUDENT"` → sets the user's role for that course.
- `course: { connect: { id: course.id } }` → connects the new `CourseEnrollment` row to an **existing** `Course`.

### Adding Test Results

`TestResult` relates to **three** models:

- `User` (as `gradedBy`) → the teacher who graded it
- `User` (as `student`) → the student who received the result
- `Test` → the test being graded

```ts
await prisma.testResult.create({
  data: {
    gradedBy: {
      connect: { email: grace.email },
    },
    student: {
      connect: { email: shakuntala.email },
    },
    test: {
      connect: { id: test.id },
    },
    result: 950,
  },
});
```

```
TestResult
   │
   ├── gradedBy → existing Grace
   ├── student  → existing Shakuntala
   └── test     → existing Test
```

The `connect` calls don't create new users/tests — they link the new `TestResult` row to rows that already exist.

### Creating Results for Multiple Tests

Store results in an array, where each position corresponds to a test:

```ts
const testResultsShakuntala = [800, 950, 910];
```

| Index | Result | Test        |
| ----- | ------ | ----------- |
| 0     | 800    | First test  |
| 1     | 950    | Second test |
| 2     | 910    | Final test  |

Loop through the tests using a counter to match each test with its result:

```ts
let counter = 0;

for (const test of course.tests) {
  await prisma.testResult.create({
    data: {
      gradedBy: { connect: { email: grace.email } },
      student: { connect: { email: shakuntala.email } },
      test: { connect: { id: test.id } },
      result: testResultsShakuntala[counter],
    },
  });
  counter++;
}
```

This creates one `TestResult` row per test:

```
Test 1 → Shakuntala → 800
Test 2 → Shakuntala → 950
Test 3 → Shakuntala → 910
```

**Remember:**

- `create()` → creates a new database row
- `connect()` → connects to an existing row
- `array[index]` → gets a value at a given position
- `counter` → tracks the current position in the loop
- `counter++` → advances to the next position
- `result: testResultsShakuntala[counter]` → matches the correct result to the current test

---

## Prisma Studio

After seeding, view your data visually with:

```bash
npx prisma studio
```

---

## Prisma Aggregation

### 1. `aggregate()` — Get Statistics

`aggregate()` calculates summary values across multiple rows.

| Operation | Meaning        |
| --------- | -------------- |
| `_avg`    | Average        |
| `_max`    | Highest value  |
| `_min`    | Lowest value   |
| `_count`  | Number of rows |

**Example — results for one test:**

```ts
const results = await prisma.testResult.aggregate({
  where: {
    testId: test.id,
  },
  _avg: { result: true },
  _max: { result: true },
  _min: { result: true },
  _count: true,
});
```

This asks: _"Find all `TestResult` rows for this test and calculate their average, highest, lowest, and total count."_

If a test has:

| Student    | Result |
| ---------- | ------ |
| David      | 650    |
| Shakuntala | 800    |

Then:

```
_avg   = 725
_max   = 800
_min   = 650
_count = 2
```

`_count = 2` because two rows matched the query.

### 2. Student-wise Aggregation

You can also compute statistics for a single student:

```ts
const davidAggregates = await prisma.testResult.aggregate({
  where: {
    student: { email: david.email },
  },
  _avg: { result: true },
  _max: { result: true },
  _min: { result: true },
  _count: true,
});
```

This asks: _"Find all of David's test results and calculate his average, highest, lowest, and number of tests."_

Example — David: `650, 900, 950`

```
Average = 833.33
Maximum = 950
Minimum = 650
Count   = 3
```

`aggregate()` is useful whenever you want statistics for one particular group/entity — e.g. average marks for one test, average performance for one student, or total students in one course.

### 3. `groupBy()` — Aggregate Many Groups at Once

Instead of calling `aggregate()` separately for every test in a loop:

```ts
for (const test of course.tests) {
  // aggregate for each test
}
```

use a single `groupBy()` call:

```ts
const resultsByTest = await prisma.testResult.groupBy({
  by: ["testId"],
  _avg: { result: true },
  _max: { result: true },
  _min: { result: true },
  _count: true,
});
```

`by: ["testId"]` means: _"Group all `TestResult` rows that share the same `testId` together."_

**Example data:**

| testId | student    | result |
| ------ | ---------- | ------ |
| 1      | David      | 650    |
| 1      | Shakuntala | 800    |
| 2      | David      | 900    |
| 2      | Shakuntala | 950    |
| 3      | David      | 950    |
| 3      | Shakuntala | 910    |

`groupBy(["testId"])` produces:

```
Group 1 → testId 1 → 650, 800
Group 2 → testId 2 → 900, 950
Group 3 → testId 3 → 950, 910
```

Prisma then calculates `_avg`, `_max`, `_min`, and `_count` for **each** group.

**Why use `groupBy()`?**

Without it, 100 tests would require 100 separate queries:

```
Test 1 → query
Test 2 → query
...
Test 100 → query
```

With `groupBy()`:

```
100 tests
   ↓
ONE groupBy query
   ↓
Results grouped by testId
```

**Summary:**

- `aggregate()` → statistics for one specific set of rows
- `groupBy()` → splits rows into groups and calculates statistics for every group in a single query
