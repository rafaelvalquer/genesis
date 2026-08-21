export default function ConvoyToast({ message, tone = "info" }) {
  if (!message) return null;
  return <div className={`convoy-toast convoy-toast-${tone}`} role="status">{message}</div>;
}
