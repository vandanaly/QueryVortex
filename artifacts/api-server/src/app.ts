// @ts-nocheck
import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes/main.js";
import { logger } from "./lib/logger.js";

// Handle module interop for pino-http
const pinoMiddleware = typeof pinoHttp === "function" ? pinoHttp : (pinoHttp as any).default || pinoHttp;

const app: Express = express();

app.use(
  pinoMiddleware({
    logger,
    serializers: {
      req(req: any) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: any) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  })
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req: Request, res: Response) => {
  res.status(200).json({ status: "API is running successfully" });
});

app.use("/api", router);

export default app;
