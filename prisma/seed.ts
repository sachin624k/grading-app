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

  const david = await prisma.user.create({
    data: {
      email: "david@prisma.io",
      firstName: "David",
      lastName: "Deutsch",
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

  // await prisma.testResult.create({
  //   data: {
  //     gradedBy: {
  //       connect: { email: grace.email },
  //     },
  //     student: {
  //       connect: { email: shakuntala.email },
  //     },
  //     test: {
  //       connect: { id: course.tests[0].id },
  //     },
  //     result: 950,
  //   },
  // });

  const testResultsDavid = [650, 900, 950];
  const testResultsShakuntala = [800, 950, 910];

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

    await prisma.testResult.create({
      data: {
        gradedBy: { connect: { email: grace.email } },
        student: { connect: { email: david.email } },
        test: { connect: { id: test.id } },
        result: testResultsDavid[counter],
      },
    });

    counter++;
  }

  // for (const test of course.tests) {
  //   const results = await prisma.testResult.aggregate({
  //     where: {
  //       testId: test.id,
  //     },
  //     _avg: { result: true },
  //     _max: { result: true },
  //     _min: { result: true },
  //     _count: true,
  //   });
  //   console.log(`test: ${test.name} (id: ${test.id})`, results);
  // }

  // Get aggregates for David
  // const davidAggregates = await prisma.testResult.aggregate({
  //   where: {
  //     student: { email: david.email },
  //   },
  //   _avg: { result: true },
  //   _max: { result: true },
  //   _min: { result: true },
  //   _count: true,
  // });
  // console.log(`David's results (email: ${david.email})`, davidAggregates);

  // Get aggregates for Shakuntala
  // const shakuntalaAggregates = await prisma.testResult.aggregate({
  //   where: {
  //     student: { email: shakuntala.email },
  //   },
  //   _avg: { result: true },
  //   _max: { result: true },
  //   _min: { result: true },
  //   _count: true,
  // });
  // console.log(
  //   `Shakuntala's results (email: ${shakuntala.email})`,
  //   shakuntalaAggregates,
  // );

  const resultsByTest = await prisma.testResult.groupBy({
    by: ["testId"],
    _avg: { result: true },
    _max: { result: true },
    _min: { result: true },
    _count: true,
  });
  console.log(resultsByTest);
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
