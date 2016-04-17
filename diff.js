export function diff( a, b ) {
  const length = Math.min( a.length, b.length );
  let sum = 0;

  for ( let i = 0; i < length; i++ ) {
    sum += Math.abs( a[i] - b[i] );
  }

  return sum / length;
}

export function rmsd( a, b ) {
  const length = Math.min( a.length, b.length );
  let squareError = 0;

  for ( let i = 0; i < length; i++ ) {
    squareError += Math.pow( a[i] - b[i], 2 );
  }

  return Math.sqrt( squareError / length );
}
