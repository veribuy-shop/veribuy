import { randomInt } from 'crypto';

const ADJECTIVES = [
  'Amber', 'Bold', 'Brave', 'Bright', 'Calm', 'Clever', 'Cosmic', 'Crisp', 'Eager', 'Fair',
  'Gentle', 'Golden', 'Happy', 'Jolly', 'Keen', 'Kind', 'Lively', 'Lucky', 'Mellow', 'Nimble',
  'Noble', 'Polite', 'Proud', 'Quick', 'Quiet', 'Rapid', 'Sharp', 'Silver', 'Smart', 'Steady',
  'Sunny', 'Swift', 'Tidy', 'Vivid', 'Warm', 'Wise',
];

const NOUNS = [
  'Badger', 'Beacon', 'Comet', 'Cedar', 'Dolphin', 'Falcon', 'Finch', 'Fox', 'Harbour', 'Hawk',
  'Heron', 'Kestrel', 'Lantern', 'Lynx', 'Maple', 'Meadow', 'Otter', 'Owl', 'Panda', 'Pebble',
  'Penguin', 'Pine', 'Puffin', 'Raven', 'River', 'Robin', 'Rocket', 'Sparrow', 'Summit', 'Swan',
  'Tiger', 'Willow', 'Wolf', 'Wren',
];

/**
 * A public handle such as "SwiftOtter4821". It is shown instead of a person's
 * real name, so it must never be derived from their name or email.
 */
export function generateUsername(): string {
  const adjective = ADJECTIVES[randomInt(ADJECTIVES.length)];
  const noun = NOUNS[randomInt(NOUNS.length)];
  return `${adjective}${noun}${randomInt(1000, 10000)}`;
}

/** Runs `create` with fresh usernames until one doesn't collide with an existing profile. */
export async function withUniqueUsername<T>(create: (username: string) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await create(generateUsername());
    } catch (err: any) {
      const target = err?.meta?.target;
      const isUsernameClash = err?.code === 'P2002' && (!target || String(target).includes('username'));
      if (!isUsernameClash || attempt >= 4) throw err;
    }
  }
}
