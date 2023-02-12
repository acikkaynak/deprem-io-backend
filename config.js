require("dotenv").config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 80,
  mongoUrl: process.env.MONGOURL || "mongodb://localhost:27017",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  NODE_ENV: process.env.NODE_ENV || "development",
  exportEmails: process.env.EXPORT_EMAILS || "istenilenstaticemail@mail.com",
  emailProviderAPIKey: process.env.EMAIL_PROVIDER_API_KEY || "",
};
