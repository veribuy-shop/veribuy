/**
 * Turns backend error payloads into messages that are safe and useful to show
 * to people. NestJS + class-validator return messages such as
 * "shippingAddress.property deliveryMethod should not exist" or an array of
 * them; those are developer-facing and must not reach the UI verbatim.
 */

/** Human labels for DTO property names that commonly fail validation. */
const FIELD_LABELS: Record<string, string> = {
  name: 'name',
  displayName: 'display name',
  firstName: 'first name',
  lastName: 'last name',
  email: 'email address',
  password: 'password',
  currentPassword: 'current password',
  newPassword: 'new password',
  phone: 'phone number',
  line1: 'address line 1',
  line2: 'address line 2',
  city: 'town or city',
  state: 'county',
  postal_code: 'postcode',
  postalCode: 'postcode',
  country: 'country',
  title: 'title',
  description: 'description',
  price: 'price',
  amount: 'amount',
  quantity: 'quantity',
  imei: 'IMEI',
  serialNumber: 'serial number',
  brand: 'brand',
  model: 'model',
  deviceType: 'device type',
  conditionGrade: 'condition grade',
  startingBid: 'starting bid',
  reservePrice: 'reserve price',
  buyItNowPrice: 'Buy It Now price',
  message: 'message',
  content: 'message',
  reason: 'reason',
  shippingService: 'delivery service',
  deliveryMethod: 'delivery method',
  rating: 'rating',
  comment: 'comment',
  companyName: 'company name',
};

const TECHNICAL_PATTERN =
  /prisma|ECONN|ETIMEDOUT|ENOTFOUND|stack|sql|relation ".*"|internal server|unexpected token|cannot read propert|undefined is not|\bat\s+\S+\s+\(/i;

// HTTP reason phrases ("Conflict", "Bad Request") that Nest puts in `error`.
const HTTP_REASON_PHRASE =
  /^(bad request|unauthorized|forbidden|not found|conflict|gone|unprocessable entity|too many requests|internal server error|bad gateway|service unavailable|gateway timeout)$/i;

function labelFor(path: string): string {
  const leaf = path.split('.').pop() ?? path;
  return FIELD_LABELS[leaf] ?? leaf.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase();
}

/** Rewrites a single class-validator style message, or returns null if it is not one. */
function rewriteValidationMessage(msg: string): string | null {
  if (/\bproperty\s+\S+\s+should not exist$/i.test(msg)) {
    return 'Something on this page is out of date. Please refresh and try again.';
  }

  const match = msg.match(/^([\w.[\]]+)\s+(should not be empty|must be .+|must not be .+|must match .+|must contain .+|must have .+|should not .+)$/i);
  if (!match) return null;

  const [, path, rule] = match;
  const label = labelFor(path);
  const lower = rule.toLowerCase();

  if (lower.startsWith('should not be empty')) return `Please enter your ${label}.`;
  if (lower.includes('email')) return 'Please enter a valid email address.';
  const longer = lower.match(/longer than or equal to (\d+)/);
  if (longer) return `Your ${label} must be at least ${longer[1]} characters.`;
  const shorter = lower.match(/shorter than or equal to (\d+)/);
  if (shorter) return `Your ${label} must be ${shorter[1]} characters or fewer.`;
  const notLess = lower.match(/must not be less than (\d+(?:\.\d+)?)/);
  if (notLess) return `The ${label} must be at least ${notLess[1]}.`;
  const notGreater = lower.match(/must not be greater than (\d+(?:\.\d+)?)/);
  if (notGreater) return `The ${label} must be no more than ${notGreater[1]}.`;
  if (lower.includes('one of the following values')) return `Please choose a valid ${label}.`;
  return `Please check the ${label}.`;
}

/** Converts one raw message to a friendly one, or null if it should be hidden. */
export function friendlyMessage(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const msg = raw.trim();
  if (!msg) return null;
  const rewritten = rewriteValidationMessage(msg);
  if (rewritten) return rewritten;
  if (TECHNICAL_PATTERN.test(msg) || msg.length > 300) return null;
  return msg;
}

/**
 * Extracts a user-facing message from a backend JSON error body.
 * Accepts `{ message: string | string[] }`, `{ error: string }` or a string.
 */
export function friendlyApiError(data: unknown, fallback: string): string {
  const body = (data && typeof data === 'object' ? data : { message: data }) as {
    message?: unknown;
    error?: unknown;
  };
  const candidates = Array.isArray(body.message) ? body.message : [body.message, body.error];

  const seen = new Set<string>();
  for (const candidate of candidates) {
    const friendly = friendlyMessage(candidate);
    if (friendly) seen.add(friendly);
  }
  const messages = [...seen].filter((m) => !HTTP_REASON_PHRASE.test(m));
  if (messages.length === 0) return fallback;
  return messages.slice(0, 2).join(' ');
}
