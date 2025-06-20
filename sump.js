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

	const baseFrequencyPitch = 7093789.2/214/2;

	var periodPlayBackRateTable = [];

	for(let i=856; i>112; i--){
		periodPlayBackRateTable[i]=(7093789.2/i/2)/baseFrequencyPitch
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
				"M!K!",
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
			this.workletNode = null
			//this.initPromise = this.init();
			
			this.songFile = null;

			this.sampleBuffers = Array(32);

			this.currentPosition   = 0;
			this.currentPattern    = 0;
			this.currentRow        = 0;

			this.channelAmount = 4;

			this.onRow = function(){}

			this.debugOutput = ""

			let t = this;
		}

		

		async init(){
			try {
				await this.audioCtx.resume();
				await this.audioCtx.audioWorklet.addModule('sump-audio.js');
				this.workletNode = new AudioWorkletNode(this.audioCtx, 'sump-audio', {outputChannelCount: [2]});
				this.workletNode.connect(this.audioCtx.destination);

				this.workletNode.port.onmessage = this.onMessage.bind(this)
			} catch (error) {
				console.error('Error loading SUMP audio:', error);
			}
		}

		onMessage(e){
			switch(e.data.type){
				case 'row':

					this.onRow(e.data.pb)
					break; 
			}
		}
		
		loadSong(song){
			this.songFile = song;
			this.workletNode.port.postMessage({
				type          : "songdata",
				patterndata   : this.songFile.patterns,
				sampledata    : this.songFile.samples,
				positionsdata : this.songFile.positions,
				songlength    : this.songFile.songlength,
			});
		}

		// controls

		setParam(param, value){
			this.workletNode.port.postMessage({type : "setparam", param: param, value : value});
		}
		setVolume(volume){
			this.workletNode.port.postMessage({type : "setvolume", value : volume});
		}
		setSongPosition(pos){
			this.workletNode.port.postMessage({type : "seek", value : pos});
		}
		playSong(){
			this.workletNode.port.postMessage({type : "play"});
		}
		stopSong(){
			this.workletNode.port.postMessage({type : "stop"});
		}
		pauseSong(){
			this.workletNode.port.postMessage({type : "pause"});
		}
		resumeSong(){
			this.workletNode.port.postMessage({type : "resume"});
		}
		testSample(p){
			this.workletNode.port.postMessage({
				type   : "testsample",
				period : p
			})
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