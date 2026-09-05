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

  test("GET /users/:userId returns 404 for a non-existent user", async () => {
    const res = await app.request("/users/999999");
    expect(res.status).toBe(404);
  });

  test("GET /users/:userId returns the user", async () => {
    const res = await app.request(`/users/${userId}`);
    expect(res.status).toBe(200);
    const user = await res.json();
    expect(user.id).toBe(userId);
  });

  test("PUT /users/:userId fails with 400 for an invalid id", async () => {
    const res = await app.request("/users/aa22", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: "x" }),
    });
    expect(res.status).toBe(400);
  });

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

  test("DELETE /users/:userId fails with 400 for an invalid id", async () => {
    const res = await app.request("/users/aa22", { method: "DELETE" });
    expect(res.status).toBe(400);
  });

  test("DELETE /users/:userId deletes the user", async () => {
    const res = await app.request(`/users/${userId}`, { method: "DELETE" });
    expect(res.status).toBe(204);
  });
});
