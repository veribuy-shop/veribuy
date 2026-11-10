-- Public handle shown instead of a person's real name.
ALTER TABLE "profiles" ADD COLUMN "username" TEXT;

CREATE UNIQUE INDEX "profiles_username_key" ON "profiles"("username");

-- Give every existing profile a handle such as "SwiftOtter4821".
DO $$
DECLARE
  adjectives TEXT[] := ARRAY['Amber','Bold','Brave','Bright','Calm','Clever','Cosmic','Crisp','Eager','Fair','Gentle','Golden','Happy','Jolly','Keen','Kind','Lively','Lucky','Mellow','Nimble','Noble','Polite','Proud','Quick','Quiet','Rapid','Sharp','Silver','Smart','Steady','Sunny','Swift','Tidy','Vivid','Warm','Wise'];
  nouns TEXT[] := ARRAY['Badger','Beacon','Comet','Cedar','Dolphin','Falcon','Finch','Fox','Harbour','Hawk','Heron','Kestrel','Lantern','Lynx','Maple','Meadow','Otter','Owl','Panda','Pebble','Penguin','Pine','Puffin','Raven','River','Robin','Rocket','Sparrow','Summit','Swan','Tiger','Willow','Wolf','Wren'];
  profile RECORD;
  candidate TEXT;
BEGIN
  FOR profile IN SELECT "id" FROM "profiles" WHERE "username" IS NULL LOOP
    LOOP
      candidate := adjectives[1 + floor(random() * array_length(adjectives, 1))::int]
        || nouns[1 + floor(random() * array_length(nouns, 1))::int]
        || (1000 + floor(random() * 9000))::int;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM "profiles" WHERE "username" = candidate);
    END LOOP;
    UPDATE "profiles" SET "username" = candidate WHERE "id" = profile."id";
  END LOOP;
END $$;
