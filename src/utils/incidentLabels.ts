/**
 * Popisky pro workflow řešení incidentu (order_alerts + app_incidents).
 * Není to stav objednávky — jen evidence: čeká → někdo převzal → uzavřeno.
 */
export function incidentResolutionStateLabelCs(state: string): string {
  switch (state) {
    case 'open':
      return 'Čeká na vyřízení';
    case 'acknowledged':
      return 'V řešení';
    case 'resolved':
      return 'Uzavřený';
    case 'suppressed':
      return 'Potlačený';
    default:
      return state;
  }
}

export function incidentSeverityLabelCs(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'Kritická';
    case 'warning':
      return 'Varování';
    case 'info':
      return 'Info';
    default:
      return severity;
  }
}
