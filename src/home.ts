import { SpotifyApi } from "@spotify/web-api-ts-sdk";
import { bolt, prisma } from ".";
import env from "./utils/env";
import { getUser } from "./utils/user-token";

bolt.event("app_home_opened", async ({ event }) => {
  await updateHome(event.user);
});

export async function updateHome(userId: string) {
  const user = await getUser(userId);
  if (user.accessToken && user.refreshToken && user.expiresAt) {
    const expiresIn = (user.expiresAt.getTime() - Date.now()) / 1000;
    const spotify = SpotifyApi.withAccessToken(env.SPOTIFY_CLIENT_ID, {
      access_token: user.accessToken,
      expires_in: expiresIn,
      refresh_token: user.refreshToken,
      token_type: "Bearer",
    });
    const playlists = await spotify.currentUser.playlists.playlists();
    const playlistBlocks = playlists.items.map((playlist) => ({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `<${playlist.external_urls.spotify}|${playlist.name}>`,
      },
    }));
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
          ...playlistBlocks,
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
}
