import type {
  CustomerOption,
  OfferDetail,
  OfferListItem,
  OfferPrintView,
  VenueOption,
} from "../../offers/types/offerTypes";

export type AgreementListItem = OfferListItem;

export type AgreementDetail = OfferDetail;

export type AgreementPrintView = OfferPrintView;

export type AgreementCustomerOption = CustomerOption;

export type AgreementVenueOption = VenueOption;

export type AgreementCustomerMap = Record<number, AgreementCustomerOption>;

export type AgreementVenueMap = Record<number, AgreementVenueOption>;