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

// Take userSchema and make all its fields optional for the update route.
const updateUserSchema = userSchema.partial();

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

// Zod schema for URL parameters.
const userIdParam = z.object({
  // Coerce the userId parameter to a number and ensure it's an integer.
  userId: z.coerce.number().int(),
});

users.get("/users/:userId", zValidator("param", userIdParam), async (c) => {
  const prisma = c.get("prisma");
  const { userId } = c.req.valid("param");

  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    return c.body(null, 404);
  }

  return c.json(user, 200);
});

users.delete("/users/:userId", zValidator("param", userIdParam), async (c) => {
  const prisma = c.get("prisma");
  const { userId } = c.req.valid("param");

  await prisma.user.delete({ where: { id: userId } });

  return c.body(null, 204);
});

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
