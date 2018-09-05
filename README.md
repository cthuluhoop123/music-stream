# music-stream
A music stream backend for a very specific purpose. yes.

# Endpoints
* `/play/:song`
    * Plays a song from the local `./songs` directory. If song file does not exist, returns `404 song not found`. File              extensions are required/matched.   

* `/songList`
    * Lists all the files/songs in the local `./songs` directory.

