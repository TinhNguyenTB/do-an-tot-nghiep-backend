import { CorsOptions } from "cors";

export const corsConfig: CorsOptions = {
  origin: process.env.CLIENT_URL,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  credentials: true, // nếu cần gửi cookie,
};
