import './LiveMap.css'

function LiveMap() {
  return (
    <section className="live-map" aria-labelledby="live-map-title">
      <h2 id="live-map-title">Live Map - Tester Locations</h2>
      <div className="live-map-canvas">
        <iframe
          title="OpenStreetMap live tester locations"
          src="https://www.openstreetmap.org/export/embed.html?bbox=-74.0300%2C40.6800%2C-73.9000%2C40.8200&layer=mapnik"
        />
      </div>
    </section>
  )
}

export default LiveMap
