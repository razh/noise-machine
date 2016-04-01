// Modified from https://github.com/NHQ/oscillators/blob/master/oscillators.js
export const sin = f => t => Math.sin( t * 2 * Math.PI * f );

export const saw = f => {
  return t => {
    const n = ( ( t % ( 1 / f ) ) * f ) % 1;
    return -1 + 2 * n;
  };
};

export const saw_i = f => {
  return t => {
    const n = ( ( t % ( 1 / f ) ) * f ) % 1;
    return 1 - 2 * n;
  };
};

export const tri = f => {
  return t => {
    const n = ( ( t % ( 1 / f ) ) * f ) % 1;
    return n < 0.5 ? -1 + ( 2 * ( 2 * n ) ) : 1 - ( 2 * ( 2 * n ) );
  };
};

export const square = f => {
  return t => {
    const n = ( ( t % ( 1 / f ) ) * f ) % 1;
    return n > 0.5 ? 1 : -1;
  };
};

export const lowpass = f => {
  let sum = 0;
  return t => {
    sum += ( t - sum ) / f;
    return sum;
  };
};
