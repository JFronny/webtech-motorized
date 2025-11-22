// DWT implementation based on some matlab code from stackoverflow

function dwtHaarOnce(data: Float32Array): { approx: Float32Array; detail: Float32Array } {
  const n = data.length - (data.length % 2);
  const half = n / 2;
  const approx = new Float32Array(half);
  const detail = new Float32Array(half);
  const invSqrt2 = 1 / Math.SQRT2;
  for (let i = 0, j = 0; i < n; i += 2, j++) {
    const a = data[i];
    const b = data[i + 1];
    approx[j] = (a + b) * invSqrt2;
    detail[j] = (a - b) * invSqrt2;
  }
  return { approx, detail };
}

export function dwtHaarLevels(data: Float32Array, levels: number): { details: Float32Array[]; approx: Float32Array } {
  const details: Float32Array[] = [];
  let cur = data;
  for (let l = 0; l < levels; l++) {
    if (cur.length < 2) break;
    const { approx, detail } = dwtHaarOnce(cur);
    details.push(detail);
    cur = approx;
  }
  return { details, approx: cur };
}

// Based on https://github.com/ederwander/Beat-Track
// Did not work at all, but that may just be because I didn't understand either matlab or the algorithm.
export function runBpm(signal: Float32Array, Fs: number): { bpm: number; envelopeSum: Float32Array } {
  const MinBPM = 40;
  const MaxBPM = 2000;
  const new_fs = 22050;
  const EnvelopeDecimated = 250;

  const { subBand: subBand1, numerator: num1, denominator: den1 } = subBandDWT(signal, Fs, 1, 200);
  const { subBand: subBand2, numerator: num2, denominator: den2 } = subBandDWT(signal, Fs, 200, 400);
  const { subBand: subBand3, numerator: num3, denominator: den3 } = subBandDWT(signal, Fs, 400, 800);
  const { subBand: subBand4, numerator: num4, denominator: den4 } = subBandDWT(signal, Fs, 800, 1600);
  const { subBand: subBand5, numerator: num5, denominator: den5 } = subBandDWT(signal, Fs, 1600, 3200);
  const { subBand: subBand6, numerator: num6, denominator: den6 } = subBandDWT(signal, Fs, 3200, 6400);

  const decimateValue = Math.ceil(Fs / new_fs);

  const envelope1 = envelope(subBand1, decimateValue, Fs, num1, den1);
  const envelope2 = envelope(subBand2, decimateValue, Fs, num2, den2);
  const envelope3 = envelope(subBand3, decimateValue, Fs, num3, den3);
  const envelope4 = envelope(subBand4, decimateValue, Fs, num4, den4);
  const envelope5 = envelope(subBand5, decimateValue, Fs, num5, den5);
  const envelope6 = envelope(subBand6, decimateValue, Fs, num6, den6);

  const envelopeSum = envelope1.map(
    (v, i) => v + envelope2[i] + envelope3[i] + envelope4[i] + envelope5[i] + envelope6[i],
  );
  const correlation = AutoCorrelation(envelopeSum, EnvelopeDecimated, MinBPM, MaxBPM);
  const maxIndex = correlation.indexOf(Math.max(...correlation));
  const bpm = (60 * EnvelopeDecimated) / maxIndex;
  return { bpm, envelopeSum };
}

function subBandDWT(
  signal: Float32Array,
  Fs: number,
  L: number,
  H: number,
): { subBand: Float32Array; numerator: number[]; denominator: number[] } {
  if (signal.length === 0) return { subBand: new Float32Array(0), numerator: [1, 0, 0], denominator: [1, 0, 0] };

  // MATLAB flow: highpass at L, then lowpass at H
  const highCoeffs = biquadCoeffs(Fs, "high", L);
  const hp = filtfilt(highCoeffs.b, highCoeffs.a, signal);

  const lowCoeffs = biquadCoeffs(Fs, "low", H);
  const sub = filtfilt(lowCoeffs.b, lowCoeffs.a, hp);

  // return numerator/denominator of the final (lowpass) filter to match MATLAB behavior
  return { subBand: sub, numerator: lowCoeffs.b, denominator: lowCoeffs.a };
}

// RBJ cookbook biquad design for 2nd-order Butterworth (Q = 1/sqrt(2))
function biquadCoeffs(Fs: number, type: "low" | "high", cutoffHz: number): { b: number[]; a: number[] } {
  const f0 = cutoffHz / Fs;
  const w0 = 2 * Math.PI * f0;
  const cosw0 = Math.cos(w0);
  const sinw0 = Math.sin(w0);
  const Q = 1 / Math.SQRT2;
  const alpha = sinw0 / (2 * Q);

  let b0: number, b1: number, b2: number;
  let a0: number, a1: number, a2: number;

  if (type === "low") {
    b0 = (1 - cosw0) / 2;
    b1 = 1 - cosw0;
    b2 = (1 - cosw0) / 2;
  } else {
    b0 = (1 + cosw0) / 2;
    b1 = -(1 + cosw0);
    b2 = (1 + cosw0) / 2;
  }

  a0 = 1 + alpha;
  a1 = -2 * cosw0;
  a2 = 1 - alpha;

  // normalize
  return {
    b: [b0 / a0, b1 / a0, b2 / a0],
    a: [1, a1 / a0, a2 / a0],
  };
}

// Forward-backward IIR filter (filtfilt)
function filterIIR(b: number[], a: number[], x: Float32Array): Float32Array {
  const y = new Float32Array(x.length);
  let x_n1 = 0,
    x_n2 = 0;
  let y_n1 = 0,
    y_n2 = 0;
  for (let n = 0; n < x.length; n++) {
    const xn = x[n];
    const yn = b[0] * xn + (b[1] || 0) * x_n1 + (b[2] || 0) * x_n2 - (a[1] || 0) * y_n1 - (a[2] || 0) * y_n2;
    y[n] = yn;
    x_n2 = x_n1;
    x_n1 = xn;
    y_n2 = y_n1;
    y_n1 = yn;
  }
  return y;
}

function filtfilt(b: number[], a: number[], x: Float32Array): Float32Array {
  const yForward = filterIIR(b, a, x);
  const rev = new Float32Array(yForward.length);
  for (let i = 0; i < yForward.length; i++) rev[i] = yForward[yForward.length - 1 - i];
  const yBack = filterIIR(b, a, rev);
  const y = new Float32Array(yBack.length);
  for (let i = 0; i < yBack.length; i++) y[i] = yBack[yBack.length - 1 - i];
  return y;
}

function envelope(
  SubBand: Float32Array,
  DecimateValue: number,
  Fs: number,
  numerator: number[],
  denominator: number[],
): Float32Array {
  // Full-wave rectification
  const absSub = new Float32Array(SubBand.length);
  for (let i = 0; i < SubBand.length; i++) absSub[i] = Math.abs(SubBand[i]);

  const LowPassSubBand = filtfilt(numerator, denominator, absSub);

  // Downsample (simple decimation)
  const bandsLen = Math.ceil(LowPassSubBand.length / DecimateValue);
  const bands = new Float32Array(bandsLen);
  for (let i = 0, j = 0; i < LowPassSubBand.length; i += DecimateValue, j++) bands[j] = LowPassSubBand[i];

  // Mean removal
  let sum = 0;
  for (let i = 0; i < bands.length; i++) sum += bands[i];
  const mean = bands.length ? sum / bands.length : 0;
  const meanRemoval = new Float32Array(bands.length);
  for (let i = 0; i < bands.length; i++) meanRemoval[i] = bands[i] - mean;

  // Moving average smoothing (window Tw = 0.1s at decimated sampling rate)
  const Tw = 0.1;
  const fsDec = Fs / DecimateValue;
  const Nw = Math.max(1, Math.round(Tw * fsDec));
  const rectifiedEnvelope = new Float32Array(meanRemoval.length);

  // Use cumulative sum for fast moving average (same-length / 'same' conv)
  const csum = new Float64Array(meanRemoval.length + 1);
  for (let i = 0; i < meanRemoval.length; i++) csum[i + 1] = csum[i] + meanRemoval[i];
  const half = Math.floor(Nw / 2);
  for (let i = 0; i < meanRemoval.length; i++) {
    const start = Math.max(0, i - half);
    const end = Math.min(meanRemoval.length - 1, start + Nw - 1);
    const cnt = end - start + 1;
    rectifiedEnvelope[i] = (csum[end + 1] - csum[start]) / cnt;
  }

  return rectifiedEnvelope;
}

export function AutoCorrelation(
  ENVELOPE: Float32Array,
  EnvelopeDecimated: number,
  MinBPM: number,
  MaxBPM: number,
): Float32Array {
  const EndPosition = Math.ceil((60 * EnvelopeDecimated) / MinBPM);
  const StartPosition = Math.ceil((60 * EnvelopeDecimated) / MaxBPM);
  const TotalSamples = ENVELOPE.length - EndPosition;
  const Xcorre = new Float32Array(EndPosition + 1); // allocate up to index EndPosition

  if (TotalSamples <= 0) return Xcorre;

  for (let pos = StartPosition; pos <= EndPosition; pos++) {
    let sum = 0;
    for (let i = 0; i < TotalSamples; i++) {
      sum += ENVELOPE[i] * ENVELOPE[i + pos];
    }
    Xcorre[pos] += sum;
  }

  return Xcorre;
}
