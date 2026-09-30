/**
 * Type definitions matching the Royal Mail Click & Drop API v1 OpenAPI / Swagger specification.
 * API base URL: https://api.parcel.royalmail.com/api/v1
 */

export type ClickDropPackageFormat =
  | 'smallParcel'
  | 'mediumParcel'
  | 'largeParcel'
  | 'letter'
  | 'largeLetter'
  | 'undefined'
  | 'parcel'
  | 'documents';

export interface ClickDropAddress {
  fullName?: string;
  companyName?: string;
  addressLine1: string;
  addressLine2?: string;
  addressLine3?: string;
  city: string;
  county?: string;
  postcode?: string;
  countryCode: string;
}

export interface ClickDropRecipient {
  address: ClickDropAddress;
  phoneNumber?: string;
  emailAddress?: string;
  addressBookReference?: string;
}

export interface ClickDropSender {
  tradingName?: string;
  phoneNumber?: string;
  emailAddress?: string;
  address?: ClickDropAddress;
}

export interface ClickDropBilling {
  address?: ClickDropAddress;
  phoneNumber?: string;
  emailAddress?: string;
}

export interface ClickDropProductItem {
  name: string;
  SKU?: string;
  quantity: number;
  unitValue: number;
  unitWeightInGrams: number;
  customsDescription?: string;
  extendedCustomsDescription?: string;
  customsCode?: string;
  originCountryCode?: string;
  customsDeclarationCategory?: string;
  requiresExportLicence?: boolean;
}

export interface ClickDropDimensions {
  lengthInMms?: number;
  widthInMms?: number;
  depthInMms?: number;
}

export interface ClickDropShipmentPackage {
  weightInGrams: number;
  packageFormatIdentifier: ClickDropPackageFormat;
  customPackageFormatIdentifier?: string;
  dimensions?: ClickDropDimensions;
  contents?: ClickDropProductItem[];
}

export interface ClickDropPostageDetails {
  sendNotificationsTo?: 'sender' | 'recipient' | 'billing';
  serviceCode?: string;
  serviceRegisterCode?: string;
  carrierName?: string;
  consequentialLoss?: number;
  receiveEmailNotification?: boolean;
  receiveSmsNotification?: boolean;
  requestSignatureUponDelivery?: boolean;
  isLocalCollect?: boolean;
  safePlace?: string;
  department?: string;
  AIRNumber?: string;
  IOSSNumber?: string;
  requiresExportLicense?: boolean;
  commercialInvoiceNumber?: string;
  commercialInvoiceDate?: string;
  recipientEoriNumber?: string;
}

export interface ClickDropLabelGeneration {
  includeLabelInResponse?: boolean;
  includeCN?: boolean;
  includeReturnsLabel?: boolean;
}

export interface ClickDropTag {
  key: string;
  value: string;
}

export interface ClickDropCreateOrderRequest {
  orderReference?: string;
  isRecipientABusiness?: boolean;
  recipient: ClickDropRecipient;
  sender?: ClickDropSender;
  billing?: ClickDropBilling;
  packages?: ClickDropShipmentPackage[];
  orderDate: string;
  plannedDespatchDate?: string;
  specialInstructions?: string;
  subtotal: number;
  shippingCostCharged: number;
  otherCosts?: number;
  customsDutyCosts?: number;
  total: number;
  currencyCode?: string;
  containsDangerousGoods?: boolean;
  deliveryTerm?: string;
  dangerousGoodsUnCode?: string;
  dangerousDescription?: number;
  dangerousGoodsQuantity?: number;
  postageDetails?: ClickDropPostageDetails;
  tags?: ClickDropTag[];
  label?: ClickDropLabelGeneration;
}

export interface ClickDropCreateOrdersRequest {
  items: ClickDropCreateOrderRequest[];
}

export interface ClickDropPackageResponse {
  packageNumber: number;
}

export interface ClickDropLabelError {
  errorCode: number;
  errorMessage: string;
}

export interface ClickDropCreateOrderResponse {
  orderIdentifier: number;
  orderReference?: string;
  createdOn: string;
  orderDate?: string;
  printedOn?: string;
  manifestedOn?: string;
  shippedOn?: string;
  trackingNumber?: string;
  packages?: ClickDropPackageResponse[];
  label?: string; // Base64 encoded PDF
  labelErrors?: ClickDropLabelError[];
  generatedDocuments?: string[];
}

export interface ClickDropFieldError {
  fieldName: string;
  value?: string;
}

export interface ClickDropOrderError {
  errorCode: number;
  errorMessage: string;
  fields?: ClickDropFieldError[];
}

export interface ClickDropFailedOrderResponse {
  order: ClickDropCreateOrderRequest;
  errors: ClickDropOrderError[];
}

export interface ClickDropCreateOrdersResponse {
  successCount: number;
  errorsCount: number;
  createdOrders: ClickDropCreateOrderResponse[];
  failedOrders: ClickDropFailedOrderResponse[];
}

export interface ClickDropOrderInfo {
  orderIdentifier: number;
  orderReference?: string;
  recipient?: ClickDropRecipient;
  orderDate: string;
  subtotal: number;
  shippingCostCharged: number;
  total: number;
  currencyCode: string;
  orderStatus: string;
  trackingNumber?: string;
  createdOn?: string;
  printedOn?: string;
  manifestedOn?: string;
  shippedOn?: string;
}

export interface ClickDropUpdateStatusRequestItem {
  orderIdentifier?: number;
  orderReference?: string;
  status:
    | 'new'
    | 'despatched'
    | 'despatchedByOtherCourier'
    | 'cancelled';
  trackingNumber?: string;
  despatchDate?: string;
  shippingCarrier?: string;
  shippingService?: string;
}

export interface ClickDropUpdateOrdersStatusRequest {
  orders: ClickDropUpdateStatusRequestItem[];
}
