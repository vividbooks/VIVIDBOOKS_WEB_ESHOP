import React from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router';

/** `/webinar/:slug/dvpp-dotaznik` → dotazník po webináři (DVPP), stejné jako `?dvppDotaznik=1`. */
export function WebinarDvppDotaznikRedirectRoute() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();

  if (!id) return <Navigate to="/webinare" replace />;

  const sp = new URLSearchParams(searchParams);
  sp.set('dvppDotaznik', '1');
  const qs = sp.toString();

  return <Navigate to={`/webinar/${id}?${qs}`} replace />;
}
