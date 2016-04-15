import flow from 'lodash/flow';
import { audioContext, generateAudioBuffer, playSound } from './audio';
import { sin, saw, saw_i, tri, square, lowpass } from './osc';

const A4 = 69;
const toFreq = note => Math.pow( 2, ( note - A4 ) / 12 ) * 440;

const noteNames = [ 'c', 'cs', 'd', 'ds', 'e', 'f', 'fs', 'g', 'gs', 'a', 'as', 'b' ];
const n_o = ( name, octave ) => toFreq( noteNames.indexOf( name ) + 12 * ( octave + 1 ) );
const no = name => {
  const match = name.match( /^(\w+)(\d+)$/ );
  if ( match ) {
    const [ , note, octave ] = match;
    return n_o( note, Number( octave ) );
  }
};

const nos = name => name.split( '_' ).map( no ).filter( Boolean );

const lerp = ( a, b, t ) => a + t * ( b - a );
const inverseLerp = ( a, b, x ) => ( x - a ) / ( b - a );
const map = ( x, a, b, c, d ) => lerp( c, d, inverseLerp( a, b, x ) );
const mix = ( n, m, x ) => ( t, i, a ) => lerp( n( t, i, a ), m( t, i, a ), x );
const delay = ( fn, d ) => ( t, i, a ) => fn( t + d, i, a );
const gain = ( fn, gain ) => ( t, i, a ) => gain * fn( t, i, a );
const envelope = ( fn, env ) => ( t, i, a ) => fn( t, i, a ) * env( t, i, a );

const compress = ( fn, threshold, ratio ) => ( t, i, a ) => {
  const out = fn( t, i, a );
  const delta = Math.abs( out ) - threshold;

  if ( delta > 0 ) {
    return Math.sign( out ) * ( threshold + delta / ratio );
  }

  return out;
};

const adsr = ( a, d, s, r, sustainLevel ) => {
  d += a;
  s += d;
  r += s;

  return t => {
    if ( t <= a ) {
      return t / a;
    }

    if ( t <= d ) {
      return 1 + ( sustainLevel - 1 ) * ( t - a ) / ( d - a );
    }

    if ( t <= s ) {
      return sustainLevel;
    }

    if ( t <= r ) {
      return sustainLevel + ( 1 - ( t - s ) / ( r - s ) );
    }

    return 0;
  }
}

const extent = buffer => {
  let min = Infinity;
  let max = -Infinity;

  for ( let i = 0; i < buffer.length; i++ ) {
    if ( buffer[i] < min ) {
      min = buffer[i];
    }

    if ( buffer[i] > max ) {
      max = buffer[i];
    }
  }

  return [ min, max ];
}

const graph = ( buffer, width = 480, height = 270 ) => {
  const range = extent( buffer );
  range[0] = Math.min( range[0], -1 );
  range[1] = Math.max( range[1], 1 );

  const x = i => width * i / buffer.length;
  const y = d => map( d, range[0], range[1], height, 0 );

  const canvas = document.createElement( 'canvas' );
  const ctx = canvas.getContext( '2d' );

  canvas.width = width;
  canvas.height = height;

  ctx.moveTo( x( 0 ), y( buffer[0] ) );
  for ( let i = 1; i < buffer.length; i++ ) {
    ctx.lineTo( x( i ), y( buffer[i] ) );
  }

  ctx.strokeStyle = '#fff';
  ctx.stroke();

  document.body.appendChild( canvas );
};

const wet = audioContext.createGain();
wet.gain.value = 0.5;
wet.connect( audioContext.destination );

const dry = audioContext.createGain();
dry.gain.value = 1 - wet.gain.value;
dry.connect( audioContext.destination );

const convolver = audioContext.createConvolver();
convolver.connect( wet );

const master = audioContext.createGain();
master.connect( dry );
master.connect( convolver );

const impulseResponse = (t, i, a) => ( 2 * Math.random() - 1 ) * Math.pow( 1000, -i / a.length );
const impulseResponseBuffer = generateAudioBuffer( impulseResponse, 1, 1 );

function renderOffline() {
  const { sampleRate } = audioContext;
  const offlineCtx = new OfflineAudioContext( 1, impulseResponseBuffer.length, sampleRate );

  const offlineFilter = offlineCtx.createBiquadFilter();
  offlineFilter.type = 'lowpass';
  offlineFilter.Q.value = 0.0001;
  offlineFilter.frequency.value = 440;
  offlineFilter.frequency.linearRampToValueAtTime( 220, 1 );
  offlineFilter.connect( offlineCtx.destination );

  const offlineBufferSource = offlineCtx.createBufferSource();
  offlineBufferSource.buffer = impulseResponseBuffer;
  offlineBufferSource.connect( offlineFilter );
  offlineBufferSource.start();

  offlineCtx.startRendering()
    .then( buffer => convolver.buffer = buffer );
}

renderOffline();

/*
  const sawsin = (
    saw( f / 4 ),
    mix( 0.6, sin( f ) ),
    mix( 0.1, tri( f * 2 ) ),
  );
 */
const lowp_sin_delay = f => {
  const sawsin = mix( mix( saw( f / 4 ), sin( f ), 0.6 ), tri( f * 2 ), 0.1 );
  const lowpsin = flow( lowpass( 1100 ), sawsin );
  return envelope(
    gain( compress( mix( lowpsin, gain( delay( lowpsin, -0.1 ), 0.2 ), 0.2 ), 0.4, 3 ), 2 ),
    adsr( 0.01, 0.2, 0.1, 0, 0.3 )
  );
};

const sound = generateAudioBuffer( lowp_sin_delay( n_o( 'a', 4 ) ), 0.3, 0.2 );
const sound2 = generateAudioBuffer( lowp_sin_delay( n_o( 'a', 3 ) ), 0.3, 0.2 );
const sound3 = generateAudioBuffer( lowp_sin_delay( n_o( 'e', 4 ) ), 0.3, 0.2 );
graph(sound.getChannelData(0));

playSound( sound, 0, master );
playSound( sound2, 0.2, master );
playSound( sound2, 0.4, master );
playSound( sound3, 0.6, master );
playSound( sound, 0.8, master );
playSound( sound2, 1, master );
playSound( sound3, 1.2, master );
playSound( sound2, 1.4, master );

class Sequencer {
  constructor( instrument, {
    bpm = 90,
    timeSignature = [ 4, 4 ],
    destination
  } = {} ) {
    this.instrument = instrument;
    this.bpm = bpm;
    this.timeSignature = timeSignature;
    this.destination = destination;
    this.cache = {};

    this.play = this.play.bind( this );
  }

  play( note ) {
    let buffer = this.cache[ note ];
    if ( !buffer ) {
      buffer = generateAudioBuffer( this.instrument( note ), 0.3, 0.2 );
      this.cache[ note ] = buffer;
    }

    playSound( buffer, 0, this.destination );
  }

  sequence( notes ) {
    notes.reduce( ( promise, note ) => {
      return promise.then( () => {
        return new Promise( resolve => {
          const beat = 60 * 1000 / this.bpm * ( this.timeSignature[0] / this.timeSignature[1] );

          switch ( typeof note ) {
            // Play note for one beat.
            case 'string':
              console.log( 'Play', nos( note ) );
              nos( note ).map( this.play );
              setTimeout( resolve, beat );
              break;

            // Rest,
            case 'number':
              setTimeout( resolve, note * beat );
              break;

            // Polyphonic.
            case 'object':
              Promise.all( Object.keys( note ).map( key => {
                return new Promise( resolve => {
                  if ( typeof note[ key ] === 'number') {
                    console.log( 'Play', key, nos( key ), 'for', note[ key ] );
                    nos( key ).map( this.play );
                    setTimeout( resolve, note[ key ] * beat );
                  } else {
                    resolve();
                  }
                });
              }))
              .then( resolve );
              break;

            // Tap into synth.
            case 'function':
              note( this );
              resolve();
              break;

            default:
              resolve();
          }
        });
      });
    }, Promise.resolve() );
  }
}

const sequencer = new Sequencer( lowp_sin_delay, {
  destination: master
});
const sequence = [
  // A4 with one beat in the default time signature.
  'a4',
  // Amaj chord with one beat in the default time signature.
  'a4_cs4_e4',
  // A4 with a quarter note.
  { a4: 1 / 2 },
  [ 'a4', 1 / 2 ],
  // Rest for half note.
  1 / 2,
  [ 0, 1 / 2 ],
  // Play Amaj for a quarter note with a delay of a sixteenth note.
  // Positional arguments?
  // Needs more complex configuration.
  { b3_g4: 1 / 4 },
  { a3_cs3_e3: [ 1 / 4, 1 / 16 ] },
  [ [ 'a3', 'cs3', 'e3' ], 1 / 4, 1 / 16 ],
  // A4 quarter note and D4 half note.
  { a3: 1 / 2, d4: 1 / 4 },
  // Tap into sequencer?
  s => s.bpm = 120,
  // C4 with new bpm.
  'c4',
  'd4',
  'e4',
];

setTimeout( () => sequencer.sequence( sequence ), 1500 );
