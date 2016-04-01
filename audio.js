const AudioContext = window.AudioContext || window.webkitAudioContext;

export const audioContext = new AudioContext();
const { sampleRate } = audioContext;

// delay is in seconds.
export function playSound( sound, delay, destination = audioContext.destination ) {
  const source = audioContext.createBufferSource();
  source.buffer = sound;
  source.connect( destination );
  source.start( delay ? audioContext.currentTime + delay : 0 );
}

// duration is in seconds.
export function generateAudioBuffer( fn, duration, volume ) {
  const length = duration * sampleRate;

  const buffer = audioContext.createBuffer( 1, length, sampleRate );
  const channel = buffer.getChannelData(0);
  for ( let i = 0; i < length; i++ ) {
    channel[i] = fn( i / sampleRate, i, channel ) * volume;
  }

  return buffer;
}
