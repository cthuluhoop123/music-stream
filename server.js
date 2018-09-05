require('dotenv').config()

const fs = require('fs')
const { join } = require('path')

const redis = require('redis')
const redisClient = redis.createClient()
redisClient.select(6)

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

app.get('/songList', (req, res) => {
    fs.readdir(join(__dirname, '/songs'), (err, files) => {
        if (err) {
            res.status(500).json({
                error: 'An error has occured.'
            })
            return
        }
        res.status(200).json(files)
    })
})

app.listen(process.env.PORT, () => {
    console.log(`Listening on ${process.env.PORT}...`)
})