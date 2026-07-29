export default function CampaignLoading({ imageUrl = "" }) {
  return <div className="campaign-loading" style={{ "--loading-image": `url(${imageUrl})` }} role="status">
    <span className="campaign-loading-orbit" aria-hidden="true" />
    <b>Sincronizando cartografia orbital</b>
    <small>Estabelecendo enlace com o planeta</small>
  </div>;
}
