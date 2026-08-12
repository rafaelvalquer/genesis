import { TROOP_CATALOG_TYPES, TROOP_CATALOG_TYPE_ORDER } from "./troopCatalogConfig.js";

const ICON_PATHS = {
  all: "M12 2 15 9 22 12 15 15 12 22 9 15 2 12 9 9Z",
  frontline: "M12 2 20 5V11c0 5-3.2 8.3-8 11-4.8-2.7-8-6-8-11V5Z",
  attack: "M5 19 10 14 8 12 12 10 10 8 14 4 16 6 20 4 18 8 20 10 16 12 18 14Z",
  area: "M12 2 14 9 21 12 14 14 12 22 10 14 3 12 10 9Z",
  control: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z",
  support: "M10 2h4v8h8v4h-8v8h-4v-8H2v-4h8Z",
  specialist: "M12 2 21 7v10l-9 5-9-5V7Z M12 7v10 M7 9.5l5 2.8 5-2.8",
};

function CatalogIcon({ id }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICON_PATHS[id]} /></svg>;
}

export default function TroopCatalogToolbar({ type, sort, search, onTypeChange, onSortChange, onSearchChange }) {
  return <div className="troop-catalog-toolbar">
    <div className="catalog-type-tabs" role="group" aria-label="Categorias de tropas">
      {TROOP_CATALOG_TYPE_ORDER.map((id) => {
        const item = TROOP_CATALOG_TYPES[id];
        return <button key={id} type="button" className={type === id ? "is-active" : ""} aria-label={item.tooltip} aria-pressed={type === id} title={item.tooltip} onClick={() => onTypeChange(id)}>
          <span aria-hidden="true"><CatalogIcon id={id} /></span><small>{item.label}</small>
        </button>;
      })}
    </div>
    <label className="catalog-sort"> <span className="sr-only">Ordenar catálogo</span><select value={sort} onChange={(event) => onSortChange(event.target.value)} aria-label="Ordenar catálogo"><option value="appearance">Aparição</option><option value="name">Nome A-Z</option><option value="energy">Energia ↑</option><option value="energyDesc">Energia ↓</option><option value="supply">Suprimento ↑</option><option value="supplyDesc">Suprimento ↓</option></select></label>
    <label className="catalog-search"><span aria-hidden="true">⌕</span><span className="sr-only">Buscar tropa</span><input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Buscar tropa..." aria-label="Buscar tropa" /></label>
  </div>;
}
