import { Hono } from "hono";
import type { AppEnv } from "../lib/prisma";

// Create a separate Hono instance for status-related routes.
const status = new Hono<AppEnv>();

status.get("/", (c) => {
  return c.json({ up: true }, 200);
});

export default status;
