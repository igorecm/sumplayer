///////////////UTILS///////////////

function arrayMidAccess(array, index, start = index, end = (index + 1)) {
	if(index < 0) {
		return array[0];
	}
	else if(index > array.length - 1) {
		return array[array.length - 1];
	}
	
	let minIndex = Math.floor(index);
	let maxIndex = Math.ceil(index);

	let valA = array[minIndex]
	let valB = array[maxIndex]
	let frac = index - minIndex

	if(maxIndex == end){
		valB = array[start]
	}

	return valA+(valB-valA) * frac
}

function lerp(a, b, frac){
	return a + (b - a) * frac
}

//console.log(arrayMidAccess([0,1,2,-4,8,5], 2.5))

function clamp(min,val,max) {
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


///////////////MAIN STUFF///////////////

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

const fineTuneTable = [
	0.9438743126816935, 0.9507140150387502, 0.9576032806985737, 0.9645424688172868, 
	0.9715319411536059, 0.9785720620877001, 0.9856631986401876, 0.9928057204912689, 1, 
	1.007246412223704, 1.0145453349375237, 1.0218971486541166, 1.029302236643492, 
	1.0367609849529913, 1.0442737824274138, 1.0518410207292894
]

const amigaClock = 3546895;

function effectSetVolume(ch, pch){
	ch.volume = pch.note[3];
}

function createArpeggioTable(ch, pch){
	const effectvalue = [pch.note[3]>>4, pch.note[3] & 0xf]
	if (pch.arpeggioTable[0] == 0 || pch.note[3] != pch.lastEffectValue || pch.note[0] != 0){ 
		ch.period = pch.portaTarget

		let baseNote = periodTable.indexOf(pch.lastNote) 
		let ft = fineTuneTable[pch.sampleFinetune+8]

		let s = [Math.min(baseNote + effectvalue[0],35), Math.min(baseNote + effectvalue[1],35)]

		pch.arpeggioTable[0] = Math.max(Math.round(periodTable[baseNote] / ft), 113);
		pch.arpeggioTable[1] = Math.max(Math.round(periodTable[s[0]] / ft), 113);
		pch.arpeggioTable[2] = Math.max(Math.round(periodTable[s[1]] / ft), 113);
		pch.arpeggioTable[3] = 0;
	}
}

function effectArpeggio(ch, pch){
	ch.period = pch.arpeggioTable[pch.arpeggioTable[3]]
    pch.arpeggioTable[3] += 1
    if (pch.arpeggioTable[3] == 3){pch.arpeggioTable[3] = 0}
}

function effectPortaUp(ch, pch){
	/*ch.period -= pch.note[3]*/
	ch.period = clamp(113, ch.period -= pch.note[3], 856)
	pch.portaTarget = ch.period
}

function effectPortaDown(ch, pch){
	ch.period = clamp(113, ch.period += pch.note[3], 856)
	pch.portaTarget = ch.period
}

function effectPortaSlide(ch, pch){
	 if (ch.period < pch.portaTarget){
		ch.period = clamp(113, ch.period + pch.portaSpeed, pch.portaTarget)
	} else if (ch.period > pch.portaTarget){
		ch.period = clamp(pch.portaTarget, ch.period - pch.portaSpeed, 856 )
	}
}

function effectVibrato(ch, pch){
	ch.period = pch.portaTarget + (((pch.vibratoCounter < 32) 
				? vibratoSineTable[pch.vibratoCounter] 
				: -vibratoSineTable[pch.vibratoCounter - 32] * pch.vibratoDepth) >> 7);
	pch.vibratoCounter = (pch.vibratoCounter + pch.vibratoSpeed)%64
}

function effectVolumeSlide(ch, pch){
	const effectvalue = [pch.note[3]>>4, pch.note[3] & 0xf]
	if (effectvalue[0] != 0) {
		ch.volume = clamp(0, ch.volume + effectvalue[0], 64);
	}else if(effectvalue[1] != 0){
		ch.volume = clamp(0, ch.volume - effectvalue[1], 64);
	}
}

function effectPortaVolumeSlide(ch, pch){
	effectPortaSlide(ch, pch);
	effectVolumeSlide(ch, pch);
}

function effectVibratoVolumeSlide(ch, pch){
	effectVibrato(ch, pch);
	effectVolumeSlide(ch, pch);
}



//////////////AUDIO ENGINE//////////////

class SUMPAudio extends AudioWorkletProcessor {
	constructor() {
		super();

		this.id = parseInt(Math.random()*255)

		this.masterGain = 1.0
		this.masterPanSeparation = 0.5
		this.masterResampling = true;

		this.channels = [];
		this.resetAudio();

		this.sampleRate = sampleRate;
		//this.totalSamples = 0;

		this.tickSampleCounter = 0;
		this.tickMsCounter = 0;

		this.memory = new Uint8ClampedArray(2*1024*1024);

		this.playback     = {}
		this.playbackData = {
			patternData : [],
			positionData : [],
			sampleInfo : [],
		}
		this.resetPlayback()
		
		this.port.onmessage = (e) => this.handleMessage(e.data);
  	}

	resetPlayback() {
		this.playback = {
			isPlaying : false,
			isPaused  : false,
			
			ticksPerRow    : 6,
			tickDurationMs : 20,

			totalTicks        : 0,
			currentTick       : 0,
			currentPosition   : 0,
			currentRow        : 0,
			songLength        : 1,
			songRepeat        : true,
			patternDelay      : 0,

			breakToRow     : -1,
			jumpToPosition : -1,

			channels : {}
		}
		for (let i = 0; i < 4; i++){
			this.playback.channels[i] = {
				idx : i,
				playSampleOffset : 0,
				playSampleStartOffset : 0,
				lastEffect: 0,
				lastEffectValue: 0,
				note : [],
				sample: 0,
				portaTarget : 0,
				portaSpeed : 0,
				vibratoDepth : 0,
				vibratoSpeed : 0,
				vibratoCounter : 0,
				arpeggioTable: [0,0,0,0]
			};
		}
	}

	resetAudio() {
		this.channels = Array(4).fill().map(() => Object({ 
			offset: 0, length: 0, period: 0, volume: 0, 
        	position: 0, loopStart: 0, loopLength: 0, playing: false
		}))
      
	}
	
	loadSamples(samples) {
		let sDataOffset = 0
		for (let i = 1; i < samples.length; i++) {
			const sample = samples[i]

			if (this.memory.buffer.length < sDataOffset+sample.length) {
				throw new Error('Out of sample memory')
			}

			this.memory.set(new Uint8Array(sample.data), sDataOffset)

			delete sample.data
			delete sample.name
			this.playbackData.sampleInfo[i] = Object.assign({}, sample)
			Object.assign(this.playbackData.sampleInfo[i], {offset : sDataOffset})

			sDataOffset += sample.length +2
		}
		// convert to signed
		for (let i = 0; i < sDataOffset; i++) {
			this.memory[i] = (this.memory[i] < 128 ? this.memory[i]+128 : this.memory[i] - 256+128)
		}
	}

  	handleMessage(e) {

		switch(e.type){
			case 'songdata':
				this.playbackData.patternData   = e.patterndata;
				this.playbackData.positionData  = e.positionsdata;
				this.playbackData.songLength    = e.songlength;

				this.resetPlayback();
				this.resetAudio();
				this.loadSamples(e.sampledata);
				
				console.log(this)
				break;
			case 'setChannel':
				const ch = this.channels[e.channel];
				if (e.offset !== undefined) ch.offset = e.offset;
				if (e.length !== undefined) ch.length = e.length;
				if (e.period !== undefined) ch.period = e.period;
				if (e.volume !== undefined) ch.volume = e.volume;
				break;
			case 'testsample':
				this.setSample(0,1,e.period);
				break;
			case 'setparam':
				function isIterable(obj) {
					// checks for null and undefined
					if (obj == null) {
						return false;
					}
					return typeof obj[Symbol.iterator] === 'function';
				}
				if(!isIterable(this[e.param])){
					this[e.param] = e.value;
				}
				break;
			case 'setvolume':
				this.masterGain = clamp(0, e.value, 1);
				break;
			case 'seek':
				this.resetAudio();
				this.playback.currentRow = 0;
				this.playback.currentTick = 0;
				this.playback.currentPosition = e.value;
				break;
			case 'play':
				this.resetAudio();
				this.resetPlayback();
				this.playback.isPlaying = true
				break;
			case 'stop':
				this.resetAudio();
				this.resetPlayback();
				this.playback.isPlaying = false
		}
  	}

	process(inputs, outputs, parameters) {
		const output = outputs[0];

		/*if (currentFrame % (48000/4) === 0) { // Once per second
			console.log('Worklet alive - channels state:', 
				this.channels.map(c => ({
					playing: c.playing,
					pos: c.position.toFixed(1),
					vol: c.volume
				}))
			);
		}*/
		
		for (let i = 0; i < output[0].length; i++) {
			let mix = 0;


			if (this.tickMsCounter == this.playback.tickDurationMs){
				this.tickMsCounter = 0;
				this.tick();
			}

			for (let c = 0; c < 4; c++) {
				const ch = this.channels[c];
				
				if (ch.playing && ch.length > 0 && ch.period > 0) {
					const increment = (amigaClock / this.sampleRate) / clamp(113, ch.period, 856);
					ch.position += increment;
					
					// Handle looping
					if (ch.loopLength > 0) {
						while (ch.position >= ch.loopStart + ch.loopLength ){ //Math.min(ch.loopStart + ch.loopLength, ch.offset + ch.length-1)) {
							ch.position -= ch.loopLength;
						}
					} else if (ch.position >= ch.offset + ch.length - 1) {
						ch.playing = false;
						continue;
					}

					let ps;

					if(c%2==0){
						ps=[this.masterPanSeparation, 1.0-this.masterPanSeparation];
					}else{
						ps=[1.0-this.masterPanSeparation, this.masterPanSeparation];
					}
					
					const rawSample = this.masterResampling ? 
						arrayMidAccess(this.memory, ch.position, 
							Math.max(ch.offset, ch.loopStart), 
							Math.min(ch.offset + ch.length , ch.loopStart + ch.loopLength )) : 
						this.memory[parseInt(ch.position)]
					const sampleValue = (rawSample - 128) * (ch.volume / 64) / 128 / 4;

					//mix += sampleValue / 128 / 4;

					output[0][i] += clamp(-1.0, sampleValue * ps[0], 1.0) * this.masterGain
					output[1][i] += clamp(-1.0, sampleValue * ps[1], 1.0) * this.masterGain
				}
			}

			if (this.tickSampleCounter == Math.round(this.sampleRate/1000)){
				this.tickMsCounter++;
				this.tickSampleCounter = 0;
			};
			
			this.tickSampleCounter++;
			
		}
		
		return true;
	}

	/////////////////MOD PLAYBACK STUFF///////////////////

	tick() {
		const pb = this.playback
		if (!pb.isPlaying) return;

		if (pb.currentTick == 0){
			this.rowPlayback()
			this.port.postMessage({type : 'row', pb : pb})
		}

		this.tickPlayback()

		pb.currentTick++;
		pb.totalTicks++;

		if (pb.currentTick >= pb.ticksPerRow){
			pb.currentTick = 0;


			if (pb.patternDelay > 0){
				pb.patternDelay--;
			}

			if (pb.patternDelay == 0){
				pb.currentRow++;
			}

			if (pb.breakToRow != -1) {
				pb.currentPosition++;
				pb.currentRow = pb.breakToRow;
				pb.breakToRow = -1;	
			}

			if (pb.currentRow >= 64) {
				pb.currentRow = 0;
				pb.currentPosition++;
			}

			if (pb.currentPosition == this.playbackData.songLength){
				pb.currentPosition = 0
			}
			
		}
	}
	tickPlayback(){
		const pb = this.playback
		for (let i = 0; i < 4; i++) {
			const pch = this.playback.channels[i]; //playback info channel
			const ch = this.channels[pch.idx];     //amiga channel
			const effectvalue = [pch.note[3]>>4, pch.note[3] & 0xf]

			if (pch.note[2] == 0 && pch.note[3] != 0 && ch.period != 0){
				effectArpeggio(ch, pch);
			}

			switch(pch.note[2]){
				case 0x1:
					effectPortaUp(ch, pch);
					break;
				case 0x2:
					effectPortaDown(ch, pch);
					break;
				case 0x3:
					effectPortaSlide(ch, pch);
					break;
				case 0x4:
					effectVibrato(ch, pch)
					break;
				case 0x5:
					effectPortaVolumeSlide(ch, pch);
					break;
				case 0x6:
					effectVibratoVolumeSlide(ch, pch);
					break;
				case 0xA:
					effectVolumeSlide(ch, pch);
					break;
			}

			if (pch.note[2] == 0xE){
				switch(effectvalue[0]){
					case 0x9:
						if (pb.currentTick % effectvalue[1] == 0) {
							ch.position = ch.offset
						}
						break;
					case 0xC:
						if (pb.currentTick == effectvalue[1]) {
							ch.volume = 0
						}
						break;
					case 0xD:
						if (pb.currentTick == effectvalue[1]) {
							this.playNote(ch, pch)
						}
						break;
				}
			}

			ch.volume = clamp(0, ch.volume, 64)
			ch.period = ch.period != 0 ? clamp(113, ch.period, 856) : 0
		}
	}
	rowPlayback(){
		const pb = this.playback
		for (let i = 0; i < 4; i++) {
			let p = this.playbackData.positionData[pb.currentPosition];

			const pch = this.playback.channels[i]; //playback info channel
			const ch = this.channels[pch.idx];     //amiga channel
			pch.note = this.playbackData.patternData[p][i][pb.currentRow];

			const effectvalue = [pch.note[3]>>4, pch.note[3] & 0xf];

			if ( !(pch.note[2] == 0xE && effectvalue[0] == 0xD) ){
				this.playNote(ch, pch);
				
			}

			// reset vibrato
			if (pch.note[2] != pch.lastEffect && pch.lastEffect == 4){
				ch.period = pch.portaTarget;
				pch.vibratoCounter = 0;
			}
			// reset arpeggio
			if (pch.lastEffect == 0 && pch.lastEffectValue != 0){
				ch.period = pch.portaTarget;
			}

			//create arpeggio table
			if (pch.note[2]==0 && pch.note[3]!=0 && ch.period){
				createArpeggioTable(ch, pch);
			}

			////////HANDLE EFFECTS////////
			switch(pch.note[2]){
				case 0x3:
					if (pch.note[3] != 0){
						pch.portaSpeed = pch.note[3]
					}
					break;
				case 0x4: // set vibrato (4xy)
					if (pch.note[3] != 0){
						pch.vibratoSpeed = effectvalue[0]
						pch.vibratoDepth = effectvalue[1]
					}
					break;
				case 0x9:
					ch.position = Math.min(ch.offset + pch.note[3]*256, ch.offset + ch.length-1)
					break;
				case 0xC: // set volume (Cxx)
					effectSetVolume(ch, pch);
					break;
				case 0xD: // break to row (Dxx)
					pb.breakToRow = clamp(0, pch.note[3], 63);
					break;
				case 0xF: // set speed/bpm (Fxx)
					if (pch.note[3] < 32){
						pb.ticksPerRow = pch.note[3]
					} else{
						pb.tickDurationMs = Math.round(2500/pch.note[3])
					}
					break;
			}

			if (pch.note[2] == 0xE){
				switch(effectvalue[0]){
					case 0x1:
						ch.period -= effectvalue[1]
						break;
					case 0x2:
						ch.period += effectvalue[1]
						break;
					case 0xA:
						ch.volume += effectvalue[1]
						break;
					case 0xB:
						ch.volume -= effectvalue[1]
						break;
				}
			}

			ch.volume = clamp(0, ch.volume, 64)
			ch.period = ch.period != 0 ? clamp(113, ch.period, 856) : 0

			pch.lastEffect      = pch.note[2]
			pch.lastEffectValue = pch.note[3]
		}
	}
	setSample(channelIndex, sample, period, volume = 64){
		const ch = this.channels[channelIndex]
		const sinfo = this.playbackData.sampleInfo[sample]

		ch.offset = sinfo.offset;
		ch.position = sinfo.offset;
		ch.length = sinfo.length;
		ch.period = period;
		ch.volume = sinfo.volume;
		ch.loopStart  = sinfo.offset + sinfo.loopStart;
		ch.loopLength = sinfo.loopLength > 2 ? sinfo.loopLength : 0;
		ch.playing = true;

		//console.log(ch,this.memory.slice(sinfo.offset,sinfo.offset+sinfo.length))
	}
	playNote(ch,pch){ //NEEDS FIXING
		let sinfo;

		if(pch.note[1] != 0){
			sinfo = this.playbackData.sampleInfo[pch.note[1]];
		}else{
			sinfo = this.playbackData.sampleInfo[pch.sample]
		}

		///

		if(pch.note[1] != 0){
			pch.sample = pch.note[1];
			ch.offset = sinfo.offset;
			
			ch.length = sinfo.length;
			ch.loopStart  = sinfo.offset + sinfo.loopStart;
			ch.loopLength = sinfo.loopLength > 2 ? sinfo.loopLength : 0;
			ch.playing = true;

			pch.sampleFinetune = sinfo.finetune;

			if (ch.period != 0 || pch.note[0] != 0){
				ch.volume = sinfo.volume;
			}
			
			
		}
		
		if(pch.note[0] != 0 && pch.sample != 0){
			pch.portaTarget = Math.round(pch.note[0] / fineTuneTable[sinfo.finetune+8]);
			pch.lastNote = pch.note[0]

			if (pch.note[2] != 3 && pch.note[2] != 5) {
				ch.period = Math.round(pch.note[0] / fineTuneTable[sinfo.finetune+8]);
				ch.position = sinfo.offset;
			}
			
		}

		
	}
}



registerProcessor('sump-audio', SUMPAudio);