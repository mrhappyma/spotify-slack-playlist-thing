import { SpotifyApi } from "@spotify/web-api-ts-sdk";
import { bolt, prisma } from ".";
import env from "./utils/env";
import { getUser } from "./utils/user-token";
import { BlockAction, StaticSelectAction } from "@slack/bolt";
import { AlbumBehavior } from "@prisma/client";
import { yellAboutError } from "./utils/error";

bolt.event("app_home_opened", async ({ event }) => {
  await updateHome(event.user);
});

export async function updateHome(userId: string) {
  try {
    const user = await getUser(userId);
    if (user.accessToken && user.refreshToken && user.expiresAt) {
      const expiresIn = (user.expiresAt.getTime() - Date.now()) / 1000;
      const spotify = SpotifyApi.withAccessToken(env.SPOTIFY_CLIENT_ID, {
        access_token: user.accessToken,
        expires_in: expiresIn,
        refresh_token: user.refreshToken,
        token_type: "Bearer",
      });
      const me = await spotify.currentUser.profile();
      const playlists = await spotify.currentUser.playlists.playlists();
      const editablePlaylists = playlists.items.filter(
        (playlist) => playlist.owner.id === me.id || playlist.collaborative
      );
      const playlistSelect = {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "where should i put songs?",
        },
        accessory: {
          type: "static_select",
          placeholder: {
            type: "plain_text",
            text: "pick a playlist",
          },
          options: editablePlaylists.map((playlist) => ({
            text: {
              type: "plain_text",
              text: playlist.name.length > 0 ? playlist.name : "untitled",
            },
            value: playlist.id,
          })),
          initial_option: user.playlistId
            ? {
                text: {
                  type: "plain_text",
                  text: playlists.items.find(
                    (playlist) => playlist.id === user.playlistId
                  )?.name,
                },
                value: user.playlistId,
              }
            : undefined,
          action_id: "playlist_select",
        },
      };
      const albumBehaviorSelect = {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "what should i do with albums?",
        },
        accessory: {
          type: "static_select",
          options: [
            {
              text: {
                type: "plain_text",
                text: "add them to that playlist",
              },
              value: "add",
            },
            {
              text: {
                type: "plain_text",
                text: "save them to my library",
              },
              value: "save",
            },
          ],
          initial_option: user.albumBehavior
            ? {
                text: {
                  type: "plain_text",
                  text:
                    user.albumBehavior === AlbumBehavior.ADD
                      ? "add them to that playlist"
                      : "save them to my library",
                },
                value:
                  user.albumBehavior === AlbumBehavior.ADD ? "add" : "save",
              }
            : undefined,
          action_id: "album_behavior_select",
        },
      };
      await bolt.client.views.publish({
        user_id: userId,
        view: {
          type: "home",
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `oh hey <@${userId}>, you've authed that's crazy`,
              },
            },
            playlistSelect,
            albumBehaviorSelect,
            {
              type: "divider",
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "sometimes reauthing helps fix errors",
              },
              accessory: {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "reauth",
                },
                value: "auth_clear",
              },
            },
          ],
        },
      });
      return;
    }
    if (!user.refreshToken && user.linkingToken) return;
    const linkingToken = Math.random().toString(36).substring(2, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { linkingToken },
    });
    await bolt.client.views.publish({
      user_id: userId,
      view: {
        type: "home",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `oh hey <@${userId}>, i do cool spotify stuff, auth me into your spotify pls`,
            },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "auth",
                },
                url: `${env.SELF_URL}/api/spotify/auth?t=${linkingToken}`,
              },
            ],
          },
        ],
      },
    });
  } catch (e) {
    yellAboutError(e, userId);
  }
}

bolt.action("playlist_select", async ({ ack, body }) => {
  await ack();
  const b = body as BlockAction<StaticSelectAction>;
  await prisma.user.update({
    where: { id: body.user.id },
    data: { playlistId: b.actions[0].selected_option!.value },
  });
  await updateHome(body.user.id);
});

bolt.action("album_behavior_select", async ({ ack, body }) => {
  await ack();
  const b = body as BlockAction<StaticSelectAction>;
  await prisma.user.update({
    where: { id: body.user.id },
    data: {
      albumBehavior:
        b.actions[0].selected_option!.value == "add"
          ? AlbumBehavior.ADD
          : AlbumBehavior.SAVE,
    },
  });
  await updateHome(body.user.id);
});

bolt.action("home_retry", async ({ ack, body }) => {
  await ack();
  await updateHome(body.user.id);
});

bolt.action("auth_clear", async ({ ack, body }) => {
  await ack();
  await prisma.user.update({
    where: { id: body.user.id },
    data: { accessToken: null, refreshToken: null, expiresAt: null },
  });
  await updateHome(body.user.id);
});
