import { Ionicons } from '@expo/vector-icons';
import { getEvidenceRequirements, validateImeiChecksum } from '@veribuy/common/evidence';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, ScrollViewInstance, Text, View } from 'react-native';

import { GuestGate } from '@/src/components/GuestGate';
import { PhotoSlot } from '@/src/components/PhotoSlot';
import { Button, Input, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';
import { formatPrice } from '@/src/lib/currency';
import { resolveDeviceWeightProfile } from '@/src/lib/shipping';
import { evidenceService, listingDraftService, listingsService, trustLensService } from '@/src/services';

const DEVICE_TYPES = ['SMARTPHONE', 'TABLET', 'LAPTOP', 'SMARTWATCH', 'AIRPODS', 'DESKTOP', 'GAMING_CONSOLE', 'OTHER'];
const CONDITION_GRADES = ['A', 'B', 'C'];
const STORAGE_OPTIONS = ['64GB', '128GB', '256GB', '512GB', '1TB', '2TB'];
const STEPS = ['Device', 'Photos', 'Details', 'Price'];
const MIN_TITLE = 10;
const MIN_DESCRIPTION = 50;

const CHIP_LABEL: Record<string, string> = {
  SMARTPHONE: 'Smartphone',
  TABLET: 'Tablet',
  LAPTOP: 'Laptop',
  SMARTWATCH: 'Smartwatch',
  AIRPODS: 'Earbuds',
  DESKTOP: 'Desktop',
  GAMING_CONSOLE: 'Games console',
  OTHER: 'Other',
  A: 'A · Pristine',
  B: 'B · Good',
  C: 'C · Fair',
};

const GRADE_HINT: Record<string, string> = {
  A: 'Looks like new, with no visible marks.',
  B: 'Light signs of use, fully working.',
  C: 'Clear wear, fully working.',
};

interface DraftFields {
  deviceType: string;
  brand: string;
  model: string;
  conditionGrade: string;
  storageCapacity: string;
  color: string;
  title: string;
  description: string;
  price: string;
  freeShipping: boolean;
}

const EMPTY: DraftFields = {
  deviceType: '',
  brand: '',
  model: '',
  conditionGrade: '',
  storageCapacity: '',
  color: '',
  title: '',
  description: '',
  price: '',
  freeShipping: false,
};

interface Photos {
  device: string[];
  screen: string[];
  settings: string[];
}

const NO_PHOTOS: Photos = { device: [], screen: [], settings: [] };

function ChipRow({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <View className="flex-row flex-wrap mb-3">
      {options.map((opt) => {
        const selected = value === opt;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            className={`mr-2 mb-2 px-3.5 min-h-10 justify-center rounded-full border ${selected ? 'bg-primary border-primary' : 'bg-surface border-border-strong'}`}
          >
            <Text className={`text-[13px] font-medium ${selected ? 'text-white' : 'text-text'}`}>{CHIP_LABEL[opt] ?? opt}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Label({ children }: { children: string }) {
  return <Text className="text-[13px] font-medium text-text mb-2">{children}</Text>;
}

function DeliveryOption({
  selected,
  title,
  note,
  onPress,
}: {
  selected: boolean;
  title: string;
  note: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className={`p-3.5 rounded-2xl border mb-2.5 flex-row ${selected ? 'bg-emerald-50 border-emerald-600' : 'bg-surface border-borderc'}`}
    >
      <View className={`w-5 h-5 mt-0.5 rounded-full border-2 items-center justify-center mr-3 ${selected ? 'border-emerald-600' : 'border-border-strong'}`}>
        {selected ? <View className="w-2.5 h-2.5 rounded-full bg-emerald-600" /> : null}
      </View>
      <View className="flex-1">
        <Text className="text-[15px] font-semibold text-text">{title}</Text>
        <Text className="text-[13px] text-text-muted mt-0.5 leading-[18px]">{note}</Text>
      </View>
    </Pressable>
  );
}

export default function SellScreen() {
  const { isAuthenticated, user } = useAuth();
  const [step, setStep] = useState(1);
  const [fields, setFields] = useState<DraftFields>(EMPTY);
  const [imei, setImei] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [photos, setPhotos] = useState<Photos>(NO_PHOTOS);
  const [preparingPhotos, setPreparingPhotos] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [webOnlyDraft, setWebOnlyDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  const scrollRef = useRef<ScrollViewInstance>(null);
  const touched = useRef(false);
  const submitted = useRef(false);
  const draftChecked = useRef(false);
  // Kept across retries, so a failed upload never creates a second listing or re-sends photos.
  const createdListingId = useRef<string | null>(null);
  const uploaded = useRef(new Set<string>());

  const evidence = getEvidenceRequirements(fields.deviceType);
  const screenShown = evidence.screen.level !== 'hidden';
  const imeiCheck = validateImeiChecksum(imei);
  const parsedPrice = Number(fields.price);
  const isValidPrice = Number.isFinite(parsedPrice) && parsedPrice >= 0.01;
  const weightProfile = fields.deviceType
    ? resolveDeviceWeightProfile(fields.deviceType, fields.brand, fields.model, 1)
    : null;

  const update = <K extends keyof DraftFields>(key: K, value: DraftFields[K]) => {
    touched.current = true;
    setError('');
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  // Pick up a listing started on the web. Never overwrites what's being typed here.
  useFocusEffect(
    useCallback(() => {
      if (!user?.id || touched.current) return;
      let cancelled = false;
      listingDraftService
        .get()
        .then((draft) => {
          draftChecked.current = true;
          if (cancelled || touched.current || !draft?.data) return;
          const data = draft.data as Partial<DraftFields> & { format?: string; isBulkListing?: boolean };
          setWebOnlyDraft(data.format === 'AUCTION' || data.isBulkListing === true);
          setFields({ ...EMPTY, ...pickDraftFields(data) });
          setStep(Math.min(Math.max(draft.step ?? 1, 1), STEPS.length));
          setDraftRestored(true);
        })
        .catch(() => {
          draftChecked.current = true;
        });
      return () => {
        cancelled = true;
      };
    }, [user?.id]),
  );

  // Saved to the account so it can be finished on the web. Photos and identifiers stay out.
  useEffect(() => {
    if (!user?.id || !touched.current || submitted.current || webOnlyDraft) return;
    const timer = setTimeout(() => {
      listingDraftService.save(fields as unknown as Record<string, unknown>, step).catch(() => undefined);
    }, 1000);
    return () => clearTimeout(timer);
  }, [user?.id, fields, step, webOnlyDraft]);

  const startOver = () => {
    touched.current = false;
    setFields(EMPTY);
    setImei('');
    setSerialNumber('');
    setPhotos(NO_PHOTOS);
    setStep(1);
    setDraftRestored(false);
    setWebOnlyDraft(false);
    setError('');
    createdListingId.current = null;
    uploaded.current = new Set();
    listingDraftService.clear().catch(() => undefined);
  };

  const stepError = (current: number): string | null => {
    if (current === 1) {
      if (!fields.deviceType) return 'Choose the type of device.';
      if (!fields.brand.trim() || !fields.model.trim()) return 'Enter the brand and model.';
      if (!fields.conditionGrade) return 'Choose the condition.';
    }
    if (current === 2) {
      if (photos.device.length < evidence.device.minCount) {
        return `Add at least ${evidence.device.minCount} device photos.`;
      }
      if (evidence.screen.level === 'required' && photos.screen.length < evidence.screen.minCount) {
        return 'Add a photo of the screen switched on.';
      }
    }
    if (current === 3) {
      if (fields.title.trim().length < MIN_TITLE) return `The title needs at least ${MIN_TITLE} characters.`;
      if (fields.description.trim().length < MIN_DESCRIPTION) {
        return `The description needs at least ${MIN_DESCRIPTION} characters.`;
      }
      if (fields.deviceType === 'SMARTPHONE' && !imeiCheck.valid) {
        if (imeiCheck.status === 'empty') return 'Enter the phone’s 15-digit IMEI. Dial *#06# to find it.';
        return imeiCheck.status === 'incomplete' ? `The IMEI is too short: ${imeiCheck.message}.` : imeiCheck.message;
      }
    }
    if (current === 4 && !isValidPrice) return 'Enter your price.';
    return null;
  };

  const goTo = (next: number) => {
    touched.current = true;
    setError('');
    setStep(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const onContinue = () => {
    const problem = stepError(step);
    if (problem) {
      setError(problem);
      return;
    }
    // Save typing: suggest a title from what they've already told us.
    if (step === 2 && !fields.title.trim()) {
      const suggestion = [fields.brand, fields.model, fields.storageCapacity, fields.color]
        .map((part) => part.trim())
        .filter(Boolean)
        .join(' ');
      setFields((prev) => ({ ...prev, title: suggestion }));
    }
    goTo(step + 1);
  };

  const uploadPhotos = async (listingId: string) => {
    const queue = [
      ...photos.device.map((uri) => ({ uri, type: 'DEVICE_IMAGE' })),
      ...(screenShown ? photos.screen.map((uri) => ({ uri, type: 'SCREEN_IMAGE' })) : []),
      ...photos.settings.map((uri) => ({ uri, type: 'SETTINGS_SCREENSHOT' })),
    ];
    const pending = queue.filter(({ uri }) => !uploaded.current.has(uri));
    let done = queue.length - pending.length;
    setProgress(`Uploading photo ${Math.min(done + 1, queue.length)} of ${queue.length}…`);

    let failed = 0;
    // Two at a time: several large parallel uploads stall on mobile data.
    const worker = async () => {
      for (let next = pending.shift(); next; next = pending.shift()) {
        let ok = false;
        for (let attempt = 0; attempt < 2 && !ok; attempt++) {
          try {
            await evidenceService.upload(
              listingId,
              { uri: next.uri, name: 'evidence.jpg', type: 'image/jpeg' },
              { type: next.type },
            );
            ok = true;
          } catch {
            // One retry, then report it.
          }
        }
        if (ok) {
          uploaded.current.add(next.uri);
          done += 1;
          setProgress(`Uploading photo ${Math.min(done + 1, queue.length)} of ${queue.length}…`);
        } else {
          failed += 1;
        }
      }
    };
    await Promise.all([worker(), worker()]);
    return failed;
  };

  const onPublish = async () => {
    for (const current of [1, 2, 3, 4]) {
      const problem = stepError(current);
      if (problem) {
        setStep(current);
        setError(problem);
        return;
      }
    }

    setSubmitting(true);
    setError('');
    const cleanImei = fields.deviceType === 'SMARTPHONE' ? imei.replace(/[\s-]/g, '') : '';
    try {
      if (!createdListingId.current) {
        setProgress('Saving your listing…');
        const listing = await listingsService.create({
          title: fields.title.trim(),
          description: fields.description.trim(),
          deviceType: fields.deviceType,
          brand: fields.brand.trim(),
          model: fields.model.trim(),
          price: parsedPrice,
          currency: 'GBP',
          freeShipping: fields.freeShipping,
          conditionGrade: fields.conditionGrade,
          ...(fields.storageCapacity ? { storageCapacity: fields.storageCapacity } : {}),
          ...(fields.color.trim() ? { color: fields.color.trim() } : {}),
          ...(serialNumber.trim() ? { serialNumber: serialNumber.trim() } : {}),
          ...(cleanImei ? { imei: cleanImei } : {}),
        });
        createdListingId.current = listing.id;
      }

      const failed = await uploadPhotos(createdListingId.current);
      if (failed > 0) {
        setError(
          `${failed} photo${failed === 1 ? '' : 's'} didn’t upload. Check your connection and tap Publish again. Only the missing photos will be sent.`,
        );
        return;
      }

      setProgress('Sending for review…');
      let reviewStarted = true;
      try {
        await trustLensService.submit({
          listingId: createdListingId.current,
          conditionGrade: fields.conditionGrade,
          imeiProvided: !!cleanImei,
          serialProvided: !!serialNumber.trim(),
          imei: cleanImei || undefined,
          serialNumber: serialNumber.trim() || undefined,
          brand: fields.brand.trim(),
        });
      } catch {
        reviewStarted = false;
      }

      submitted.current = true;
      await listingDraftService.clear().catch(() => undefined);
      startOver();
      submitted.current = false;
      Alert.alert(
        reviewStarted ? 'Listing submitted' : 'Listing saved',
        reviewStarted
          ? 'Your listing is with Trust Lens for review. We’ll message you when it’s live.'
          : 'Your listing and photos are saved, but we couldn’t start the review. Please contact support so we can finish it.',
        [{ text: 'See your listings', onPress: () => router.push('/my-listings') }],
      );
    } catch (e: any) {
      setError(e?.message || 'We could not create your listing. Please try again.');
    } finally {
      setSubmitting(false);
      setProgress('');
    }
  };

  if (!isAuthenticated) {
    return (
      <GuestGate
        title="Sell with 0% commission"
        subtitle="Sign in or create an account to list your device with a Trust Lens review and tracked Royal Mail shipping."
        icon="cash-outline"
      />
    );
  }

  return (
    <Screen safeTop>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <View className="mb-3">
          <View className="flex-row items-end justify-between mb-2">
            <Text className="text-[28px] font-bold text-text">Sell your device</Text>
            <Text className="text-[13px] text-text-muted mb-1.5">
              Step {step} of {STEPS.length}
            </Text>
          </View>
          <View
            className="flex-row gap-1.5"
            accessibilityRole="progressbar"
            accessibilityLabel={`Step ${step} of ${STEPS.length}: ${STEPS[step - 1]}`}
          >
            {STEPS.map((name, index) => (
              <View key={name} className={`flex-1 h-1.5 rounded-full ${index < step ? 'bg-emerald-600' : 'bg-surface-dim'}`} />
            ))}
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingBottom: 16 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {draftRestored ? (
            <View className="bg-surface border border-borderc rounded-2xl p-3.5 mb-4 flex-row items-center">
              <Text className="flex-1 text-[13px] text-text-muted leading-[18px] mr-3">
                {webOnlyDraft
                  ? 'You started an auction or bulk listing on the web. Please finish it at veribuy.shop.'
                  : 'We restored your unfinished listing. Photos, IMEI and serial number need adding again.'}
              </Text>
              <Pressable onPress={startOver} accessibilityRole="button" hitSlop={8}>
                <Text className="text-[13px] font-semibold text-emerald-700">Start over</Text>
              </Pressable>
            </View>
          ) : null}

          {step === 1 ? (
            <>
              <Label>Device type</Label>
              <ChipRow options={DEVICE_TYPES} value={fields.deviceType} onChange={(v) => update('deviceType', v)} />
              <Input label="Brand" placeholder="e.g. Apple" value={fields.brand} onChangeText={(v) => update('brand', v)} />
              <Input label="Model" placeholder="e.g. iPhone 14 Pro" value={fields.model} onChangeText={(v) => update('model', v)} />
              <Label>Condition</Label>
              <ChipRow options={CONDITION_GRADES} value={fields.conditionGrade} onChange={(v) => update('conditionGrade', v)} />
              {fields.conditionGrade ? (
                <Text className="text-[13px] text-text-muted -mt-1 mb-4">{GRADE_HINT[fields.conditionGrade]}</Text>
              ) : null}
              {fields.deviceType !== 'AIRPODS' ? (
                <>
                  <Label>Storage (optional)</Label>
                  <ChipRow options={STORAGE_OPTIONS} value={fields.storageCapacity} onChange={(v) => update('storageCapacity', v)} />
                </>
              ) : null}
              <Input label="Colour (optional)" value={fields.color} onChangeText={(v) => update('color', v)} />
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Text className="text-[15px] text-text-muted mb-4 leading-[22px]">
                Clear photos in good light sell faster. Show any marks honestly: buyers check against these photos.
              </Text>
              <PhotoSlot
                label={evidence.device.label}
                hint={evidence.device.hint}
                required
                minCount={evidence.device.minCount}
                photos={photos.device}
                onChange={(device) => setPhotos((prev) => ({ ...prev, device }))}
                onBusy={setPreparingPhotos}
              />
              {screenShown ? (
                <PhotoSlot
                  label={evidence.screen.label}
                  hint={evidence.screen.hint}
                  required={evidence.screen.level === 'required'}
                  minCount={evidence.screen.minCount}
                  photos={photos.screen}
                  onChange={(screen) => setPhotos((prev) => ({ ...prev, screen }))}
                  onBusy={setPreparingPhotos}
                />
              ) : null}
              <PhotoSlot
                label={evidence.settings.label}
                hint={evidence.settings.hint}
                required={false}
                minCount={0}
                photos={photos.settings}
                onChange={(settings) => setPhotos((prev) => ({ ...prev, settings }))}
                onBusy={setPreparingPhotos}
              />
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Input
                label="Title"
                placeholder="e.g. iPhone 14 Pro 256GB, Space Black"
                value={fields.title}
                onChangeText={(v) => update('title', v)}
              />
              <Input
                label={`Description (at least ${MIN_DESCRIPTION} characters)`}
                placeholder="Condition, what’s included, any marks or faults"
                value={fields.description}
                onChangeText={(v) => update('description', v)}
                multiline
                style={{ minHeight: 110, textAlignVertical: 'top' }}
              />
              {fields.deviceType === 'SMARTPHONE' ? (
                <Input
                  label="IMEI (dial *#06# to find it)"
                  placeholder="15 digits"
                  error={imei && imeiCheck.status === 'invalid' ? imeiCheck.message : undefined}
                  value={imei}
                  onChangeText={(v) => {
                    setImei(v);
                    setError('');
                  }}
                  keyboardType="number-pad"
                />
              ) : null}
              <Input label="Serial number (optional)" value={serialNumber} onChangeText={setSerialNumber} autoCapitalize="characters" autoCorrect={false} />
            </>
          ) : null}

          {step === 4 ? (
            <>
              <Input label="Your price (£)" value={fields.price} onChangeText={(v) => update('price', v)} keyboardType="decimal-pad" />
              <Label>Delivery</Label>
              <DeliveryOption
                selected={!fields.freeShipping}
                title="Buyer pays postage"
                note="Royal Mail postage is worked out at checkout from the device’s weight and the buyer’s location."
                onPress={() => update('freeShipping', false)}
              />
              <DeliveryOption
                selected={fields.freeShipping}
                title="Free postage for the buyer"
                note={
                  weightProfile
                    ? `You cover Royal Mail Tracked postage, so buyers see free delivery. Estimated parcel: about ${weightProfile.totalWeightGrams}g.`
                    : 'You cover Royal Mail Tracked postage, so buyers see free delivery.'
                }
                onPress={() => update('freeShipping', true)}
              />

              <View className="bg-surface border border-borderc rounded-2xl p-4 mt-1 mb-3">
                <View className="flex-row justify-between mb-2">
                  <Text className="text-sm text-text-muted">Asking price</Text>
                  <Text className="text-sm font-medium text-text">{formatPrice(isValidPrice ? parsedPrice : 0, 'GBP')}</Text>
                </View>
                <View className="flex-row justify-between mb-3">
                  <Text className="text-sm text-text-muted">VeriBuy commission</Text>
                  <Text className="text-sm font-medium text-emerald-700">£0.00</Text>
                </View>
                <View className="border-t border-borderc pt-3 flex-row justify-between items-center">
                  <Text className="text-[15px] font-semibold text-text">You receive</Text>
                  <Text className="text-lg font-bold text-emerald-700">{formatPrice(isValidPrice ? parsedPrice : 0, 'GBP')}</Text>
                </View>
                <Text className="text-[13px] text-text-muted mt-2 leading-[18px]">
                  {fields.freeShipping ? 'You also pay the postage. ' : ''}You’re paid once the buyer confirms the device arrived as described.
                </Text>
              </View>
            </>
          ) : null}

          {error ? (
            <View accessibilityLiveRegion="polite" className="flex-row items-start gap-2 mt-1">
              <Ionicons name="alert-circle-outline" size={18} color="#CC0C39" />
              <Text className="flex-1 text-sm text-danger leading-5">{error}</Text>
            </View>
          ) : null}
        </ScrollView>

        <View className="flex-row gap-2 pt-3 pb-3">
          {step > 1 && !submitting ? (
            <Pressable
              onPress={() => goTo(step - 1)}
              accessibilityRole="button"
              className="min-h-12 px-5 rounded-xl border border-border-strong bg-surface items-center justify-center"
            >
              <Text className="text-[15px] font-semibold text-text">Back</Text>
            </Pressable>
          ) : null}
          <View className="flex-1">
            {step < STEPS.length ? (
              <Button onPress={onContinue} disabled={preparingPhotos || webOnlyDraft} loading={preparingPhotos}>
                Continue
              </Button>
            ) : submitting ? (
              <View className="min-h-12 rounded-xl bg-primary opacity-80 items-center justify-center px-3">
                <Text className="text-white text-[15px] font-semibold">{progress || 'Publishing…'}</Text>
              </View>
            ) : (
              <Button onPress={onPublish} disabled={webOnlyDraft}>
                {createdListingId.current ? 'Publish again' : 'Publish listing'}
              </Button>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function pickDraftFields(data: Record<string, unknown>): Partial<DraftFields> {
  const picked: Partial<DraftFields> = {};
  for (const key of Object.keys(EMPTY) as (keyof DraftFields)[]) {
    const value = data[key];
    if (key === 'freeShipping') {
      if (typeof value === 'boolean') picked.freeShipping = value;
    } else if (typeof value === 'string') {
      picked[key] = value;
    }
  }
  return picked;
}
