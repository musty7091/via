import { useEffect, useState } from "react";

import {
  fetchCustomers,
  fetchCustomerVenues,
  fetchEventDetail,
  fetchEvents,
} from "../api/eventsApi";
import { EventDetailPanel } from "../components/EventDetailPanel";
import { EventEmptyState } from "../components/EventEmptyState";
import { EventList } from "../components/EventList";
import { EventToolbar } from "../components/EventToolbar";
import { MainLayout } from "../../../components/MainLayout";
import { ReadOnlyBanner } from "../../../components/ReadOnlyBanner";
import type {
  CustomerOption,
  EventDetail,
  EventListItem,
  VenueOption,
} from "../types/eventTypes";

type EventsPageProps = {
  onBackToDashboard: () => void;
  userName?: string;
  onLogout?: () => void;
  readOnly?: boolean;
};

const PAGE_SIZE = 8;

export function EventsPage({ onBackToDashboard, userName, onLogout, readOnly = false }: EventsPageProps) {
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [venues, setVenues] = useState<VenueOption[]>([]);

  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [eventDetail, setEventDetail] = useState<EventDetail | null>(null);

  const [search, setSearch] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadEvents(options?: {
    nextPageIndex?: number;
    nextSearch?: string;
    nextSelectedEventId?: number;
  }) {
    const targetPageIndex = options?.nextPageIndex ?? pageIndex;
    const targetSearch = options?.nextSearch ?? search;

    setIsLoadingList(true);
    setErrorMessage("");

    try {
      const data = await fetchEvents({
        search: targetSearch,
        skip: targetPageIndex * PAGE_SIZE,
        limit: PAGE_SIZE,
      });

      setEvents(data);
      setPageIndex(targetPageIndex);
      setHasNextPage(data.length === PAGE_SIZE);

      if (options?.nextSelectedEventId) {
        setSelectedEventId(options.nextSelectedEventId);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Etkinlik listesi alınamadı."
      );
    } finally {
      setIsLoadingList(false);
    }
  }

  async function loadEventDetail(eventId: number) {
    setIsLoadingDetail(true);
    setErrorMessage("");

    try {
      const detail = await fetchEventDetail(eventId);
      setEventDetail(detail);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Etkinlik detayı alınamadı."
      );
    } finally {
      setIsLoadingDetail(false);
    }
  }

  async function loadCustomersAndVenues() {
    try {
      const customerData = await fetchCustomers({ isActive: true, limit: 500 });
      setCustomers(customerData);

      const venueLists = await Promise.all(
        customerData.map((customer) =>
          fetchCustomerVenues(customer.id).catch(() => [])
        )
      );

      setVenues(venueLists.flat());
    } catch {
      setCustomers([]);
      setVenues([]);
    }
  }

  useEffect(() => {
    void loadEvents({
      nextPageIndex: 0,
      nextSearch: "",
    });
    void loadCustomersAndVenues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      void loadEventDetail(selectedEventId);
    } else {
      setEventDetail(null);
    }
  }, [selectedEventId]);

  return (
    <MainLayout
      title="Etkinlikler"
      onBack={onBackToDashboard}
      userName={userName}
      onLogout={onLogout}
    >
      <div className="space-y-5">
        {readOnly ? <ReadOnlyBanner /> : null}
        <EventToolbar
          search={search}
          pageIndex={pageIndex}
          hasNextPage={hasNextPage}
          isLoading={isLoadingList}
          pageSize={PAGE_SIZE}
          onSearchChange={setSearch}
          onSearchSubmit={() =>
            void loadEvents({
              nextPageIndex: 0,
              nextSearch: search,
            })
          }
          onPreviousPage={() =>
            void loadEvents({
              nextPageIndex: Math.max(pageIndex - 1, 0),
            })
          }
          onNextPage={() =>
            void loadEvents({
              nextPageIndex: pageIndex + 1,
            })
          }
        />

        {errorMessage ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-[390px_1fr]">
          <div>
            {isLoadingList ? (
              <div className="rounded-[2rem] bg-white p-8 text-center text-slate-500 shadow-sm">
                Etkinlikler yükleniyor...
              </div>
            ) : (
              <EventList
                events={events}
                customers={customers}
                venues={venues}
                selectedEventId={selectedEventId}
                onSelectEvent={setSelectedEventId}
              />
            )}
          </div>

          <div>
            {isLoadingDetail ? (
              <div className="rounded-[2rem] bg-white p-8 text-center text-slate-500 shadow-sm">
                Detay yükleniyor...
              </div>
            ) : eventDetail ? (
              <EventDetailPanel
                detail={eventDetail}
                customers={customers}
                venues={venues}
                readOnly={readOnly}
                onStatusChanged={() => {
                  if (selectedEventId) {
                    void loadEventDetail(selectedEventId);
                  }
                  void loadEvents();
                }}
              />
            ) : (
              <EventEmptyState />
            )}
          </div>
        </section>
      </div>
    </MainLayout>
  );
}