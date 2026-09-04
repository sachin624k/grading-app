import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppEnv } from "../lib/prisma";

const users = new Hono<AppEnv>();

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

users.post("/users", zValidator("json", userSchema), async (c) => {
  const prisma = c.get("prisma");
  const data = c.req.valid("json");

  const createdUser = await prisma.user.create({
    data,
    select: { id: true },
  });

  return c.json(createdUser, 201);
});

export default users;
