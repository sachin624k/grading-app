import { Hono } from "hono";

const users = new Hono();

users.get("/users", (c) => {
  return c.json({
    message: "Users route is working",
  });
});

export default users;
