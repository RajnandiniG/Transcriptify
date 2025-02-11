const express = require("express");
const cors = require("cors");
const speech = require("@google-cloud/speech");
const multer = require("multer");
const fs = require ("fs");
const path = require("path");
const ffmpegPath = require("ffmpeg-static");
const ffmpeg = require("fluent-ffmpeg");
const { text } = require("body-parser");
const { error } = require("console");

const app = express();

app.use(cors());

const client = new speech.SpeechClient({
    keyFilename:"./gen-lang-client-0854526637-719454a17222.json"
})

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./uploads")
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '_' + Date.now() + path.extname(file.originalname))
    }
})

const upload = multer({
    storage: storage
});

ffmpeg.setFfmpegPath(ffmpegPath)

app.get("/", (req,res) => {
    res.send("Welcome to our AI Transcription API")
})

app.post("/transcribe", upload.single("file"), async (req,res) => {

    if(!req.file) {
        return res.status(400).send("No file uploaded");
    }

    const videoFilePath = req.file.path;
    const audioFilePath = `${videoFilePath}.wav`;

    ffmpeg(videoFilePath)
    .toFormat("wav")
    .audioCodec("pcm_s16le")
    .audioFrequency(16000)
    .audioChannels(1)
    .on("end", async () => {
        const audioBytes = fs.readFileSync(audioFilePath).toString("base64");

        const request = {
            audio: {
                content: audioBytes
            },
            config: {
                encoding: "LINEAR16",
                sampleRateHertz: 16000,
                languageCode: "en-US"
            }
        }

        try {

           const [response] = await client.recognize(request); //response comes as an array

           const transcription = response.results.map(result => {
               return result.alternatives[0].transcript
           }).join("/n");

           fs.unlinkSync(videoFilePath);
           fs.unlinkSync(audioFilePath);

           res.send({
            text: transcription
           });

        }
        catch(error) {
            console.error(`API error: ${error}`);
            res.status(500).send(`Error transcribing video: ${error.message}`)
        }
    })
    .on("error", (error) => {
        console.error("Error extracting audio", error);

        res.status(500).send("Error processing video");
    })
    .save(audioFilePath);

})

const PORT = process.env.PORT || 1330;

app.listen(PORT, ()=> {
    console.log(`Server is running on port: ${PORT}`);
})
