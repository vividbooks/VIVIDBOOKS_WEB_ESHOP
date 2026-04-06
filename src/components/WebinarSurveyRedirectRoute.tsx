import React from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router';

/** `/webinar/:slug/dotaznik` → dotazník před webinářem (`?dotaznik=1`). DVPP po akci: `/webinar/.../dvpp-dotaznik`. */
export function WebinarSurveyRedirectRoute() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();

  if (!id) return <Navigate to="/webinare" replace />;

  const sp = new URLSearchParams(searchParams);
  sp.set('dotaznik', '1');
  const qs = sp.toString();

  return <Navigate to={`/webinar/${id}?${qs}`} replace />;
}
