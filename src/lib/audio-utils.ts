/**
 * Convert a MediaRecorder audio blob to PCM 16kHz 16bit mono WAV.
 * This format is required by Azure Speech Pronunciation Assessment.
 */
export async function convertToWav16kMono(audioBlob: Blob): Promise<Blob> {
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  await audioContext.close();

  // Resample to 16kHz mono via OfflineAudioContext
  const targetSampleRate = 16000;
  const offlineCtx = new OfflineAudioContext(
    1,
    Math.ceil(audioBuffer.duration * targetSampleRate),
    targetSampleRate,
  );
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);
  const rendered = await offlineCtx.startRendering();

  // Float32 -> Int16 PCM
  const float32 = rendered.getChannelData(0);
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  // Build WAV file
  const wavHeader = createWavHeader(int16.byteLength, targetSampleRate);
  return new Blob([wavHeader, int16.buffer], { type: "audio/wav" });
}

function createWavHeader(
  dataSize: number,
  sampleRate: number,
  channels = 1,
  bitsPerSample = 16,
): ArrayBuffer {
  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // PCM format chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  return buffer;
}
