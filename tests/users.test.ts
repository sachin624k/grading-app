import { describe, test, expect, afterAll } from "vitest";
import app from "../src/app";
import { prisma } from "../src/lib/prisma";

describe("User routes", () => {
  let userId: number;

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("POST /users creates a user", async () => {
    const res = await app.request("/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "test-first-name",
        lastName: "test-last-name",
        email: `test-${Date.now()}@prisma.io`,
        social: { bluesky: "thisisalice", website: "https://thisisalice.com" },
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    userId = body.id;
    expect(typeof userId).toBe("number");
  });
});

test("POST /users rejects invalid input with 400", async () => {
  const res = await app.request("/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lastName: "test-last-name",
      email: `test-${Date.now()}@prisma.io`,
    }),
  });

  expect(res.status).toBe(400);
});
