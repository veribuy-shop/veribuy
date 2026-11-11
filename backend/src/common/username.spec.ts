import { generateUsername, withUniqueUsername } from './username';

describe('generateUsername', () => {
  it('uses the start of the surname and four digits', () => {
    expect(generateUsername('Ayomide Johnson')).toMatch(/^john\d{4}$/);
  });

  it('uses the only name when there is no surname', () => {
    expect(generateUsername('Ayomide')).toMatch(/^ayom\d{4}$/);
  });

  it('never contains the full name', () => {
    expect(generateUsername('Ayomide Johnson')).not.toContain('johnson');
    expect(generateUsername('Ayomide Johnson')).not.toContain('ayomide');
  });

  it('copes with accents, hyphens and punctuation', () => {
    expect(generateUsername('Zoë O’Brien-Müller')).toMatch(/^obri\d{4}$/);
  });

  it.each([undefined, null, '', '  ', 'Li', '张伟', '1234'])('falls back to a neutral word for %p', (name) => {
    expect(generateUsername(name)).toMatch(/^[a-z]{3,}\d{4}$/);
  });
});

describe('withUniqueUsername', () => {
  it('tries again with a new number when the username is taken', async () => {
    const clash = Object.assign(new Error('taken'), { code: 'P2002', meta: { target: ['username'] } });
    const create = jest.fn().mockRejectedValueOnce(clash).mockImplementation(async (username: string) => username);

    await expect(withUniqueUsername(create, 'Ayomide Johnson')).resolves.toMatch(/^john\d{4}$/);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('does not hide other database errors', async () => {
    const create = jest.fn().mockRejectedValue(new Error('db down'));
    await expect(withUniqueUsername(create, 'Ayomide Johnson')).rejects.toThrow('db down');
    expect(create).toHaveBeenCalledTimes(1);
  });
});
