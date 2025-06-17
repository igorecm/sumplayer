# STUPID and USELESS MODule music PLAYER (SUMP)
sloppy and unreliable ProTracker (mostly) compatible .mod player, which is written in js and uses Web Audio API. <br>
avaliable at https://igorecm.github.io/sumplayer/
## Featurez:
* supports ProTraker/NoiseTracker modules and also 4CHN, 6CHN and 8CHN FastTracker .mod modules (not .xm (...yet)).
* you can embed this in your projects and maybe even game projects (not tested)
* .mod parser class and sound utils
## Bugs and issues
* even though the sequence playback clock is on worker thread, the actual audio playback can stutter.
* volume and pitch slides are bit too fast and very inaccurate, especially the pitch slides, which are not even linear. i'm currently working on fixing that.
* not all `Exy` effects are implemented yet
## Example / API
```js

// one way to load .mod files is trough Data URI strings
songDataURI = "data:application/mod;base64,cHguYmxhZHN3ZWRlIHJlbWl4IQBTVC0x...";

// initialize and play song

// parse the file
let modfile = SUMP.ModFile.fromDataUri(songDataURI);
// player init
let modplayer = new SUMP.ModPlayer();
document.addEventListener('DOMContentLoaded', () => {
      modplayer.loadSong(modfile);
      modplayer.playSong();
});

// to e.g. update visuals you could define SUMP.ModPlayer.onRow function
modplayer.onRow = function(){
  document.getElementById("playbackInfo").innerHTML = `${modplayer.currentPosition}:${modplayer.currentRow} `;
}
```
## License
* MIT for all files except for `samplefile.js`
