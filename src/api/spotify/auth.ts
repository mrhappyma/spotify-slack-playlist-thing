import { api, prisma } from "../../";

api.get("/api/spotify/auth", async (req, res) => {
  const t = req.query.t as string;
  if (!t) return res.status(400).send("no linking token provided");
  const user = await prisma.user.findFirst({ where: { linkingToken: t } });
  if (!user) return res.status(400).send("invalid linking token");
  return res.redirect(
    `https://accounts.spotify.com/authorize?client_id=${process.env.SPOTIFY_CLIENT_ID}&response_type=code&redirect_uri=${process.env.SELF_URL}/api/spotify/callback&scope=playlist-read-private%20playlist-modify-private%20user-library-modify&state=${t}`
  );
});
