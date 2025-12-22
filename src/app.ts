import "dotenv/config";
import "reflect-metadata";
import express from "express";
import router from "@/routes";
import { logger } from "@/utils/logger";
import { exceptionFilter } from "@/middlewares/exception-filter.middleware";
import { responseTransformInterceptor } from "@/middlewares/intercept.middleware";
import cors from "cors";
import { corsConfig } from "@/configs/cors.config";
import prisma from "@/prismaClient";
import { webhookRoute } from "@/routes/webhook.route";
import cookieParser from "cookie-parser";

const app = express();

// Cấu hình CORS
app.use(cors(corsConfig));
app.use(cookieParser());
app.use("/api/webhook", webhookRoute);

app.use(express.json());

// Interceptor phải đặt trước routes
app.use(responseTransformInterceptor);

//Routes
app.use("/api", router);

// Global error handler — Đặt ở cuối cùng
app.use(exceptionFilter);

const PORT = process.env.PORT || 3000;
async function startServer() {
  try {
    // Thử kết nối DB (tối đa 30 giây)
    await prisma.$connect();
    logger.success("✅ Prisma connected to database successfully!");

    // Bắt đầu lắng nghe request
    const server = app.listen(PORT, () => {
      logger.success(`🚀 Server is running on http://localhost:${PORT}`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      logger.warn("Shutting down gracefully...");
      server.close(async () => {
        await prisma.$disconnect();
        logger.info("Prisma disconnected");
        process.exit(0);
      });
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (error) {
    logger.error("❌ Failed to connect to database!");
    console.error(error);

    // Nếu DB không kết nối được → thoát luôn, không chạy server
    process.exit(1);
  }
}

// Gọi hàm khởi động
startServer();
