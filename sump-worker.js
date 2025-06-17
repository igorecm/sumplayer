//dddd

let isPlaying = false;
let isPaused = false;

let ticksPerRow = 6;
let tickDurationMs = 20;

let tickInterval;
let nextTickTime = 0;

let totalTicks        = 0;
let currentTick       = 0;
let currentPosition   = 0;
let currentRow        = 0;
let songLength        = 1;
let songRepeat        = true;

let rowCallback      = function(){}
let afterRowCallback = function(){}

function setSpeed(tpr = 6){
    ticksPerRow = tpr;
}
function setBPM(BPM = 125){
    tickDurationMs = 2500/BPM|0;
}

function processTick(){
    //
    if (!isPlaying) return;

    

    if (currentTick == 0){
        postMessage({type : "row", row : currentRow, position : currentPosition, speed : ticksPerRow})
        rowCallback()
        rowCallback = function(){}
    }

    postMessage({type : "tick", tick : totalTicks})

    

    currentTick++;
    totalTicks++;

    if (currentTick >= ticksPerRow) {
        currentTick = 0;
        currentRow++;
        
        if (currentRow >= 64) {
            currentRow = 0;
            currentPosition++;
        }

        afterRowCallback()
        afterRowCallback = function(){}

        if (currentPosition == songLength && songRepeat){
            currentPosition = 0
        }
    }

    
}

function tick() {
    const now = performance.now();
    if (now < nextTickTime) return;
    processTick();
    nextTickTime += tickDurationMs;
}

self.onmessage = (e) => {
    switch (e.data.command) {
        case "breakrow":
            afterRowCallback = function(){
                currentPosition++;
                currentRow = e.data.value
            }
            break;
        case "changespeed":
            setSpeed(e.data.value);
            break;
        case "changebpm":
            setBPM(e.data.value);
            break;
		case "setpos":
			afterRowCallback = function(){
				currentTick       = 0;
				currentPosition   = e.data.value;
			}
            break;

        
        case "play":
            ticksPerRow = 6;
            tickDurationMs = 20;
            totalTicks        = 0;
            currentTick       = 0;
            currentPosition   = 0;
            currentRow        = 0;
            songLength = e.data.slength;
            songRepeat = e.data.repeat;
            if (!isPlaying) {
                isPlaying = true;
                isPaused = false;
                nextTickTime = performance.now();
                tickInterval = setInterval(tick, 1);
            }
            break;
        
        case "stop":
            clearInterval(tickInterval);
            isPlaying = false;
            isPaused = false;
            ticksPerRow = 6;
            tickDurationMs = 20;
            totalTicks        = 0;
            currentTick       = 0;
            currentPosition   = 0;
            currentRow        = 0;
            break;
        
        case "pause":
            clearInterval(tickInterval);
            isPlaying = false;
            isPaused = true;
            break;
        
        case "resume":
            if (!isPlaying) {
                isPlaying = true;
                isPaused = false;
                nextTickTime = performance.now();
                tickInterval = setInterval(tick, 1);
            }
            break;
        case "seek":
            
            if (isPlaying || isPaused){
                currentTick       = 0;
                currentPosition   = e.data.value;
                currentRow        = 0;
            }
            break;
    }

}