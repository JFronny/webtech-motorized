/*
MIT License

Copyright (c) 2022 Luis Villaseñor

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

export function FFT(signal: Float32Array | ComplexFloat32Array): ComplexFloat32Array {
  if (!(signal instanceof ComplexFloat32Array)) signal = new ComplexFloat32Array(signal);
  if (signal.length <= 1) return signal;
  const halfLength = signal.length >> 1; // ensures integer division. Shouldn't be necessary, but apparently it is.
  let even: ComplexFloat32Array = new ComplexFloat32Array(new Float32Array(halfLength));
  let odd: ComplexFloat32Array = new ComplexFloat32Array(new Float32Array(halfLength));
  for (let i = 0; i < halfLength; ++i) {
    even.re[i] = signal.re[i * 2];
    even.im[i] = signal.im[i * 2];
    odd.re[i] = signal.re[i * 2 + 1];
    odd.im[i] = signal.im[i * 2 + 1];
  }
  even = FFT(even);
  odd = FFT(odd);
  for (let k = 0; k < halfLength; ++k) {
    const a = Math.cos((2 * Math.PI * k) / signal.length);
    const b = Math.sin((-2 * Math.PI * k) / signal.length);
    const temp_k_real = odd.re[k] * a - odd.im[k] * b;
    const temp_k_imag = odd.re[k] * b + odd.im[k] * a;
    signal.re[k] = even.re[k] + temp_k_real;
    signal.im[k] = even.im[k] + temp_k_imag;
    signal.re[k + halfLength] = even.re[k] - temp_k_real;
    signal.im[k + halfLength] = even.im[k] - temp_k_imag;
  }
  return signal;
}

export function Abs(array: ComplexFloat32Array): Float32Array {
  const result = new Float32Array(array.length);
  for (let i = 0; i < array.length; ++i) {
    result[i] = Math.sqrt(array.re[i] * array.re[i] + array.im[i] * array.im[i]);
  }
  return result;
}

export class ComplexFloat32Array {
  re: Float32Array;
  im: Float32Array;

  constructor(re: Float32Array, im: Float32Array | null = null) {
    this.re = re;
    this.im = im || new Float32Array(re.length);
    if (re.length != this.im.length)
      throw new Error(`Incompatible arrays: ${re.length} == re.length != im.length == ${this.im.length}`);
  }

  get length(): number {
    return this.re.length;
  }
}
