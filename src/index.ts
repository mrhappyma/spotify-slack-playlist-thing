import { App, ExpressReceiver } from "@slack/bolt";
import env from "./utils/env";
import { PrismaClient } from "@prisma/client";
import { fieldEncryptionExtension } from "prisma-field-encryption";

console.log("vroom vroom");

const globalPrismaClient = new PrismaClient();
export const prisma = globalPrismaClient.$extends(
  fieldEncryptionExtension({
    encryptionKey: env.ENCRYPTION_KEY,
  })
);

const expressReceiver = new ExpressReceiver({
  signingSecret: env.SLACK_SIGNING_SECRET,
  endpoints: "/api/slack/events",
  processBeforeResponse: true,
});
export const api = expressReceiver.app;

export const bolt = new App({
  token: env.SLACK_TOKEN,
  signingSecret: env.SLACK_SIGNING_SECRET,
  receiver: expressReceiver,
});
bolt.start(parseInt(env.PORT, 10));

import "./api";
import "./home";
