import { api, prisma } from "../..";
import { updateHome } from "../../home";

api.get("/api/spotify/callback", async (req, res) => {
  const error = req.query.error;
  if (error) return res.status(400).send(`${error}, womp womp`);
  const code = req.query.code as string;
  const state = req.query.state as string;
  if (!code || !state) return res.status(400).send("missing code or state");
  const user = await prisma.user.findFirst({ where: { linkingToken: state } });
  if (!user) return res.status(400).send("invalid state");
  const tokenRequest = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
      ).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${process.env.SELF_URL}/api/spotify/callback`,
    }),
  });
  const tokenResponse = (await tokenRequest.json()) as {
    access_token: string;
    expires_in: string;
    refresh_token: string;
  };
  if (!tokenResponse?.refresh_token)
    return res.status(500).send("no access token");
  await prisma.user.update({
    where: { id: user.id },
    data: {
      accessToken: tokenResponse.access_token,
      expiresAt: new Date(
        Date.now() + parseInt(tokenResponse.expires_in, 10) * 1000
      ),
      refreshToken: tokenResponse.refresh_token,
      linkingToken: null,
    },
  });
  res.send("authed! go back to slack now");
  await updateHome(user.id);
});
