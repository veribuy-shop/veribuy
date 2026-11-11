import { randomInt } from 'crypto';

/** Used when there is no usable name to build a handle from. */
const FALLBACK_WORDS = [
  'badger', 'beacon', 'comet', 'cedar', 'falcon', 'finch', 'harbour', 'hawk', 'heron', 'kestrel',
  'lantern', 'lynx', 'maple', 'meadow', 'otter', 'pebble', 'puffin', 'raven', 'river', 'robin',
  'rocket', 'sparrow', 'summit', 'swan', 'tiger', 'willow', 'wren',
];

const STEM_LENGTH = 4;
const MIN_STEM_LENGTH = 3;

/** The first few letters of the surname (or only name), e.g. "Ayomide Johnson" gives "john". */
function nameStem(name: string | null | undefined): string | null {
  const words = (name ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .map((word) => word.replace(/[^a-zA-Z]/g, '').toLowerCase())
    .filter((word) => word.length >= MIN_STEM_LENGTH);
  const word = words.at(-1);
  return word ? word.slice(0, STEM_LENGTH) : null;
}

/**
 * A public handle such as "john2243", shown instead of a person's real name.
 * It borrows only a short fragment of the name, never the whole of it and
 * never anything from the email address.
 */
export function generateUsername(name?: string | null): string {
  const stem = nameStem(name) ?? FALLBACK_WORDS[randomInt(FALLBACK_WORDS.length)];
  return `${stem}${randomInt(1000, 10000)}`;
}

/** Runs `create` with fresh usernames until one doesn't collide with an existing profile. */
export async function withUniqueUsername<T>(
  create: (username: string) => Promise<T>,
  name?: string | null,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await create(generateUsername(name));
    } catch (err: any) {
      const target = err?.meta?.target;
      const isUsernameClash = err?.code === 'P2002' && (!target || String(target).includes('username'));
      if (!isUsernameClash || attempt >= 4) throw err;
    }
  }
}
