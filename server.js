require('dotenv').config()

const fs = require('fs')
const { join } = require('path')

const redis = require('redis')
const redisClient = redis.createClient()
redisClient.select(process.env.DATABASE)

const express = require('express')
const app = express()

const compression = require('compression')
const helmet = require('helmet')
const bodyParser = require("body-parser")
const cors = require('cors')

app.use(helmet())
app.use(cors())
app.use(compression())
app.use(bodyParser.json())
app.use('/file', express.static('songs'))
app.use(bodyParser.urlencoded({
    extended: false
}))
app.disable('etag')
app.disable('x-powered-by')

app.get('/play/:song', (req, res) => {
    let song = req.params.song
    if (!song) {
        res.status(400).end()
        return
    }
    let path = join(__dirname, `/songs/${song}`)

    fs.readdir(join(__dirname, '/songs'), (err, files) => {

        if (err || !files.includes(song)) {
            res.status(404).json({
                error: 'Song not found.'
            })
            return
        }

        fs.stat(path, (err, stats) => {

            if (err) {
                res.status(500).json({
                    error: 'An error has occured.'
                })
            }

            let fileSize = stats.size
            let range = req.headers.range

            if (range) {
                let requestedRange = range.replace(/bytes=/, '').split('-')
                let start = parseInt(requestedRange[0])
                let end = parseInt(requestedRange[1] || fileSize - 1)
                let chunkSize = end - start + 1
                let file = fs.createReadStream(path, { start, end })
                res.writeHead(206, {
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunkSize,
                    'Content-Type': 'audio/mpeg',
                })
                file.pipe(res)
            } else {
                res.writeHead(200, {
                    'Content-Length': fileSize,
                    'Content-Type': 'audio/mpeg',
                })
                fs.createReadStream(path).pipe(res)
            }
        })
    })
})

app.get('/playlists', (req, res) => {
    fs.readdir(join(__dirname, '/songs'), async (err, files) => {
        if (err) {
            res.status(500).json({
                error: 'An error has occured.'
            })
            return
        }
        let playlists = []

        for (let i = 0; i < files.length; i++) {
            try {
                let fileStat = fs.lstatSync(join(__dirname, `/songs/${files[i]}`))
                if (fileStat.isDirectory()) {
                    try {
                        let songs = fs.readdirSync(join(__dirname, `/songs/${files[i]}`)).filter(song => song.endsWith('.mp3'))
                        let buildResponseFromSongs = songs.map(async song => {
                            try {
                                let reply = await new Promise((resolve, reject) => {
                                    redisClient.hgetall(`songs:${song}`, (err, reply) => {
                                        if (err) {
                                            reject(err)
                                            return
                                        }
                                        resolve(reply)
                                    })
                                })
                                playlists.push(Object.assign(reply, {
                                    name: song,
                                    url: `/file/${encodeURIComponent(files[i])}/${encodeURIComponent(song)}`,
                                    cover: `/file/${encodeURIComponent(files[i])}/${encodeURIComponent(song.replace(/.mp3/, '.jpg'))}`,
                                    lrc: `/file/${encodeURIComponent(files[i])}/${encodeURIComponent(song.replace(/.mp3/, '.lrc'))}`
                                }))
                            } catch (e) { }
                        })
                        await Promise.all(buildResponseFromSongs)
                    } catch (e) { }
                }
            } catch (e) { }
        }
        res.status(200).json(playlists)
    })
})

app.listen(process.env.PORT, () => {
    console.log(`Listening on ${process.env.PORT}...`)
    console.log(`Selected DB ${process.env.DATABASE}`)
})