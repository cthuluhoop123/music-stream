require('dotenv').config()

const fs = require('fs')
const { join } = require('path')

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

app.get('/play/:song', (req, res) => {
    let song = req.params.song
    if (!song) {
        res.status(400).end()
        return
    }
    let path = join(__dirname, `/songs/${song}`)
    fs.stat(path, (err, stats) => {
        if (err) {
            if (err.errno === -4058) {
                res.status(404).json({
                    error: 'Song not found.'
                })
                return
            }

            res.status(404).json({
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

app.listen(process.env.PORT, () => {
    console.log(`Listening on ${process.env.PORT}...`)
})