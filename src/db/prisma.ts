import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const Prisma = require("@prisma/client");

export const prisma = new Prisma.PrismaClient();
