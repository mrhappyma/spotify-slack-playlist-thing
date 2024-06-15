import { prisma } from "..";

export const getUser = async (userId: string) => {
  //TODO: error handling
  //rn if they remove the spotify auth its really not good
  const date = new Date();
  let user = await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId },
  });
  if (!user.refreshToken) return user;
  if (user.expiresAt && user.expiresAt < date) {
    const tokenRequest = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: user.refreshToken,
      }),
    });
    const tokenResponse = (await tokenRequest.json()) as {
      access_token: string;
      expires_in: string;
    };
    if (!tokenResponse?.access_token) return user;
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        accessToken: tokenResponse.access_token,
        expiresAt: new Date(
          Date.now() + parseInt(tokenResponse.expires_in, 10) * 1000
        ),
      },
    });
  }
  return user;
};
