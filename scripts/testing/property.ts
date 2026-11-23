// A small property-based testing helper for the rules with large input spaces
// (docs/spec/05-engineering-handbook.md section 8: streak, merge,
// normalization). Randomness is seeded, so every run checks the same cases
// and a failure names the seed and the case that broke the property.
//
// It lives outside `src`, so tests in the pure modules can import it without
// an edge in the module table, and it is not product code.

/** A generator draws one value from a seeded source. */
export type Generator<T> = (random: Random) => T;

export type Random = {
  /** A float in [0, 1). */
  next: () => number;
  /** An integer in [min, max], both included. */
  int: (min: number, max: number) => number;
  pick: <T>(options: readonly T[]) => T;
};

/** mulberry32: small, fast, and good enough to spread test inputs. */
export function seeded(seed: number): Random {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const pick = <T>(options: readonly T[]): T => {
    const value = options[int(0, options.length - 1)];
    if (value === undefined) throw new Error("pick from an empty list");
    return value;
  };
  return { next, int, pick };
}

export type PropertyOptions = { runs?: number; seed?: number };

/**
 * Checks `property` on `runs` drawn values. Throws on the first value for
 * which the property returns false or throws, naming the seed and the value.
 */
export function forAll<T>(
  generator: Generator<T>,
  property: (value: T) => boolean | void,
  { runs = 500, seed = 20_261_120 }: PropertyOptions = {},
): void {
  const random = seeded(seed);
  for (let run = 0; run < runs; run += 1) {
    const value = generator(random);
    let holds: boolean | void;
    try {
      holds = property(value);
    } catch (error) {
      throw new Error(
        `property threw on run ${String(run)} (seed ${String(seed)}) for ${JSON.stringify(value)}: ${String(error)}`,
      );
    }
    if (holds === false) {
      throw new Error(
        `property failed on run ${String(run)} (seed ${String(seed)}) for ${JSON.stringify(value)}`,
      );
    }
  }
}

/** A string of 0 to `maxLength` characters drawn from `alphabet`. */
export function textFrom(alphabet: readonly string[], maxLength = 40): Generator<string> {
  return (random) => {
    const length = random.int(0, maxLength);
    let text = "";
    for (let index = 0; index < length; index += 1) text += random.pick(alphabet);
    return text;
  };
}

/** Pairs two generators. */
export function tuple<A, B>(first: Generator<A>, second: Generator<B>): Generator<[A, B]> {
  return (random) => [first(random), second(random)];
}
