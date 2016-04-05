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

const compose = ( ...fns ) => t => fns.reduce( ( out, fn ) => fn( out ), t );
const mix = ( a, b, x ) => t => ( 1 - x ) * a( t ) + x * b( t );
const delay = ( fn, d ) => t => fn( t + d );
const gain = ( fn, gain ) => t => gain * fn( t );

const compress = ( fn, threshold, ratio ) => t => {
  const out = fn( t );
  const delta = Math.abs( out ) - threshold;

  if ( delta > 0 ) {
    return Math.sign( out ) * ( threshold + delta / ratio );
  }

  return out;
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
convolver.buffer = generateAudioBuffer( impulseResponse, 1, 1 );

const lowp_sin_delay = f => {
  const sawsin = mix( mix( saw( f / 4 ), sin( f ), 0.6 ), tri( f * 2 ), 0.1 );
  const lowpsin = compose( lowpass( 1100 ), sawsin );
  return gain( compress( mix( lowpsin, gain( delay( lowpsin, -0.1 ), 0.2 ), 0.2 ), 0.4, 3 ), 2 );
};

const sound = generateAudioBuffer( lowp_sin_delay( n_o( 'a', 4 ) ), 0.3, 0.2 );
const sound2 = generateAudioBuffer( lowp_sin_delay( n_o( 'a', 3 ) ), 0.3, 0.2 );
const sound3 = generateAudioBuffer( lowp_sin_delay( n_o( 'e', 4 ) ), 0.3, 0.2 );

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
