import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/streamlit-url", async (req, res): Promise<void> => {
  const streamlitPort = process.env.STREAMLIT_PORT ?? "8501";
  const replDomain = process.env.REPLIT_DEV_DOMAIN;
  
  if (replDomain) {
    res.json({
      url: `https://${replDomain}/streamlit`,
      available: true,
    });
  } else {
    res.json({
      url: `http://localhost:${streamlitPort}`,
      available: true,
    });
  }
});

export default router;
