import {
  fetchCustomers,
  fetchCustomerVenues,
  fetchOfferDetail,
  fetchOfferPrintView,
  fetchOffers,
} from "../../offers/api/offersApi";
import type {
  AgreementCustomerOption,
  AgreementDetail,
  AgreementListItem,
  AgreementPrintView,
  AgreementVenueOption,
} from "../types/agreementTypes";

export async function fetchAgreements(params?: {
  search?: string;
  skip?: number;
  limit?: number;
}): Promise<AgreementListItem[]> {
  return fetchOffers({
    search: params?.search,
    status: "agreement",
    skip: params?.skip,
    limit: params?.limit,
  });
}

export async function fetchAgreementDetail(
  agreementId: number
): Promise<AgreementDetail> {
  return fetchOfferDetail(agreementId);
}

export async function fetchAgreementPrintView(
  agreementId: number
): Promise<AgreementPrintView> {
  return fetchOfferPrintView(agreementId);
}

export async function fetchAgreementCustomers(): Promise<
  AgreementCustomerOption[]
> {
  return fetchCustomers({
    isActive: null,
    limit: 500,
  });
}

export async function fetchAgreementVenues(
  customerId: number
): Promise<AgreementVenueOption[]> {
  return fetchCustomerVenues(customerId);
}