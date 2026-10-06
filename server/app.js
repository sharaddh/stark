const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const multer = require("multer");

dotenv.config();

const app = express();

connectDB();

app.disable("x-powered-by");
// We sit behind a reverse proxy in production; without this, rate limiting
// would key on the proxy IP and let everyone share one bucket.
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

const allowedOrigins = [
  process.env.CLIENT_ORIGIN,
  "https://starkk.shop",
  "http://localhost:5173",
  "http://localhost:5174",
  "https://starkk.netlify.app",
  "https://stark-gamma.vercel.app",
  "https://kidney-1-b2qy.onrender.com",
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // No Origin header (server-to-server, curl) or a known frontend origin
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // Unknown origin: deny quietly instead of throwing a 500
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 43200,
}));

app.options("*", cors());

// Routes
const userAuthRoutes = require("./routes/userRouter");
const sellerAuthRoutes = require("./routes/sellerRouter");
const adminAuthRoutes = require("./routes/adminRouter");
const categoryRoutes = require("./routes/category");
const userrRoutes = require("./routes/userrr");

app.use("/api/user", userAuthRoutes);
app.use("/api/user/auth", userrRoutes);
app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/seller/auth", sellerAuthRoutes);
app.use("/api/categories", categoryRoutes);

app.use("*", (req, res) => {
  res.status(404).json({ message: "API route not found" });
});

// 404 handler above returns JSON; anything that reaches this point threw.
// Must be registered AFTER the routes so it can see their errors.
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: `Upload error: ${err.message}` });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ message: "Request body too large" });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON in request body" });
  }
  if (err.name === "CastError") {
    return res.status(400).json({ message: "Invalid identifier supplied" });
  }
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({
    message: "Internal server error",
    ...(process.env.NODE_ENV !== "production" ? { error: err.message } : {}),
  });
});

module.exports = app;
