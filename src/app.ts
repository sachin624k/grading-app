import { Hono } from "hono";
import { withPrisma, type AppEnv } from "./lib/prisma";
import status from "./routes/status";
import users from "./routes/users";

const app = new Hono<AppEnv>();

app.use("*", withPrisma);

app.route("/", status);
app.route("/", users);

export default app;
