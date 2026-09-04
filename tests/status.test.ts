import { describe, test, expect } from "vitest";
import app from "../src/app";

describe("Status route", () => {
  test("GET / returns 200 and { up: true }", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ up: true });
  });
});
