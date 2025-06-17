/* 
welcume to STUPID and USELESS MOD PLAYER source code :D
made by igorecm in 2025
*/

(function(global){

	/*****************
	*      UTILS     *
	*****************/

	// GENERAL UTILS //

	function dataUrItoUint8Array(data) {
		var binary = atob(data.split(',')[1]);
		var array = [];
		for (var i = 0; i < binary.length; i++) {
			array.push(binary.charCodeAt(i));
		}
		return new Uint8Array(array)
	}

	function clamp(min,val,max){
		return Math.min(Math.max(val,min),max)
	};

	// this shite was coded by ai, not me, was too lazy, sorry

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

	function findClosest(arr, target) {
		if (!arr || arr.length === 0) {
			return null;
		}
		return arr.reduce((prev, curr) => {
			return (Math.abs(curr - target) < Math.abs(prev - target) ? curr : prev);
		});
	}


	function bitSlicer(arrayBuffer, mask) {
		if (typeof(arrayBuffer) == "array"){
			arrayBuffer = arrayToArrayBuffer(arrayBuffer)
		}
		let result = [];
		let view = new Uint8Array(arrayBuffer);
		let currentBitPosition = 0;
		let currentByteIndex = 0;
		let currentByte = view[0] || 0;
		
		for (const bits of mask) {
			if (bits <= 0) {
				throw new Error("Mask values must be positive integers");
			}
			
			let value = 0;
			let bitsRemaining = bits;
			
			while (bitsRemaining > 0) {
				let availableBits = 8 - currentBitPosition;
				let bitsToTake = Math.min(bitsRemaining, availableBits);
				
				// Create mask for the bits we want to take from the current byte
				let bitMask = ((1 << bitsToTake) - 1) << (availableBits - bitsToTake);
				let shiftedBits = (currentByte & bitMask) >>> (availableBits - bitsToTake);
				
				// Add these bits to our value
				value = (value << bitsToTake) | shiftedBits;
				
				// Update positions
				currentBitPosition += bitsToTake;
				bitsRemaining -= bitsToTake;
				
				// If we've consumed a whole byte, move to the next one
				if (currentBitPosition >= 8) {
					currentBitPosition = 0;
					currentByteIndex++;
					currentByte = view[currentByteIndex] || 0;
				}
			}
			
			result.push(value);
		}
		
		return result;
	}

	function bitGluer(numbers, mask) {
		if (numbers.length !== mask.length) {
			throw new Error("Numbers and mask arrays must have the same length");
		}

		let result = 0;
		
		for (let i = 0; i < numbers.length; i++) {
			const num = numbers[i];
			const bits = mask[i];
			
			// Validate the number fits in the specified bits
			if (num < 0) {
				throw new Error(`Negative numbers not supported (got ${num})`);
			}
			if (num >= (1 << bits)) {
				throw new Error(`Number ${num} cannot fit in ${bits} bits`);
			}
			
			// Shift the result left to make room and OR with the new bits
			result = (result << bits) | num;
		}
		
		return result;
	}

	function arrayToArrayBuffer(arr) {
		let buffer = new ArrayBuffer(arr.length);
		let view = new Uint8Array(buffer);
		arr.forEach((val, i) => view[i] = val);
		return buffer;
	}

	// end of ai shite

	function getStringFromData(data){
		let dataEnd=data.length+1;
		for (let i = 0; i < data.length; i++){
			if (data[i]==0){
				dataEnd=i;
				break;
			}
		}
		return new TextDecoder().decode(data.slice(0,dataEnd))
	}

	// NOTES AND FREQUENCY UTILS //

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

	function periodToNote(period){
		const noteTable = ['C-','C#','D-','D#','E-','F-','F#','G-','G#','A-','A#','B-'];
		let noteNum = findClosestIndex(periodTable,period);
		return noteTable[noteNum%12] + (Math.floor(noteNum/12)+1);
	}

	function periodToFrequency(period,finetune = 0,ntsc = false){
		if (!ntsc){
			return (7093789.2/(period+finetune)/2)
		} else {
			return (7159090.5/(period+finetune)/2)
		}
	}

	/**********************
	*       CLASSES       *
	***********************/
	
	class ModFile{
		constructor(channelAmount = 4, format = "M.K.", name = ""){
			this.format          = format;
			this.songname        = name;
			
			this.songlength      = 1;
			this.positions       = Array(128);
			this.patternsAmount  = 1;
			this.channelAmount   = channelAmount;
			
			this.samples         = Array(32).fill(
				{
					name:       "",
					length:     0,
					finetune:   0,
					volume:     64,
					loopStart:  0,
					loopLength: 0,
					data:       undefined
				}
			);
			this.patterns        = Array(this.patternsAmount).fill(Array(channelAmount).fill(Array(64).fill([0,0,0,0]))); //lol
		}
		static fromDataUri(dataUri){
			if (dataUri==""){
				throw new Error("dataURI shold NOT be empty");
			}

			const supportedFormats=[
				"IGOR",
				"M.K.",
				"4CHN",
				"6CHN",
				"8CHN"
			];
			
			const songdata = dataUrItoUint8Array(dataUri);

			let format = getStringFromData(songdata.slice(1080,1084));
			let newModChannelAmmount = 4;

			if (!supportedFormats.includes(format)) {
				throw new Error("Unsupported format");
			}

			if(format=="6CHN"){
				newModChannelAmmount = 6;
			} else if(format=="8CHN"){
				newModChannelAmmount = 8;
			}

			let modFile = new this(newModChannelAmmount);

			
			modFile.format          = format;
			modFile.songname        = getStringFromData(songdata.slice(0,20));
			
			modFile.songlength      = songdata[950];
			modFile.positions       = Array.from(songdata.slice(952,952+128));
			modFile.patternsAmount  = Math.max(...modFile.positions)+1;
			
			modFile.samples         = Array(32);
			modFile.patterns        = Array(modFile.patternsAmount);

			modFile.channelAmount   = newModChannelAmmount
			
			

			let sDataOffset = 1084+modFile.patternsAmount*64*4*modFile.channelAmount;
			
			for (let i = 1; i<=31; i++) {
				let offset=20+(i-1)*30;
				let sampleinfo = bitSlicer( songdata.slice(offset+22,offset+30).buffer, [16,4,4,8,16,16]);
				modFile.samples[i] = {
					name:       getStringFromData(songdata.slice(offset,offset+22)),
					length:     sampleinfo[0] * 2,
					finetune:   sampleinfo[2],
					volume:     sampleinfo[3],
					loopStart:  sampleinfo[4] * 2,
					loopLength: sampleinfo[5] * 2,
					data:       new ArrayBuffer()
				}
				if (sampleinfo[2]>7) {modFile.samples[i].finetune = sampleinfo[2]-16}

				modFile.samples[i].data = songdata.slice(sDataOffset, sDataOffset+modFile.samples[i].length).buffer;
				sDataOffset += modFile.samples[i].length;
			}

			for (let i = 0; i<modFile.patternsAmount; i++) {
				//modFile.patterns[i] = Array(modFile.channelAmount).fill(Array(64));
				modFile.patterns[i] = Array(modFile.channelAmount).fill().map(() => Array(64))

				for (let y = 0; y<64; y++){
						for (let x = 0; x<modFile.channelAmount; x++){
							let offset = 1084+(i*64*4*modFile.channelAmount)+(y*4*modFile.channelAmount)+(x*4);
							let note = bitSlicer(songdata.slice(offset,offset+4).buffer,[4,12,4,4,8]);

							modFile.patterns[i][x][y] = [note[1], bitGluer([note[0],note[2]],[4,4]), note[3], note[4]];
						}
				}

			}

			return modFile
		}
	}

	//const playbackScript = new Blob([``],{ type: 'blob' });
	
	class ModPlayer{

		constructor(){
			this.audioCtx = new (window.AudioContext || window.webkitAudioContext)({latencyHint: "playback"});
			this.playback = new Worker("sump-worker.js");

			//this.playback = new Worker(URL.createObjectURL(playbackScript));
			/*this.playback = new Worker(URL.createObjectURL(new Blob([
                    document.querySelector('#sumpWorker').textContent
                ], {type: 'application/javascript'})));*/
			
			this.songFile = null;

			this.channels = [];

			this.sampleBuffers = Array(32);

			this.masterVolume      = 1.0;
			this.masterPan         = 0.0;
			this.panSeparation     = 0.2;

			this.currentPosition   = 0;
			this.currentPattern    = 0;
			this.currentRow        = 0;
			this.currentAproxTime  = 0;

			this.repeatSong        = true;
			this.isPlaying         = false;

			this.channelAmount = 4;

			this.masterGain = this.audioCtx.createGain();
			this.masterGain.connect(this.audioCtx.destination);
			this.masterGain.gain.value = 0.64;

			this.onRow = function(){}

			this.resetAudio(true)

			let t = this;

			function formatn(n,l=2){
				n = n.toString(16)
				return ("000000").slice(0,l-n.length)+n
			}

			this.playback.onmessage = (e) => {

				if (e.data.type == "row"){
					//console.log(e.data)

					t.currentRow = e.data.row
					t.currentPattern = t.songFile.positions[e.data.position]
					t.currentPosition = e.data.position

					
					for (let i = 0; i < t.channelAmount; i++){
						let p = t.songFile.positions[e.data.position]
						t.playNote(t.songFile.patterns[p][i][e.data.row], i)
					}
					
					let s = ""
					//s += "ch..s..not.vol.eff.efv<br>"
					for (let i = 0; i < t.channelAmount; i++){
						let ch = t.channels[i];
						s += `${i} : ${periodToNote(ch.period)} ${formatn(ch.sample)} ${formatn(ch.volume)} ${formatn(ch.lastEffect,1)} ${formatn(ch.lastEffectValue)}<br>`
					}
					document.getElementById("SUMPDEBUG").innerHTML = s

					this.onRow()
				}

				if (e.data.type == "tick"){
					for (let i = 0; i < t.channelAmount; i++){
						let ch = t.channels[i];

						// arpeggio (0xy)

						if (ch.lastEffect == 0 && ch.lastEffectValue != 0 && ch.period != 0 && ch.period != 113){
							ch.period = ch.arpeggioTable[ch.arpeggioTable[3]]
							ch.arpeggioTable[3] = ch.arpeggioTable[3]+1
							if (ch.arpeggioTable[3] == 3){ch.arpeggioTable[3] = 0}
						}

						let val = bitSlicer([ch.lastEffectValue],[4,4]);

						switch(ch.lastEffect){
							case 10: // volume slide (Axy)
								if (val[0] == 0 && val[1] != 0){
									ch.volume = clamp(0, ch.volume - val[1], 64)
								} else if(val[1] == 0 && val[0] != 0){
									ch.volume = clamp(0, ch.volume + val[0], 64)
								}
								break;
							case 1: // porta up (1xx)
								ch.period = clamp(113, ch.period - ch.lastEffectValue, 856)
								ch.portaTarget = ch.period
							break;

							case 2: // porta down (2xx)
								ch.period = clamp(113, ch.period + ch.lastEffectValue, 856)
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
									ch.volume = clamp(0, ch.volume - val[1], 64)
								} else if(val[1] == 0 && val[0] != 0){
									ch.volume = clamp(0, ch.volume + val[0], 64)
								}
								break;
							case 6: // vibrato + volume slide (6xy)
								ch.period = ch.portaTarget + (((ch.vibratoCounter < 32) 
																? vibratoSineTable[ch.vibratoCounter] 
																: -vibratoSineTable[ch.vibratoCounter - 32] * ch.vibratoDepth) >> 7);
								ch.vibratoCounter = (ch.vibratoCounter + ch.vibratoSpeed)%64

								if (val[0] == 0 && val[1] != 0){
									ch.volume = clamp(0, ch.volume - val[1], 64)
								} else if(val[1] == 0 && val[0] != 0){
									ch.volume = clamp(0, ch.volume + val[0], 64)
								}
								break;

						}
						if (ch.source){
							ch.source.playbackRate.value = periodToFrequency(ch.period)/periodToFrequency(214);
						}
						ch.gainNode.gain.value = ch.volume/100

					}
				}
			}
			
		}
		stopAudio(){
			for (let i = 0; i < this.channelAmount; i++){
				let ch = this.channels[i]

				if (ch.source){
					ch.source.stop()
					ch.source.disconnect();
				}
			}
		}
		resetAudio(f = false){
			for (let i = 0; i < this.channelAmount; i++){

				//let ch = this.channels[i]

				let gainNode = this.audioCtx.createGain();
				gainNode.connect(this.masterGain);

				this.channels[i] = {
					source: null,
					gainNode: gainNode,
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
		
		loadSong(song){
			this.stopSong()
			this.resetAudio()

			this.songFile = song;
			
			this.channelAmount = this.songFile.channelAmount
			for (let i = 1; i<=31; i++) {
				let sample = this.songFile.samples[i]
				if (sample.length != 0){
					const buffer = this.audioCtx.createBuffer(1, sample.length, periodToFrequency(214)* Math.pow(2,sample.finetune/12/8) );
					const channelData = buffer.getChannelData(0);
					const sampleData = new Uint8Array(sample.data);

					for (let i = 0; i < sample.length; i++) {
						channelData[i] = (sampleData[i] < 128 ? sampleData[i] : sampleData[i] - 256) / 128;
					}
					buffer.loop = false
					if (sample.loopLength > 2){buffer.loop = true};

					buffer.loopStart = sample.loopStart/buffer.sampleRate;
					buffer.loopEnd = (sample.loopLength + sample.loopStart)/buffer.sampleRate;

					this.sampleBuffers[i] = buffer;
				}
			}
		}

		// controls

		setVolume(volume){
			this.masterGain.gain.value = volume;
		}
		setSongPosition(pos){
			this.playback.postMessage({command : "seek", value : pos});
			this.stopAudio()
		}
		playSong(){
			this.resetAudio()
			this.playback.postMessage({command : "play" , slength : this.songFile.songlength, repeat: this.repeatSong});
		}
		stopSong(){
			this.playback.postMessage({command : "stop"});
			this.stopAudio()
			this.resetAudio()
			
		}
		pauseSong(){
			this.playback.postMessage({command : "pause"});
			this.stopAudio()
			
		}
		resumeSong(){
			this.playback.postMessage({command : "resume"});
		}
		

		// playback related

		playSample(channelIndex, sample, period, volume = 0.64, offset = 0){
			const ch = this.channels[channelIndex];
			const sampleBuffer = this.sampleBuffers[sample]
			if (ch.source) {
				ch.source.stop();
				ch.source.disconnect();
			}

			ch.source = this.audioCtx.createBufferSource();
			ch.source.buffer = sampleBuffer;
			ch.source.connect(ch.gainNode);

			ch.source.playbackRate.value = periodToFrequency(period)/periodToFrequency(214);

			ch.gainNode.gain.value = volume;

			ch.source.start(0,offset);

			if (sampleBuffer.loop) {
				ch.source.loop = true;
				ch.source.loopStart = sampleBuffer.loopStart;
				ch.source.loopEnd = sampleBuffer.loopEnd;
			}
		}
		playNote(note, channel){

			const ch = this.channels[channel];

			// set last sample value and set volume

			if (note[1] != 0){
				ch.sample = note[1]
				ch.volume = this.songFile.samples[note[1]].volume
			}

			
			// play note

			if (note[0] != 0 && ch.sample != 0){

				// set portamento slide target

				ch.portaTarget = note[0]

				if(note[2] != 3 && note[2] != 5 ){
					ch.period = note[0]
					ch.vibratoCounter = 0
					this.playSample(channel, ch.sample , ch.period, ch.volume/100)
					
				}
			}

			// create arpeggio table

			if (note[2]==0 && note[3]!=0 && ch.period != 0 && ch.period != 113){
				if (ch.arpeggioTable[0] == 0 || note[3] != ch.lastEffectValue || note[0] != 0){ 
					if(!periodTable.includes(ch.period)){ch.period = findClosest(periodTable,ch.period)}
					let s = bitSlicer([note[3]],[4,4])
					ch.arpeggioTable[0] = ch.period
					ch.arpeggioTable[1] = periodTable[periodTable.indexOf(ch.period) + s[0]]
					ch.arpeggioTable[2] = periodTable[periodTable.indexOf(ch.period) + s[1]]
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
						let s = bitSlicer([note[3]],[4,4])
						ch.vibratoSpeed = s[0]
						ch.vibratoDepth = s[1]
					}
					break;
				case 9: // set sample offset (9xx)
					this.playSample(channel, ch.sample, ch.period, ch.volume, note[3]*256 / this.sampleBuffers[ch.sample].sampleRate )
					break;
				case 11:  // jump to pos (Bxx)
					this.playback.postMessage({command : "setpos", value : note[3]})
					break;
				case 12: // set volume effect (Cxx)
					if (ch.source){
						ch.volume = note[3]
					}
					break;
				case 13: // break to row (Dxx)
					this.playback.postMessage({command : "breakrow", value : note[3]})
					break;
				case 15: // set speed/bpm (Fxx)
					if (note[3] < 32){
						this.playback.postMessage({command : "changespeed", value : note[3]})
					} else{
						//this.playback.postMessage({command : "changebpm", value : note[3]})
					}
					break;
			}

			// Exy effects
			if (note[2]==14){
				let val = bitSlicer([note[3]],[4,4]);
				switch(val[0]){
					case 10: //fine volume up (EAy)
						ch.volume = clamp(0, ch.volume + val[1], 64)
						break;
					case 11: //fine volume down (EBy)
						ch.volume = clamp(0, ch.volume - val[1], 64)
						break;
				}
			}

			ch.gainNode.gain.value = ch.volume/100
			if (ch.source){ch.source.playbackRate.value = periodToFrequency(ch.period)/periodToFrequency(214);}
			

			// set last values

			ch.lastEffect      = note[2]
			ch.lastEffectValue = note[3]
			
		}
		
		
	}
	
	const SUMP = {
		ModPlayer,
		ModFile,
		periodToFrequency,
		periodToNote,
		periodTable,
	}
	/*
	if (typeof define === 'function' && define.amd) {
		define([], () => SUMP);
	} else if (typeof exports === 'object') {
		module.exports = SUMP;
	} else {
		global.SUMP = SUMP;
	}
	*/
	global.SUMP = SUMP;
})(this);