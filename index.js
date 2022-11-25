const fs = require('fs');
const path = require('path')
const ytdl = require('ytdl-core');
const YouTubeAPI = require('simple-youtube-api');
const youtube = new YouTubeAPI(process.env.YOUTUBE_API_KEY);
const express = require('express');
const stream = require('express-stream');
const app = express();
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
const cron = require('node-cron');

function clearFiles() {
  fs.readdir("./tmp", function(err, files) {
    if (err) {
      throw err;
    }
    files.forEach(function(file) {
      fs.unlink(`./tmp/${file}`, function(err) {
        if (err) {
          throw (err);
        }
      });
    });
  });
}
clearFiles();
cron.schedule('*/30 * * * *', () => {
  clearFiles();
});

app.get('/api/ytdl/:youtubeId', async function(req, res) {
  const { youtubeId } = req.params;
  let fileType = req.query.fileType || 'mp4';
  if (fileType !== 'mp4') {
    if (fileType !== 'mp3') {
      fileType = 'mp4';
    }
  }
  const destFilePath = path.resolve(__dirname, `./tmp/${youtubeId}.${fileType}`);
  let info = await ytdl.getInfo(youtubeId);
  let data = await youtube.getVideo(info.videoDetails.video_url);
  if (fs.existsSync(destFilePath)) {
    res.download(destFilePath, data.title)
    return;
  }
  let stream = null;
  stream = ytdl(info.videoDetails.video_url, { filter: (format) => format.container === "mp4", highWaterMark: 32 * 1024 * 1024 })
  if (fileType === 'mp3') {
    ffmpeg(stream)
      .audioBitrate(128)
      .save(destFilePath)
      .on('error', (err) => {
        console.error(err);
        res.status(400).send('download error!');
      })
      .on('end', () => {
        console.log(`${youtubeId}.${fileType} downloaded.`);
        res.download(destFilePath, data.title + '.mp4');
        return;
      });
  } else {
    stream.pipe(fs.createWriteStream(destFilePath))

    stream.on('error', (err) => {
      console.error(err);
      res.status(400).send('download error!');
    });
    stream.on('end', () => {
      console.log(`${youtubeId}.${fileType} downloaded.`);
      res.download(destFilePath, data.title + '.mp4');

      return;
    })
  }
});

app.use(express.static('html_files'))
app.use('/images', express.static('html_files'))

app.get('/', async function(req, res) {
  res.sendfile('.html_files/index.html')
});

app.listen(8080, function() {
  console.log('[NodeJS] Application Listening on Port 8080');
});
