/**
 * Simplified AudioWmark Web Application
 */

class SimpleAudioWmarkApp {
    constructor() {
        this.wasmModule = null;
        this.audioContext = null;
        this.watermarker = null;
        this.detector = null;
        
        // Audio settings
        this.sampleRate = 44100;
        this.frameSize = 512;
        this.isInitialized = false;
        this.useAudioWorklets = true; // Prefer AudioWorklets, fallback to ScriptProcessorNode
        
        // Sender state
        this.senderActive = false;
        this.oscillator = null;
        this.audioBufferSource = null;
        this.currentAudioBuffer = null;
        this.senderGain = null;
        this.senderProcessor = null;
        
        // Receiver state
        this.receiverActive = false;
        this.micStream = null;
        this.receiverProcessor = null;
        
        // Statistics
        this.framesProcessed = 0;
        
        // WASM function wrappers
        this.wasmFunctions = {};
        
        this.initializeUI();
    }
    
    async initialize() {
        try {
            console.log('Loading AudioWmark WASM module...');
            
            // Wait for the AudioWmarkModule to be available
            if (typeof AudioWmarkModule === 'undefined') {
                console.log('Waiting for AudioWmarkModule to load...');
                await this.waitForModule();
            }
            
            // Load the WASM binary for use in AudioWorklet
            const wasmResponse = await fetch('./audiowmark.wasm');
            this.wasmBinary = await wasmResponse.arrayBuffer();
            console.log('WASM binary loaded for AudioWorklet');
            
            // Load WebAssembly module for main thread
            this.wasmModule = await AudioWmarkModule();
            console.log('AudioWmark WASM module loaded successfully');
            
            // Setup WASM function wrappers
            this.setupWasmFunctions();
            
            // Show user interaction screen (don't initialize audio yet)
            this.showUserInteractionScreen();
            
            console.log('Application ready for user interaction');
            
        } catch (error) {
            console.error('Failed to initialize:', error);
            this.showError('Failed to initialize AudioWmark: ' + error.message);
        }
    }
    
    async initializeAfterUserGesture() {
        try {
            console.log('Initializing audio system after user gesture...');
            
            // Initialize Web Audio (now with user gesture)
            await this.initializeAudioContext();
            
            this.isInitialized = true;
            this.showMainContent();
            this.updateSystemInfo();
            
            console.log('Application fully initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize audio:', error);
            this.showError('Failed to initialize audio: ' + error.message);
        }
    }
    
    waitForModule() {
        return new Promise((resolve, reject) => {
            const maxWaitTime = 10000; // 10 seconds timeout
            const checkInterval = 100; // Check every 100ms
            let elapsed = 0;
            
            const checkModule = () => {
                if (typeof AudioWmarkModule !== 'undefined') {
                    console.log('AudioWmarkModule is now available');
                    resolve();
                } else if (elapsed >= maxWaitTime) {
                    reject(new Error('AudioWmarkModule failed to load within timeout'));
                } else {
                    elapsed += checkInterval;
                    setTimeout(checkModule, checkInterval);
                }
            };
            
            checkModule();
        });
    }
    
    setupWasmFunctions() {
        const { cwrap } = this.wasmModule;
        
        // Verify cwrap is available
        if (!cwrap) {
            throw new Error('cwrap function not available in WASM module');
        }
        
        // Verify memory heaps are available
        if (!this.wasmModule.HEAPF32) {
            console.warn('HEAPF32 not immediately available, will check later');
        }
        
        this.wasmFunctions = {
            // Watermarker functions
            createWatermarker: cwrap('create_simple_watermarker', 'number', ['number', 'number', 'number', 'string']),
            destroyWatermarker: cwrap('destroy_simple_watermarker', null, ['number']),
            processFrame: cwrap('process_simple_frame', 'number', ['number', 'number', 'number', 'number', 'number']),
            
            // Detector functions
            createDetector: cwrap('create_simple_detector', 'number', ['number', 'number']),
            destroyDetector: cwrap('destroy_simple_detector', null, ['number']),
            detectFrame: cwrap('detect_simple_frame', null, ['number', 'number', 'number']),
            getDetectionResult: cwrap('get_detection_result', 'number', ['number', 'number', 'number', 'number']),
            
            // Utility functions
            textToHex: cwrap('text_to_hex_simple', 'string', ['string']),
            hexToText: cwrap('hex_to_text_simple', 'string', ['string']),
            getRecommendedFrameSize: cwrap('get_recommended_frame_size_simple', 'number', [])
        };
        
        console.log('WASM functions initialized');
        
        // Test a simple function to verify everything works
        try {
            const frameSize = this.wasmFunctions.getRecommendedFrameSize();
            console.log(`WASM function test successful, frame size: ${frameSize}`);
        } catch (error) {
            console.error('WASM function test failed:', error);
            throw new Error('WASM functions not working properly');
        }
    }
    
    async initializeAudioContext() {
        console.log('Creating AudioContext...');
        
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: this.sampleRate,
            latencyHint: 'interactive'
        });
        
        console.log(`AudioContext created with state: ${this.audioContext.state}`);
        
        // Resume if suspended (should work now due to user gesture)
        if (this.audioContext.state === 'suspended') {
            console.log('Resuming suspended AudioContext...');
            await this.audioContext.resume();
            console.log(`AudioContext resumed, new state: ${this.audioContext.state}`);
        }
        
        if (this.audioContext.state !== 'running') {
            throw new Error(`AudioContext failed to start. State: ${this.audioContext.state}. Make sure to enable audio with a user interaction.`);
        }
        
        this.sampleRate = this.audioContext.sampleRate;
        this.frameSize = this.wasmFunctions.getRecommendedFrameSize();
        
        // Load AudioWorklet processors
        try {
            await this.audioContext.audioWorklet.addModule('./watermark-sender-processor.js');
            await this.audioContext.audioWorklet.addModule('./watermark-receiver-processor.js');
            console.log('AudioWorklet processors loaded successfully');
        } catch (error) {
            console.warn('Failed to load AudioWorklet processors, falling back to ScriptProcessorNode:', error);
            this.useAudioWorklets = false;
        }
        
        console.log(`Audio context initialized successfully: ${this.sampleRate}Hz, frame size: ${this.frameSize}, state: ${this.audioContext.state}, AudioWorklets: ${this.useAudioWorklets !== false ? 'enabled' : 'disabled'}`);
    }
    
    initializeUI() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupEventListeners());
        } else {
            this.setupEventListeners();
        }
    }
    
    setupEventListeners() {
        // User interaction button
        const enableAudioBtn = document.getElementById('enable-audio');
        if (enableAudioBtn) {
            enableAudioBtn.addEventListener('click', () => this.initializeAfterUserGesture());
        }
        
        // Sender controls
        document.getElementById('start-sender').addEventListener('click', () => this.startSender());
        document.getElementById('stop-sender').addEventListener('click', () => this.stopSender());
        
        // Receiver controls
        document.getElementById('start-receiver').addEventListener('click', () => this.startReceiver());
        document.getElementById('stop-receiver').addEventListener('click', () => this.stopReceiver());
        
        // Volume control
        const volumeSlider = document.getElementById('sender-volume');
        volumeSlider.addEventListener('input', (e) => {
            const value = e.target.value;
            document.getElementById('sender-volume-value').textContent = value + '%';
            if (this.senderGain) {
                this.senderGain.gain.value = value / 100;
            }
        });
        
        // Audio source selection
        const audioSourceInputs = document.querySelectorAll('input[name="audio-source"]');
        audioSourceInputs.forEach(input => {
            input.addEventListener('change', () => this.handleAudioSourceChange());
        });
        
        // File input
        const audioFileInput = document.getElementById('audio-file');
        audioFileInput.addEventListener('change', (e) => this.handleFileSelection(e));
        
        // Initialize audio source display
        this.handleAudioSourceChange();
        
        console.log('Event listeners setup complete');
    }
    
    async startSender() {
        if (!this.isInitialized) {
            this.showError('System not initialized yet. Please click "Enable Audio & Start App" first.');
            return;
        }
        
        if (!this.audioContext || this.audioContext.state !== 'running') {
            this.showError('Audio context not ready. Please refresh and try again.');
            return;
        }
        
        try {
            // Get message and convert to hex
            const message = document.getElementById('message-input').value || 'Hello World!';
            const messageHex = this.wasmFunctions.textToHex(message);
            
            console.log(`Starting sender with message: "${message}" (hex: ${messageHex})`);
            
            if (!messageHex) {
                throw new Error('Failed to convert message to hex');
            }
            
            // Create watermarker
            this.watermarker = this.wasmFunctions.createWatermarker(
                this.sampleRate, 1, 0.1, messageHex // Higher strength for demo
            );
            
            if (!this.watermarker) {
                throw new Error('Failed to create watermarker');
            }
            
            console.log('Watermarker created successfully');
            
            // Setup audio generation and processing
            await this.setupSenderAudio();
            
            this.senderActive = true;
            this.updateSenderUI();
            this.updateSenderStatus('🎵 Playing tone with embedded watermark...', 'active');
            
        } catch (error) {
            console.error('Failed to start sender:', error);
            this.updateSenderStatus('❌ Error: ' + error.message, 'error');
        }
    }
    
    async setupSenderAudio() {
        const audioSource = document.querySelector('input[name="audio-source"]:checked').value;
        const volume = parseInt(document.getElementById('sender-volume').value) / 100;
        
        console.log(`Setting up sender audio: source=${audioSource}, volume=${volume}`);
        
        // Create gain node for volume control
        this.senderGain = this.audioContext.createGain();
        this.senderGain.gain.setValueAtTime(volume, this.audioContext.currentTime);
        
        // Setup the appropriate audio source
        if (audioSource === 'tone') {
            await this.setupToneSource();
        } else if (audioSource === 'recording') {
            await this.setupRecordingSource();
        }
        
        // Try to use AudioWorklet, fallback to ScriptProcessorNode
        if (this.useAudioWorklets !== false) {
            try {
                await this.setupSenderAudioWorklet();
            } catch (error) {
                console.warn('AudioWorklet setup failed, falling back to ScriptProcessorNode:', error);
                this.setupSenderScriptProcessor();
            }
        } else {
            this.setupSenderScriptProcessor();
        }
        
        // Connect audio graph: source -> processor -> gain -> destination
        if (this.oscillator) {
            this.oscillator.connect(this.senderProcessor);
        } else if (this.audioBufferSource) {
            this.audioBufferSource.connect(this.senderProcessor);
        }
        this.senderProcessor.connect(this.senderGain);
        this.senderGain.connect(this.audioContext.destination);
        
        // Start audio source
        if (this.oscillator) {
            this.oscillator.start();
        } else if (this.audioBufferSource) {
            this.audioBufferSource.start();
            
            // Setup loop for continuous playback
            this.audioBufferSource.loop = true;
        }
        
        console.log('Sender audio setup complete');
    }
    
    async setupToneSource() {
        const frequency = parseInt(document.getElementById('tone-frequency').value) || 440;
        
        // Create oscillator for test tone
        this.oscillator = this.audioContext.createOscillator();
        this.oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        this.oscillator.type = 'sine';
        
        console.log(`Created tone source: ${frequency}Hz`);
    }
    
    async setupRecordingSource() {
        if (!this.currentAudioBuffer) {
            throw new Error('No audio file loaded. Please select an audio file first.');
        }
        
        // Create audio buffer source node
        this.audioBufferSource = this.audioContext.createBufferSource();
        this.audioBufferSource.buffer = this.currentAudioBuffer;
        
        console.log(`Created recording source: ${this.currentAudioBuffer.duration.toFixed(2)}s, ${this.currentAudioBuffer.sampleRate}Hz`);
    }
    
    handleAudioSourceChange() {
        const audioSource = document.querySelector('input[name="audio-source"]:checked').value;
        const toneControls = document.getElementById('tone-controls');
        const recordingControls = document.getElementById('recording-controls');
        
        if (audioSource === 'tone') {
            toneControls.style.display = 'block';
            recordingControls.style.display = 'none';
        } else {
            toneControls.style.display = 'none';
            recordingControls.style.display = 'block';
        }
    }
    
    async handleFileSelection(event) {
        const file = event.target.files[0];
        if (!file) {
            this.currentAudioBuffer = null;
            this.updateFileInfo('');
            return;
        }
        
        try {
            console.log(`Loading audio file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
            this.updateFileInfo('Loading...');
            
            // Read file as array buffer
            const arrayBuffer = await file.arrayBuffer();
            
            // Decode audio data
            if (!this.audioContext) {
                await this.initializeAudioContext();
            }
            
            this.currentAudioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            const duration = this.currentAudioBuffer.duration.toFixed(2);
            const sampleRate = this.currentAudioBuffer.sampleRate;
            const channels = this.currentAudioBuffer.numberOfChannels;
            
            this.updateFileInfo(`${file.name} - ${duration}s, ${sampleRate}Hz, ${channels} channel(s)`);
            console.log(`Audio file loaded successfully: ${duration}s, ${sampleRate}Hz, ${channels} channels`);
            
        } catch (error) {
            console.error('Error loading audio file:', error);
            this.updateFileInfo('Error loading file: ' + error.message);
            this.currentAudioBuffer = null;
        }
    }
    
    updateFileInfo(text) {
        const fileInfo = document.getElementById('file-info');
        fileInfo.textContent = text;
        fileInfo.className = text ? 'file-info show' : 'file-info';
    }
    
    async setupSenderAudioWorklet() {
        // Create AudioWorkletNode
        this.senderProcessor = new AudioWorkletNode(this.audioContext, 'watermark-sender', {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            channelCount: 1
        });
        
        // Setup message handling
        this.senderProcessor.port.onmessage = (event) => {
            const data = event.data;
            switch (data.type) {
                case 'initialized':
                    if (data.success) {
                        console.log('Sender AudioWorklet initialized successfully');
                    } else {
                        console.error('Sender AudioWorklet initialization failed:', data.error);
                    }
                    break;
            }
        };
        
        // Initialize the worklet
        this.senderProcessor.port.postMessage({
            type: 'init',
            frameSize: this.frameSize,
            message: this.currentMessage || 'Demo Message',
            strength: 0.1,
            wasmBinary: this.wasmBinary
        });
        
        console.log('Sender AudioWorklet created');
    }
    
    setupSenderScriptProcessor() {
        // Fallback to ScriptProcessorNode
        const bufferSize = 4096;
        this.senderProcessor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
        
        // Allocate WASM memory for audio processing
        const inputPtr = this.wasmModule._malloc(bufferSize * 4);
        const outputPtr = this.wasmModule._malloc(bufferSize * 4);
        
        this.senderProcessor.onaudioprocess = (event) => {
            try {
                const inputBuffer = event.inputBuffer.getChannelData(0);
                const outputBuffer = event.outputBuffer.getChannelData(0);
                
                // Verify WASM module and memory are available
                if (!this.wasmModule || !this.wasmModule.HEAPF32) {
                    console.warn('WASM module or HEAPF32 not available, passing through audio');
                    outputBuffer.set(inputBuffer);
                    return;
                }
                
                // Copy input to WASM memory
                const inputArray = new Float32Array(this.wasmModule.HEAPF32.buffer, inputPtr, bufferSize);
                inputArray.set(inputBuffer);
                
                // Process through watermarker
                const success = this.wasmFunctions.processFrame(
                    this.watermarker, inputPtr, outputPtr, bufferSize, 1
                );
                
                if (success) {
                    // Copy output from WASM memory
                    const outputArray = new Float32Array(
                        this.wasmModule.HEAPF32.buffer, outputPtr, bufferSize
                    );
                    outputBuffer.set(outputArray);
                } else {
                    // Pass through original audio if watermarking fails
                    outputBuffer.set(inputBuffer);
                }
                
                this.framesProcessed++;
                if (this.framesProcessed % 100 === 0) {
                    this.updateFrameCounter();
                }
            } catch (error) {
                console.error('Error in audio processing:', error);
                // Pass through on error
                const inputBuffer = event.inputBuffer.getChannelData(0);
                const outputBuffer = event.outputBuffer.getChannelData(0);
                outputBuffer.set(inputBuffer);
            }
        };
        
        // Store pointers for cleanup
        this.senderProcessor.inputPtr = inputPtr;
        this.senderProcessor.outputPtr = outputPtr;
        
        console.log('Sender ScriptProcessorNode created (fallback)');
    }
    
    async startReceiver() {
        if (!this.isInitialized) {
            this.showError('System not initialized yet. Please click "Enable Audio & Start App" first.');
            return;
        }
        
        if (!this.audioContext || this.audioContext.state !== 'running') {
            this.showError('Audio context not ready. Please refresh and try again.');
            return;
        }
        
        try {
            console.log('Starting receiver...');
            
            // Request microphone access
            this.micStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: this.sampleRate
                }
            });
            
            console.log('Microphone access granted');
            
            // Create detector
            this.detector = this.wasmFunctions.createDetector(this.sampleRate, 1);
            if (!this.detector) {
                throw new Error('Failed to create detector');
            }
            
            console.log('Detector created successfully');
            
            // Setup audio processing
            await this.setupReceiverAudio();
            
            this.receiverActive = true;
            this.updateReceiverUI();
            this.updateReceiverStatus('🎤 Listening for watermarks...', 'detecting');
            
            // Start detection polling
            this.startDetectionPolling();
            
        } catch (error) {
            console.error('Failed to start receiver:', error);
            this.updateReceiverStatus('❌ Error: ' + error.message, 'error');
        }
    }
    
    async setupReceiverAudio() {
        const micSource = this.audioContext.createMediaStreamSource(this.micStream);
        
        // Try to use AudioWorklet, fallback to ScriptProcessorNode
        if (this.useAudioWorklets !== false) {
            try {
                await this.setupReceiverAudioWorklet();
            } catch (error) {
                console.warn('AudioWorklet setup failed, falling back to ScriptProcessorNode:', error);
                this.setupReceiverScriptProcessor();
            }
        } else {
            this.setupReceiverScriptProcessor();
        }
        
        micSource.connect(this.receiverProcessor);
        // Don't connect to destination - we're just analyzing
        
        console.log('Receiver audio setup complete');
    }
    
    async setupReceiverAudioWorklet() {
        // Create AudioWorkletNode
        this.receiverProcessor = new AudioWorkletNode(this.audioContext, 'watermark-receiver', {
            numberOfInputs: 1,
            numberOfOutputs: 0, // No output needed for detection
            channelCount: 1
        });
        
        // Setup message handling
        this.receiverProcessor.port.onmessage = (event) => {
            const data = event.data;
            switch (data.type) {
                case 'initialized':
                    if (data.success) {
                        console.log('Receiver AudioWorklet initialized successfully');
                    } else {
                        console.error('Receiver AudioWorklet initialization failed:', data.error);
                    }
                    break;
                case 'frameUpdate':
                    this.framesProcessed = data.frameCount;
                    this.updateFrameCounter();
                    break;
                case 'detection':
                    this.handleWorkletDetection(data);
                    break;
            }
        };
        
        // Initialize the worklet
        this.receiverProcessor.port.postMessage({
            type: 'init',
            frameSize: this.frameSize,
            wasmBinary: this.wasmBinary
        });
        
        console.log('Receiver AudioWorklet created');
    }
    
    setupReceiverScriptProcessor() {
        // Fallback to ScriptProcessorNode
        const bufferSize = 4096;
        this.receiverProcessor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
        
        // Allocate WASM memory
        const inputPtr = this.wasmModule._malloc(bufferSize * 4);
        
        this.receiverProcessor.onaudioprocess = (event) => {
            try {
                const inputBuffer = event.inputBuffer.getChannelData(0);
                
                // Verify WASM module and memory are available
                if (!this.wasmModule || !this.wasmModule.HEAPF32) {
                    console.warn('WASM module or HEAPF32 not available, skipping detection');
                    return;
                }
                
                // Copy input to WASM memory
                const inputArray = new Float32Array(this.wasmModule.HEAPF32.buffer, inputPtr, bufferSize);
                inputArray.set(inputBuffer);
                
                // Process through detector
                this.wasmFunctions.detectFrame(this.detector, inputPtr, bufferSize);
                
                this.framesProcessed++;
                if (this.framesProcessed % 100 === 0) {
                    this.updateFrameCounter();
                }
            } catch (error) {
                console.error('Error in detection processing:', error);
            }
        };
        
        this.receiverProcessor.inputPtr = inputPtr;
        
        console.log('Receiver ScriptProcessorNode created (fallback)');
    }
    
    handleWorkletDetection(data) {
        // Handle detection results from AudioWorklet
        const sensitivityThreshold = parseFloat(document.getElementById('detection-sensitivity').value);
        
        console.log(`AudioWorklet detection: message="${data.message}", confidence=${data.confidence}, threshold=${sensitivityThreshold}`);
        
        if (data.confidence >= sensitivityThreshold) {
            this.showDetectionResult(data.message, data.confidence);
            console.log(`Watermark detected via AudioWorklet: "${data.message}" (confidence: ${data.confidence.toFixed(2)})`);
        }
    }
    
    startDetectionPolling() {
        const checkDetection = () => {
            if (!this.receiverActive || !this.detector) return;
            
            // Allocate memory for result
            const messageBufferSize = 256;
            const messagePtr = this.wasmModule._malloc(messageBufferSize);
            const confidencePtr = this.wasmModule._malloc(8); // double
            
            try {
                const detected = this.wasmFunctions.getDetectionResult(
                    this.detector, messagePtr, messageBufferSize, confidencePtr
                );
                
                if (detected) {
                    const messageHex = this.wasmModule.UTF8ToString(messagePtr);
                    const confidence = this.wasmModule.getValue(confidencePtr, 'double');
                    
                    this.handleDetection(messageHex, confidence);
                }
                
            } catch (error) {
                console.error('Error in detection polling:', error);
            } finally {
                this.wasmModule._free(messagePtr);
                this.wasmModule._free(confidencePtr);
            }
            
            // Continue polling
            setTimeout(checkDetection, 500); // Check every 500ms
        };
        
        setTimeout(checkDetection, 1000); // Start after 1 second
    }
    
    handleDetection(messageHex, confidence) {
        const sensitivityThreshold = parseFloat(document.getElementById('detection-sensitivity').value);
        
        console.log(`Detection result: hex="${messageHex}", confidence=${confidence}, threshold=${sensitivityThreshold}`);
        
        if (confidence >= sensitivityThreshold) {
            let message;
            try {
                message = this.wasmFunctions.hexToText(messageHex) || messageHex;
            } catch (error) {
                message = messageHex; // Fallback to hex if conversion fails
            }
            
            this.showDetectionResult(message, confidence);
            
            console.log(`Watermark detected: "${message}" (confidence: ${confidence.toFixed(2)})`);
        }
    }
    
    showDetectionResult(message, confidence) {
        const resultDiv = document.getElementById('detection-result');
        const messageSpan = document.getElementById('detected-message');
        const confidenceSpan = document.getElementById('confidence-value');
        const confidenceFill = document.getElementById('confidence-fill');
        
        messageSpan.textContent = message;
        confidenceSpan.textContent = (confidence * 100).toFixed(1);
        confidenceFill.style.width = (confidence * 100) + '%';
        
        resultDiv.classList.add('show');
        
        // Hide after 10 seconds
        setTimeout(() => {
            resultDiv.classList.remove('show');
        }, 10000);
    }
    
    stopSender() {
        console.log('Stopping sender...');
        
        this.senderActive = false;
        
        if (this.oscillator) {
            this.oscillator.stop();
            this.oscillator = null;
        }
        
        if (this.audioBufferSource) {
            this.audioBufferSource.stop();
            this.audioBufferSource = null;
        }
        
        if (this.senderProcessor) {
            // Cleanup AudioWorklet or ScriptProcessorNode
            if (this.senderProcessor.port) {
                // AudioWorklet cleanup
                this.senderProcessor.port.postMessage({ type: 'destroy' });
            } else if (this.senderProcessor.inputPtr) {
                // ScriptProcessorNode cleanup
                this.wasmModule._free(this.senderProcessor.inputPtr);
                this.wasmModule._free(this.senderProcessor.outputPtr);
            }
            
            this.senderProcessor.disconnect();
            this.senderProcessor = null;
        }
        
        if (this.senderGain) {
            this.senderGain.disconnect();
            this.senderGain = null;
        }
        
        if (this.watermarker) {
            this.wasmFunctions.destroyWatermarker(this.watermarker);
            this.watermarker = null;
        }
        
        this.updateSenderUI();
        this.updateSenderStatus('⏹️ Stopped', 'idle');
    }
    
    stopReceiver() {
        console.log('Stopping receiver...');
        
        this.receiverActive = false;
        
        if (this.micStream) {
            this.micStream.getTracks().forEach(track => track.stop());
            this.micStream = null;
        }
        
        if (this.receiverProcessor) {
            // Cleanup AudioWorklet or ScriptProcessorNode
            if (this.receiverProcessor.port) {
                // AudioWorklet cleanup
                this.receiverProcessor.port.postMessage({ type: 'destroy' });
            } else if (this.receiverProcessor.inputPtr) {
                // ScriptProcessorNode cleanup
                this.wasmModule._free(this.receiverProcessor.inputPtr);
            }
            
            this.receiverProcessor.disconnect();
            this.receiverProcessor = null;
        }
        
        if (this.detector) {
            this.wasmFunctions.destroyDetector(this.detector);
            this.detector = null;
        }
        
        this.updateReceiverUI();
        this.updateReceiverStatus('⏹️ Stopped', 'idle');
        
        // Hide detection result
        document.getElementById('detection-result').classList.remove('show');
    }
    
    updateSenderUI() {
        const startBtn = document.getElementById('start-sender');
        const stopBtn = document.getElementById('stop-sender');
        
        startBtn.style.display = this.senderActive ? 'none' : 'block';
        stopBtn.style.display = this.senderActive ? 'block' : 'none';
        startBtn.disabled = !this.isInitialized;
    }
    
    updateReceiverUI() {
        const startBtn = document.getElementById('start-receiver');
        const stopBtn = document.getElementById('stop-receiver');
        
        startBtn.style.display = this.receiverActive ? 'none' : 'block';
        stopBtn.style.display = this.receiverActive ? 'block' : 'none';
        startBtn.disabled = !this.isInitialized;
    }
    
    updateSenderStatus(message, type) {
        const status = document.getElementById('sender-status');
        status.textContent = message;
        status.className = `status ${type}`;
    }
    
    updateReceiverStatus(message, type) {
        const status = document.getElementById('receiver-status');
        status.textContent = message;
        status.className = `status ${type}`;
    }
    
    updateSystemInfo() {
        document.getElementById('sample-rate').textContent = this.sampleRate;
        document.getElementById('frame-size').textContent = this.frameSize;
        document.getElementById('latency').textContent = Math.round(this.frameSize / this.sampleRate * 1000 * 10) / 10;
    }
    
    updateFrameCounter() {
        document.getElementById('frames-processed').textContent = this.framesProcessed;
    }
    
    showMainContent() {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('user-interaction').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
    }
    
    showUserInteractionScreen() {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('user-interaction').style.display = 'block';
        document.getElementById('main-content').style.display = 'none';
    }
    
    showError(message) {
        const loading = document.getElementById('loading');
        loading.innerHTML = `
            <div style="color: #f56565;">
                <h3>❌ Error</h3>
                <p>${message}</p>
                <p>Check the browser console for more details.</p>
            </div>
        `;
    }
}

// Initialize the application when the page loads
console.log('Initializing Simple AudioWmark App...');

// Wait for DOM content to be loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    // DOM is already loaded, wait a bit for scripts to be fully loaded
    setTimeout(initializeApp, 100);
}

function initializeApp() {
    const app = new SimpleAudioWmarkApp();
    app.initialize();
}