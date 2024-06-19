import { Block, KnownBlock, MessageShortcut } from "@slack/bolt";
import { bolt, prisma } from ".";
import { getUser } from "./utils/user-token";
import { AlbumBehavior } from "@prisma/client";
import { SpotifyApi } from "@spotify/web-api-ts-sdk";
import env from "./utils/env";
import { yellAboutError } from "./utils/error";

bolt.shortcut("save", async ({ ack, body, client, respond }) => {
  try {
    await ack();
    const b = body as MessageShortcut;
    const songsRegex = /open\.spotify\.com\/track\/([a-zA-Z0-9]+)/g;
    const albumsRegex = /open\.spotify\.com\/album\/([a-zA-Z0-9]+)/g;
    const songs = [...(b.message.text ?? "").matchAll(songsRegex)].map(
      (m) => m[1]
    );
    const albums = [...(b.message.text ?? "").matchAll(albumsRegex)].map(
      (m) => m[1]
    );
    if (songs.length === 0 && albums.length === 0) {
      await respond({
        text: "sorry bud, there aren't any songs in there",
      });
      return;
    }
    const user = await getUser(b.user.id);
    if (!user.accessToken || !user.refreshToken || !user.expiresAt) {
      await respond({
        text: "who are you? i don't know you, go to my home and do the auth",
      });
      return;
    }
    if (albums.length > 0 && !user.albumBehavior) {
      await respond({
        text: "idk what to do with albums, go to my home and set an album behavior",
      });
      return;
    }

    const expiresIn = (user.expiresAt.getTime() - Date.now()) / 1000;
    const spotify = SpotifyApi.withAccessToken(env.SPOTIFY_CLIENT_ID, {
      access_token: user.accessToken,
      expires_in: expiresIn,
      refresh_token: user.refreshToken,
      token_type: "Bearer",
    });

    if (albums.length > 0 && user.albumBehavior == AlbumBehavior.ADD) {
      for (const album of albums) {
        const albumTracks = await spotify.albums.tracks(album);
        if (!albumTracks.items) continue;
        const trackIds = albumTracks.items.map((track) => track.id);
        songs.push(...trackIds);
      }
    }
    if (songs.length > 0 && !user.playlistId) {
      await respond({
        text: "idk where to put these songs, go to my home and set a playlist",
      });
      return;
    }

    const responseBlocks: (Block | KnownBlock)[] = [];
    if (songs.length > 0) {
      const uris = songs.map((song) => `spotify:track:${song}`);
      await spotify.playlists.addItemsToPlaylist(user.playlistId!, uris);
      const playlist = await spotify.playlists.getPlaylist(user.playlistId!);
      responseBlocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `added ${songs.length} songs to <${playlist.external_urls.spotify}|${playlist.name}>`,
        },
      });
    }
    if (albums.length > 0 && user.albumBehavior == AlbumBehavior.SAVE) {
      await spotify.currentUser.albums.saveAlbums(albums);
      responseBlocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `saved ${albums.length} albums to your library`,
        },
      });
    }
    responseBlocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `that's pretty groovy`,
      },
    });

    await respond({
      text: "done!",
      blocks: responseBlocks,
    });
    await prisma.user.update({
      where: { id: user.id },
      data: {
        timesUsed: {
          increment: 1,
        },
        songsSaved: {
          increment: songs.length,
        },
        albumsSaved: {
          increment: albums.length,
        },
      },
    });
  } catch (e) {
    yellAboutError(e, respond);
  }
});
