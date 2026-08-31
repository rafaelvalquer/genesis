const paths = {
  overview: <><rect x="3" y="3" width="5" height="5" /><rect x="12" y="3" width="5" height="5" /><rect x="3" y="12" width="5" height="5" /><rect x="12" y="12" width="5" height="5" /></>,
  troops: <><path d="M10 2v5M6 6l4 3 4-3M4 17c0-4 2.7-6 6-6s6 2 6 6" /><path d="M7 17v-2h6v2" /></>,
  threats: <><path d="M10 2 18 17H2L10 2Z" /><path d="M10 7v4M10 14v.1" /></>,
  routes: <><path d="M3 4h6l2 3h6" /><path d="M3 16h6l2-3h6" /><circle cx="3" cy="4" r="1" /><circle cx="3" cy="16" r="1" /><circle cx="17" cy="7" r="1" /><circle cx="17" cy="13" r="1" /></>,
  timeline: <><path d="M3 14 7 10l3 2 5-7 2 2" /><path d="M3 17h14M3 3v14" /></>,
};

export function TacticalTabIcon({ id }) {
  return <svg className="tactical-tab-icon" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[id]}</svg>;
}

export function TacticalReportIcon() {
  return <svg className="tactical-report-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 16V9h3v7H3Zm5 0V4h3v12H8Zm5 0V7h3v9h-3Z" fill="currentColor" /></svg>;
}
