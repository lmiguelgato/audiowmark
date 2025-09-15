/**
 * AudioWorklet processor for watermark detection
 * Uses actual WASM library for detection
 */

class WatermarkReceiverProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        
        this.initialized = false;
        this.frameSize = 512; // Recommended size from WASM
        this.sampleRate = sampleRate;
        this.frameCounter = 0;
        
        // WASM state
        this.wasmModule = null;
        this.detector = null;
        this.inputPtr = null;
        this.messageBuffer = null;
        this.messageBufferSize = 256;
        this.confidencePtr = null;
        this.wasmBinary = null;
        
        // Setup message handling
        this.port.onmessage = (event) => {
            this.handleMessage(event.data);
        };
        
        console.log('WatermarkReceiverProcessor created - waiting for WASM binary...');
    }
    
    async handleMessage(data) {
        switch (data.type) {
            case 'init':
                await this.initDetector(data);
                break;
            case 'destroy':
                this.cleanup();
                break;
        }
    }
    
    async initDetector(data) {
        try {
            this.frameSize = data.frameSize || 512;
            this.wasmBinary = data.wasmBinary;
            
            if (!this.wasmBinary) {
                throw new Error('WASM binary not provided');
            }
            
            console.log('Loading WASM module in receiver processor...');
            
            // Load WASM module from binary
            await this.loadWasmFromBinary();
            
            console.log(`Creating detector: SR=${this.sampleRate}`);
            
            // Create detector
            this.detector = this.wasmModule._create_simple_detector(
                this.sampleRate, 
                1 // mono
            );
            
            if (!this.detector) {
                throw new Error('Failed to create detector');
            }
            
            // Allocate audio buffer
            this.inputPtr = this.wasmModule._malloc(this.frameSize * 4); // 4 bytes per float
            
            // Allocate message buffer and confidence pointer
            this.messageBuffer = this.wasmModule._malloc(this.messageBufferSize);
            this.confidencePtr = this.wasmModule._malloc(8); // 8 bytes for double
            
            if (!this.inputPtr || !this.messageBuffer || !this.confidencePtr) {
                throw new Error('Failed to allocate buffers');
            }
            
            this.initialized = true;
            
            this.port.postMessage({ type: 'initialized', success: true });
            console.log('WatermarkReceiverProcessor initialized with WASM');
            
        } catch (error) {
            console.error('Failed to initialize detector:', error);
            this.port.postMessage({ type: 'initialized', success: false, error: error.message });
        }
    }
    
    async loadWasmFromBinary() {
        // Create a simple WASM module loader without dependencies
        const wasmImports = {
            a: (ptr, type, destructor) => { throw new Error('Exception thrown'); },
            b: () => { throw new Error('Abort called'); },
            c: (size) => false // resize heap - return false to indicate failure
        };
        
        const wasmInstance = await WebAssembly.instantiate(this.wasmBinary, { a: wasmImports });
        
        // Create a minimal module interface
        this.wasmModule = {
            instance: wasmInstance.instance,
            exports: wasmInstance.instance.exports,
            HEAPF32: null,
            HEAP8: null,
            HEAPU8: null,
            HEAPF64: null,
            
            // Memory management functions
            _malloc: wasmInstance.instance.exports.n,
            _free: wasmInstance.instance.exports.p,
            
            // Detector functions
            _create_simple_detector: wasmInstance.instance.exports.i,
            _destroy_simple_detector: wasmInstance.instance.exports.j,
            _detect_simple_frame: wasmInstance.instance.exports.k,
            _get_detection_result: wasmInstance.instance.exports.l,
            _hex_to_text_simple: wasmInstance.instance.exports.o,
            
            // Memory access
            memory: wasmInstance.instance.exports.d
        };
        
        // Update memory views
        this.updateMemoryViews();
    }
    
    updateMemoryViews() {
        const buffer = this.wasmModule.memory.buffer;
        this.wasmModule.HEAPF32 = new Float32Array(buffer);
        this.wasmModule.HEAP8 = new Int8Array(buffer);
        this.wasmModule.HEAPU8 = new Uint8Array(buffer);
        this.wasmModule.HEAPF64 = new Float64Array(buffer);
    }
    
    allocateString(str) {
        const length = str.length;
        const ptr = this.wasmModule._malloc(length + 1);
        for (let i = 0; i < length; i++) {
            this.wasmModule.HEAP8[ptr + i] = str.charCodeAt(i);
        }
        this.wasmModule.HEAP8[ptr + length] = 0; // null terminator
        return ptr;
    }
    
    UTF8ToString(ptr) {
        if (!ptr) return '';
        let str = '';
        let i = 0;
        while (this.wasmModule.HEAP8[ptr + i] !== 0) {
            str += String.fromCharCode(this.wasmModule.HEAP8[ptr + i]);
            i++;
        }
        return str;
    }
    
    process(inputs, outputs, parameters) {
        if (!this.initialized || !this.detector) {
            return true;
        }
        
        try {
            const input = inputs[0];
            
            if (input && input[0]) {
                const inputChannel = input[0];
                const frameSize = inputChannel.length;
                
                // Use smaller frames if needed to match our buffer size
                const processFrameSize = Math.min(frameSize, this.frameSize);
                
                // Update memory views if needed (memory might have grown)
                this.updateMemoryViews();
                
                // Copy input to WASM memory
                const inputArray = new Float32Array(
                    this.wasmModule.memory.buffer, 
                    this.inputPtr, 
                    processFrameSize
                );
                inputArray.set(inputChannel.subarray(0, processFrameSize));
                
                // Process through WASM detector
                this.wasmModule._detect_simple_frame(
                    this.detector,
                    this.inputPtr,
                    processFrameSize
                );
                
                this.frameCounter++;
                
                // Check for detection results every few frames
                if (this.frameCounter % 32 === 0) {
                    this.checkDetectionResult();
                }
                
                // Send frame counter update periodically
                if (this.frameCounter % 100 === 0) {
                    this.port.postMessage({ 
                        type: 'frameUpdate', 
                        frameCount: this.frameCounter 
                    });
                }
            }
        } catch (error) {
            console.error('Error in WASM detection processing:', error);
        }
        
        return true;
    }
    
    checkDetectionResult() {
        if (!this.wasmModule || !this.detector || !this.messageBuffer || !this.confidencePtr) {
            return;
        }
        
        try {
            // Get detection result from WASM
            const hasResult = this.wasmModule._get_detection_result(
                this.detector,
                this.messageBuffer,
                this.messageBufferSize,
                this.confidencePtr
            );
            
            if (hasResult) {
                // Read the message from WASM memory
                const message = this.UTF8ToString(this.messageBuffer);
                
                // Read the confidence from WASM memory
                const confidenceArray = new Float64Array(
                    this.wasmModule.memory.buffer, 
                    this.confidencePtr, 
                    1
                );
                const confidence = confidenceArray[0];
                
                if (confidence > 0.1) { // Threshold for reporting
                    // Convert hex message back to text using WASM function
                    const messagePtr = this.allocateString(message);
                    const textPtr = this.wasmModule._hex_to_text_simple(messagePtr);
                    this.wasmModule._free(messagePtr);
                    
                    let decodedMessage = message; // fallback to hex
                    if (textPtr) {
                        decodedMessage = this.UTF8ToString(textPtr);
                        this.wasmModule._free(textPtr);
                    }
                    
                    // Send detection result
                    this.port.postMessage({
                        type: 'detection',
                        message: decodedMessage,
                        hexMessage: message,
                        confidence: confidence,
                        frameCount: this.frameCounter
                    });
                    
                    console.log(`Watermark detected: "${decodedMessage}" (confidence: ${confidence.toFixed(3)})`);
                }
            }
        } catch (error) {
            console.error('Error checking detection result:', error);
        }
    }
    
    cleanup() {
        if (this.wasmModule) {
            if (this.detector) {
                this.wasmModule._destroy_simple_detector(this.detector);
                this.detector = null;
            }
            if (this.inputPtr) {
                this.wasmModule._free(this.inputPtr);
                this.inputPtr = null;
            }
            if (this.messageBuffer) {
                this.wasmModule._free(this.messageBuffer);
                this.messageBuffer = null;
            }
            if (this.confidencePtr) {
                this.wasmModule._free(this.confidencePtr);
                this.confidencePtr = null;
            }
        }
        this.initialized = false;
    }
}

registerProcessor('watermark-receiver', WatermarkReceiverProcessor);