export default function EmbeddedApp() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <iframe
        src="https://69d57633cdc86dba45d18ca2.base44.app"
        style={{ flex: 1, width: '100%', border: 'none', display: 'block' }}
        title="STR Scorecard"
        allow="fullscreen"
      />
    </div>
  );
}