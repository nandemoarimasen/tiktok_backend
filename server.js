require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { Server } = require("socket.io");
const http = require("http");
const { chromium } = require("playwright");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log("MongoDB Connected"))
  .catch(err => console.error(err));

const TikTokVideoSchema = new mongoose.Schema({
    title: String,
    views: String,
    timestamp: { type: Date, default: Date.now }
});
const TikTokVideo = mongoose.model("TikTokVideo", TikTokVideoSchema);

app.use(cors());
app.use(express.json());

app.get("/api/tiktok", async (req, res) => {
    const videos = await TikTokVideo.find().sort({ timestamp: -1 }).limit(10);
    res.json(videos);
});

io.on("connection", (socket) => {
    console.log("Client connected to WebSocket");

    setInterval(async () => {
        const videos = await TikTokVideo.find().sort({ timestamp: -1 }).limit(10);
        socket.emit("updateData", videos);
    }, 30000);
});

const scrapeTikTok = async () => {
    console.log("Launching Playwright...");

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        await page.goto("https://www.tiktok.com/@therock", { waitUntil: "networkidle" });

        const data = await page.evaluate(() => {
            return Array.from(document.querySelectorAll(".tiktok-video-selector")).map(video => ({
                title: video.querySelector(".video-title")?.innerText || "No Title",
                views: video.querySelector(".video-views")?.innerText || "No Views"
            }));
        });

        console.log("TikTok data scraped:", data);

        await TikTokVideo.insertMany(data);
        console.log("TikTok data saved to MongoDB.");
    } catch (error) {
        console.error("Error scraping TikTok:", error);
    }

    await browser.close();
};

// Run scraper every 1 minute
setInterval(scrapeTikTok, 60000);

server.listen(5000, () => console.log("Server running on port 5000"));
