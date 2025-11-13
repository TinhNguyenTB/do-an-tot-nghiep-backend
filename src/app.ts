import "dotenv/config";
import express from "express";
import router from "@/routes";
import { logger } from "@/utils/logger";
import { exceptionFilter } from "@/middlewares/exception-filter.middleware";
import { responseTransformInterceptor } from "@/middlewares/intercept.middleware";
import cors from "cors";
import { corsConfig } from "@/configs/cors.config";

const app = express();

// Cấu hình CORS
app.use(cors(corsConfig));

app.use(express.json());

// Interceptor phải đặt trước routes
app.use(responseTransformInterceptor);

//Routes
app.use("/api", router);

// Global error handler — Đặt ở cuối cùng
app.use(exceptionFilter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.success(`🚀 Server is running on port ${PORT}`);
});
