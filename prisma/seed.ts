import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

async function main() {
  // Seed operations go here, step by step below
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
  //   await prisma.testResult.deleteMany({});
  //   await prisma.courseEnrollment.deleteMany({});
  //   await prisma.test.deleteMany({});
  //   await prisma.user.deleteMany({});
  //   await prisma.course.deleteMany({});
  const weekFromNow = addDays(new Date(), 7);
  const twoWeeksFromNow = addDays(new Date(), 14);
  const monthFromNow = addDays(new Date(), 28);

  const course = await prisma.course.create({
    data: {
      name: "CRUD with Prisma",
      tests: {
        create: [
          { date: weekFromNow, name: "First test" },
          { date: twoWeeksFromNow, name: "Second test" },
          { date: monthFromNow, name: "Final test" },
        ],
      },
      members: {
        create: {
          role: "TEACHER",
          user: {
            connect: {
              email: grace.email,
            },
          },
        },
      },
    },
    include: {
      tests: true,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1); // tells the operation system: "The program failed", 0 generally means success, while 1 indicates failure.
  });
