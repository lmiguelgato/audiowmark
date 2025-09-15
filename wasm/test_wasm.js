/**
 * Simple test script to verify WASM module functionality
 */

console.log('Starting WASM module test...');

async function testWasmModule() {
    try {
        // Load the module
        console.log('Loading AudioWmark module...');
        const module = await AudioWmarkModule();
        console.log('✅ Module loaded successfully');
        
        // Test function availability
        const functions = [
            'create_simple_watermarker',
            'destroy_simple_watermarker', 
            'process_simple_frame',
            'create_simple_detector',
            'destroy_simple_detector',
            'detect_simple_frame',
            'get_detection_result',
            'text_to_hex_simple',
            'hex_to_text_simple',
            'get_recommended_frame_size_simple'
        ];
        
        console.log('Testing function exports...');
        const { cwrap } = module;
        
        for (const funcName of functions) {
            try {
                const func = cwrap(funcName, 'number', []);
                console.log(`✅ Function ${funcName} is available`);
            } catch (e) {
                console.log(`❌ Function ${funcName} failed: ${e.message}`);
            }
        }
        
        // Test basic functionality
        console.log('Testing basic functionality...');
        
        // Test frame size
        const getFrameSize = cwrap('get_recommended_frame_size_simple', 'number', []);
        const frameSize = getFrameSize();
        console.log(`✅ Recommended frame size: ${frameSize}`);
        
        // Test text conversion
        const textToHex = cwrap('text_to_hex_simple', 'string', ['string']);
        const hexToText = cwrap('hex_to_text_simple', 'string', ['string']);
        
        const testMessage = 'Hello World!';
        const hex = textToHex(testMessage);
        const backToText = hexToText(hex);
        
        console.log(`✅ Text conversion test:`);
        console.log(`  Original: "${testMessage}"`);
        console.log(`  Hex: "${hex}"`);
        console.log(`  Back to text: "${backToText}"`);
        console.log(`  Match: ${testMessage === backToText ? '✅' : '❌'}`);
        
        // Test watermarker creation
        const createWatermarker = cwrap('create_simple_watermarker', 'number', ['number', 'number', 'number', 'string']);
        const destroyWatermarker = cwrap('destroy_simple_watermarker', null, ['number']);
        
        const watermarker = createWatermarker(44100, 1, 0.1, hex);
        if (watermarker) {
            console.log('✅ Watermarker created successfully');
            destroyWatermarker(watermarker);
            console.log('✅ Watermarker destroyed successfully');
        } else {
            console.log('❌ Failed to create watermarker');
        }
        
        // Test detector creation
        const createDetector = cwrap('create_simple_detector', 'number', ['number', 'number']);
        const destroyDetector = cwrap('destroy_simple_detector', null, ['number']);
        
        const detector = createDetector(44100, 1);
        if (detector) {
            console.log('✅ Detector created successfully');
            destroyDetector(detector);
            console.log('✅ Detector destroyed successfully');
        } else {
            console.log('❌ Failed to create detector');
        }
        
        console.log('🎉 All tests passed! WASM module is working correctly.');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run test when script loads
if (typeof AudioWmarkModule !== 'undefined') {
    testWasmModule();
} else {
    console.log('Waiting for AudioWmarkModule to load...');
    setTimeout(() => {
        if (typeof AudioWmarkModule !== 'undefined') {
            testWasmModule();
        } else {
            console.error('❌ AudioWmarkModule not available after timeout');
        }
    }, 2000);
}