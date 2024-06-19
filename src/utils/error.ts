import { RespondFn } from "@slack/bolt";
import { bolt } from "..";

export const yellAboutError = (e: any, respond: RespondFn | string) => {
  if (typeof respond === "string") {
    bolt.client.views.publish({
      user_id: respond,
      view: {
        type: "home",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `oh gee, an error. try again, and if that doesn't work try authing again. and if that doesn't work yell at dominic.\nhere's the error:\n\`\`\`${e}\`\`\``,
            },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "try again",
                },
                action_id: "home_retry",
              },
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "auth again",
                },
                action_id: "auth_clear",
              },
            ],
          },
        ],
      },
    });
  } else {
    respond({
      text: `oh no, an error. try again, and if that doesn't work go to my home and auth again. and if that doesn't work yell at dominic.\nhere's the error:\n\`\`\`${e}\`\`\``,
    });
  }
};
