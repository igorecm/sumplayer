///////////////UTILS///////////////

function clamp(min,val,max){
    return Math.min(Math.max(val,min),max)
};
function findClosestIndex(arr, target) {
    if (!arr || arr.length === 0) {
        return -1;
    }

    let closestValue = arr[0];
    let closestIndex = 0;

    for (let i = 1; i < arr.length; i++) {
        const currentDiff = Math.abs(target - arr[i]);
        const closestDiff = Math.abs(target - closestValue);

        if (currentDiff < closestDiff) {
            closestValue = arr[i];
            closestIndex = i;
        }
    }

    return closestIndex;
}
const periodTable = [
    856,808,762,720,678,640,604,570,538,508,480,453,
    428,404,381,360,339,320,302,285,269,254,240,226,
    214,202,190,180,170,160,151,143,135,127,120,113
];

const vibratoSineTable = [
        0,  24,  49,  74,  97, 120, 141, 161,
    180, 197, 212, 224, 235, 244, 250, 253,
    255, 253, 250, 244, 235, 224, 212, 197,
    180, 161, 141, 120,  97,  74,  49,  24
];



///////////////MAIN STUFF///////////////

let patternData = []
let sampleInfo = []
let positionsData = []
let channelAmount = 4;

let channels = []

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

function resetAudio(){
    for (let i = 0; i < channelAmount; i++){

        channels[i] = {
            playSample : false,
            playSampleOffset : 0,
            lastEffect: 0,
            lastEffectValue: 0,
            sample: 0,
            volume: 64,
            period: 856,
            portaTarget : 0,
            portaSpeed : 0,
            vibratoDepth : 0,
            vibratoSpeed : 0,
            vibratoCounter : 0,
            arpeggioTable: [0,0,0,0]
        };
    }

}

resetAudio()

function setSpeed(tpr = 6){
    ticksPerRow = tpr;
}
function setBPM(BPM = 125){
    tickDurationMs = 2500/BPM|0;
}
function resetPlayback(){
    ticksPerRow = 6;
    tickDurationMs = 20;
    totalTicks        = 0;
    currentTick       = 0;
    currentPosition   = 0;
    currentRow        = 0;
}

//////////////////////////////

function perRowPlayback(){
    for (let i = 0; i < channelAmount; i++){
        let p = positionsData[currentPosition]
        const note = patternData[p][i][currentRow]
        const ch = channels[i]

        let effectvalues = [note[3]>>4, note[3]-(note[3]>>4<<4)]

        // set last sample value and set volume

        if (note[1] != 0){
            ch.sample = note[1]
            ch.playSampleOffset = 0
            ch.volume = sampleInfo[ch.sample].volume
        }

        
        // play note

        if (note[0] != 0 && ch.sample != 0){

            // set portamento slide target

            ch.portaTarget = note[0]

            if(note[2] != 3 && note[2] != 5 ){
                ch.period = note[0]
                ch.vibratoCounter = 0
                ch.playSample = true;
                
            }
        }

        // create arpeggio table

        if (note[2]==0 && note[3]!=0 && ch.period != 0 && ch.period != 113){
            if (ch.arpeggioTable[0] == 0 || note[3] != ch.lastEffectValue || note[0] != 0){ 
                let baseNote = findClosestIndex(periodTable,ch.period)

                let s = [Math.min(baseNote + effectvalues[0],35), Math.min(baseNote + effectvalues[1],35)]

                //if(baseNote + s[0] > 35 || baseNote + s[0]){}
                //if(!periodTable.includes(ch.period)){ch.period = findClosest(periodTable,ch.period)}
                //let s = [note[3]>>3, note[3]-(note[3]>>4<<4)] //bitSlicer([note[3]],[4,4])

                ch.arpeggioTable[0] = periodTable[baseNote];
                ch.arpeggioTable[1] = periodTable[s[0]];
                ch.arpeggioTable[2] = periodTable[s[1]];
                ch.arpeggioTable[3] = 0
            }
        }

        // reset vibrato
        if (note[2] != ch.lastEffect && ch.lastEffect == 4){
            ch.period = ch.portaTarget
        }
        // reset arpeggio
        if (note[2] != ch.lastEffect && ch.lastEffect == 0 && ch.lastEffectValue != 0){
            ch.period = ch.portaTarget
        }

        // handle effects

        switch(note[2]){
            case 3: // set portamento slide speed (3xx)
                if (note[3]!=0){
                    ch.portaSpeed = note[3]
                }
                break;
            case 4: // set vibrato (4xy)
                if (note[3]!=0){
                    ch.vibratoSpeed = effectvalues[0]
                    ch.vibratoDepth = effectvalues[1]
                }
                break;
            case 9: // set sample offset (9xx)
                ch.playSample = true
                ch.playSampleOffset = note[3]*256
                break;
            case 11:  // jump to pos (Bxx)
                //this.playback.postMessage({command : "setpos", value : note[3]})
                break;
            case 12: // set volume effect (Cxx)
                if (ch.sample != 0){
                    ch.volume = note[3]
                }
                break;
            case 13: // break to row (Dxx)
                afterRowCallback = function(){
                    currentPosition++;
                    currentRow = note[3]
                }
                break;
            case 15: // set speed/bpm (Fxx)
                if (note[3] < 32){
                    setSpeed(note[3])
                } else{
                    setBPM(note[3])
                }
                break;
        }

        // Exy effects
        if (note[2]==14){
            switch(effectvalues[0]){
                case 10: //fine volume up (EAy)
                    ch.volume = ch.volume + effectvalues[1]
                    break;
                case 11: //fine volume down (EBy)
                    ch.volume = ch.volume - effectvalues[1]
                    break;
            }
        }

        ch.lastEffect      = note[2]
		ch.lastEffectValue = note[3]

    }
}

function perTickPlayback(){
    for (let i = 0; i < channelAmount; i++){
		const ch = channels[i];

        let val = [ch.lastEffectValue>>4, ch.lastEffectValue-(ch.lastEffectValue>>4<<4)]

        // arpeggio (0xy)
        if (ch.lastEffect == 0 && ch.lastEffectValue != 0 && ch.period != 0 && ch.period != 113){
            ch.period = ch.arpeggioTable[ch.arpeggioTable[3]]
            ch.arpeggioTable[3] = ch.arpeggioTable[3]+1
            if (ch.arpeggioTable[3] == 3){ch.arpeggioTable[3] = 0}
        }

        switch(ch.lastEffect){
            case 10: // volume slide (Axy)
                if (val[0] == 0 && val[1] != 0){
                    ch.volume = ch.volume - val[1]
                } else if(val[1] == 0 && val[0] != 0){
                    ch.volume = ch.volume + val[0]
                }
                break;
            case 1: // porta up (1xx)
                ch.period = ch.period - ch.lastEffectValue
                ch.portaTarget = ch.period
            break;

            case 2: // porta down (2xx)
                ch.period = ch.period + ch.lastEffectValue
                ch.portaTarget = ch.period
            break;
            
            case 3: // porta slide (3xx)
                if (ch.period < ch.portaTarget){
                    ch.period = clamp(113, ch.period + ch.portaSpeed, ch.portaTarget)
                } else if (ch.period > ch.portaTarget){
                    ch.period = clamp(ch.portaTarget, ch.period - ch.portaSpeed, 856 )
                }
                break;
                
            case 4: // vibrato (4xy)
                ch.period = ch.portaTarget + (((ch.vibratoCounter < 32) 
                                                ? vibratoSineTable[ch.vibratoCounter] 
                                                : -vibratoSineTable[ch.vibratoCounter - 32] * ch.vibratoDepth) >> 7);
                ch.vibratoCounter = (ch.vibratoCounter + ch.vibratoSpeed)%64
                break;
            
            case 5: // porta + volume slide (5xy)
                if (ch.period < ch.portaTarget){
                    ch.period = clamp(113, ch.period + ch.portaSpeed, ch.portaTarget)
                } else if (ch.period > ch.portaTarget){
                    ch.period = clamp(ch.portaTarget, ch.period - ch.portaSpeed, 856 )
                }

                if (val[0] == 0 && val[1] != 0){
                    ch.volume = ch.volume - val[1]
                } else if(val[1] == 0 && val[0] != 0){
                    ch.volume = ch.volume + val[0]
                }
                break;
            case 6: // vibrato + volume slide (6xy)
                ch.period = ch.portaTarget + (((ch.vibratoCounter < 32) 
                                                ? vibratoSineTable[ch.vibratoCounter] 
                                                : -vibratoSineTable[ch.vibratoCounter - 32] * ch.vibratoDepth) >> 7);
                ch.vibratoCounter = (ch.vibratoCounter + ch.vibratoSpeed)%64

                if (val[0] == 0 && val[1] != 0){
                    ch.volume = ch.volume - val[1]
                } else if(val[1] == 0 && val[0] != 0){
                    ch.volume = ch.volume + val[0]
                }
                break;

        }

        ch.period = clamp(113, ch.period, 856)
        ch.volume = clamp(0, ch.volume, 64)

        
    }
}

function processTick(){
    //
    if (!isPlaying) return;

    if (currentTick == 0){
        //postMessage({type : "row", row : currentRow, position : currentPosition, speed : ticksPerRow})
        perRowPlayback()

        rowCallback()
        rowCallback = function(){}
    }

    perTickPlayback()
    //postMessage({type : "tick", tick : totalTicks})

    postMessage({
        type : "update", 
        tick : currentTick,
        row : currentRow, 
        position : currentPosition, 
        speed : ticksPerRow,
        ch : channels
    })

    for (let i = 0; i < channelAmount; i++){channels[i].playSample = false;}

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

    if (e.data.type == "songdata"){
        patternData = e.data.patterndata
        sampleInfo = e.data.sampleinfo
        positionsData = e.data.positionsdata
        channelAmount = e.data.channelamnt

        resetAudio();
    }

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
            resetPlayback()
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
            resetPlayback()
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