import { generateAudioBuffer, playSound } from './audio';
import { sin, saw, saw_i, tri, square, lowpass } from './osc';

const A4 = 69;
const toFreq = note => Math.pow( 2, ( note - A4 ) / 12 ) * 440;

const noteNames = [ 'c', 'cs', 'd', 'ds', 'e', 'f', 'fs', 'g', 'gs', 'a', 'as', 'b' ];
const note = ( name, octave ) => toFreq( noteNames.indexOf( name ) + 12 * ( octave + 1 ) );

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
}

const lowp_sin_delay = f => {
  const sawsin = mix( mix( saw( f / 4 ), sin( f ), 0.6 ), tri( f * 2 ), 0.1 );
  const lowpsin = compose( lowpass( 1100 ), sawsin );
  return gain( compress( mix( lowpsin, gain( delay( lowpsin, -0.1 ), 0.2 ), 0.2 ), 0.4, 3 ), 2 );
};

const sound = generateAudioBuffer( lowp_sin_delay( note( 'a', 4 ) ), 0.3, 0.2 );
const sound2 = generateAudioBuffer( lowp_sin_delay( note( 'a', 3 ) ), 0.3, 0.2 );
const sound3 = generateAudioBuffer( lowp_sin_delay( note( 'e', 4 ) ), 0.3, 0.2 );

playSound( sound );
playSound( sound2, 0.2 );
playSound( sound2, 0.4 );
playSound( sound3, 0.6 );
playSound( sound, 0.8 );
playSound( sound2, 1 );
playSound( sound3, 1.2 );
playSound( sound2, 1.4 );
